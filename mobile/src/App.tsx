import { useEffect, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import rawCards from "@/data/card-catalog.json";
import priceSnapshot from "@/data/cardmarket-prices.json";
import productSnapshot from "@/data/cardmarket-products.json";
import { CatalogPage } from "@/app/components/catalog-page";
import { CollectionPage, type CollectionView } from "@/app/components/collection-page";
import { buildCatalog, type CatalogPayload, type PriceGuide, type RawCard } from "@/lib/catalog";
import { SETS, type SetCode } from "@/lib/sets";

const PRICE_GUIDE_URL = "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json";
const nativeFetch = window.fetch.bind(window);
const priceSyncs = new Map<SetCode, Promise<void>>();

function setFromRequest(url: URL): SetCode {
  const code = (url.searchParams.get("set") ?? "OGN").toUpperCase() as SetCode;
  return SETS.some((set) => set.code === code) ? code : "OGN";
}

function embeddedCatalog(code: SetCode): CatalogPayload {
  const set = SETS.find((item) => item.code === code)!;
  return buildCatalog({
    set,
    cards: rawCards as RawCard[],
    products: productSnapshot.products,
    prices: priceSnapshot.priceGuides as PriceGuide[],
    pricesUpdatedAt: priceSnapshot.createdAt,
    productsUpdatedAt: productSnapshot.createdAt,
    refreshAvailableAt: null,
    sourceStatus: "snapshot",
  });
}

function isPriceGuideExport(value: unknown): value is { createdAt: string; priceGuides: PriceGuide[] } {
  if (!value || typeof value !== "object") return false;
  const guide = value as { createdAt?: unknown; priceGuides?: unknown };
  return typeof guide.createdAt === "string"
    && Number.isFinite(Date.parse(guide.createdAt))
    && Array.isArray(guide.priceGuides)
    && guide.priceGuides.length > 0;
}

async function updatePricesFromCardmarket(code: SetCode): Promise<void> {
  try {
    const remote = Capacitor.isNativePlatform()
      ? await CapacitorHttp.get({ url: PRICE_GUIDE_URL, connectTimeout: 10_000, readTimeout: 20_000 })
      : await (async () => {
          const response = await nativeFetch(PRICE_GUIDE_URL);
          return { status: response.status, data: await response.json() };
        })();
    if (remote.status < 200 || remote.status >= 300 || !remote.data) return;

    const guide = typeof remote.data === "string"
      ? JSON.parse(remote.data) as unknown
      : remote.data as unknown;
    if (!isPriceGuideExport(guide)) return;

    const set = SETS.find((item) => item.code === code)!;
    const payload = buildCatalog({
      set,
      cards: rawCards as RawCard[],
      products: productSnapshot.products,
      prices: guide.priceGuides,
      pricesUpdatedAt: guide.createdAt,
      productsUpdatedAt: productSnapshot.createdAt,
      refreshAvailableAt: null,
      sourceStatus: "live",
    });

    // Only prices are replaced. The complete card list always comes from the
    // APK, so a failed connection can never make the catalogue disappear.
    window.dispatchEvent(new CustomEvent<CatalogPayload>("riftbound:catalog-updated", { detail: payload }));
  } catch {
    // Offline: keep the bundled catalogue and its last included price guide.
  }
}

function requestLatestPrices(code: SetCode) {
  if (priceSyncs.has(code)) return;
  const sync = updatePricesFromCardmarket(code).finally(() => priceSyncs.delete(code));
  priceSyncs.set(code, sync);
}

window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString(), window.location.href);
  if (url.pathname === "/api/catalog" && (init?.method ?? "GET") === "GET") {
    const code = setFromRequest(url);
    requestLatestPrices(code);
    return Response.json(embeddedCatalog(code));
  }
  if (url.pathname === "/api/catalog/refresh" && (init?.method ?? "GET") === "POST") {
    requestLatestPrices(setFromRequest(url));
    return Response.json({ refreshStatus: "unchanged", updatedProducts: 0 });
  }
  return nativeFetch(input, init);
};

function routeFor(pathname: string) {
  if (pathname.startsWith("/collection")) {
    const parts = pathname.split("/").filter(Boolean);
    const view = (["owned", "missing", "manage"].includes(parts.at(-1) ?? "") ? parts.at(-1) : "home") as CollectionView;
    return <CollectionPage view={view} focusSetCode={SETS.find((set) => set.slug === parts.at(-2))?.code} />;
  }
  return <CatalogPage setCode={(pathname === "/" ? SETS[0] : SETS.find((set) => pathname === `/sets/${set.slug}`) ?? SETS[0]).code} />;
}

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const listener = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  return routeFor(pathname);
}
