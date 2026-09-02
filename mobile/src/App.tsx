import { useEffect, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import rawCards from "@/data/card-catalog.json";
import priceSnapshot from "@/data/cardmarket-prices.json";
import productSnapshot from "@/data/cardmarket-products.json";
import { CatalogPage } from "@/app/components/catalog-page";
import { CollectionPage, type CollectionView } from "@/app/components/collection-page";
import { buildCatalog, type CatalogPayload, type PriceGuide, type RawCard } from "@/lib/catalog";
import { SETS, type SetCode } from "@/lib/sets";
import { androidStorage } from "./storage";

const REMOTE_ORIGIN = "https://riftbound-catalogue-prix.hydegoody.chatgpt.site";
const nativeFetch = window.fetch.bind(window);

function setFromRequest(url: URL): SetCode {
  const code = (url.searchParams.get("set") ?? "OGN").toUpperCase() as SetCode;
  return SETS.some((set) => set.code === code) ? code : "OGN";
}

function embeddedCatalog(code: SetCode): CatalogPayload {
  const set = SETS.find((item) => item.code === code)!;
  return buildCatalog({ set, cards: rawCards as RawCard[], products: productSnapshot.products, prices: priceSnapshot.priceGuides as PriceGuide[], pricesUpdatedAt: priceSnapshot.createdAt, productsUpdatedAt: productSnapshot.createdAt, refreshAvailableAt: null, sourceStatus: "snapshot" });
}

function isUsableCatalog(payload: unknown, code: SetCode): payload is CatalogPayload {
  if (!payload || typeof payload !== "object") return false;
  const catalog = payload as Partial<CatalogPayload>;
  // A partial/error response must never replace a complete local catalogue.
  // In particular, an empty saved response used to make the Android UI show
  // "0 carte" while its loading placeholders stayed on screen.
  return catalog.set?.code === code
    && Array.isArray(catalog.rows)
    && catalog.rows.length > 0
    && typeof catalog.pricesUpdatedAt === "string";
}

async function latestCatalogFromSite(code: SetCode): Promise<CatalogPayload | null> {
  const url = `${REMOTE_ORIGIN}/api/catalog?set=${code}`;
  try {
    const remote = Capacitor.isNativePlatform()
      ? await CapacitorHttp.get({ url, connectTimeout: 10_000, readTimeout: 20_000 })
      : await (async () => { const response = await nativeFetch(url); return { status: response.status, data: await response.json() }; })();
    if (remote.status < 200 || remote.status >= 300 || !remote.data) return null;
    const payload = typeof remote.data === "string"
      ? JSON.parse(remote.data) as unknown
      : remote.data as unknown;
    if (!isUsableCatalog(payload, code)) return null;
    await androidStorage.saveCatalog(payload);
    return payload;
  } catch {
    return null;
  }
}

window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString(), window.location.href);
  if (url.pathname === "/api/catalog" && (init?.method ?? "GET") === "GET") {
    const code = setFromRequest(url);
    // The site owns price refreshes. Android always asks it for the latest
    // published catalogue, then falls back to its persistent local cache.
    const cached = await androidStorage.readCatalog(code);
    return Response.json(
      (await latestCatalogFromSite(code))
      ?? (isUsableCatalog(cached, code) ? cached : null)
      ?? embeddedCatalog(code),
    );
  }
  if (url.pathname === "/api/catalog/refresh" && (init?.method ?? "GET") === "POST") {
    try {
      const requestUrl = `${REMOTE_ORIGIN}/api/catalog/refresh?set=${setFromRequest(url)}`;
      const remote = Capacitor.isNativePlatform()
        ? await CapacitorHttp.post({ url: requestUrl })
        : await (async () => { const response = await nativeFetch(requestUrl, { method: "POST" }); return { status: response.status, data: await response.json() }; })();
      if (remote.status === 429) {
        let cooldown = remote.data as { error?: string; pricesUpdatedAt?: string; refreshAvailableAt?: string } | null;
        if (!cooldown?.refreshAvailableAt && Capacitor.isNativePlatform()) {
          const snapshot = await CapacitorHttp.get({ url: `${REMOTE_ORIGIN}/api/catalog?set=${setFromRequest(url)}` });
          cooldown = snapshot.data as typeof cooldown;
        }
        return Response.json({
          error: cooldown?.error ?? "Réessayer plus tard",
          pricesUpdatedAt: cooldown?.pricesUpdatedAt ?? new Date().toISOString(),
          refreshAvailableAt: cooldown?.refreshAvailableAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }, { status: 429 });
      }
      if (remote.status < 200 || remote.status >= 300 || !remote.data) throw new Error("remote refresh unavailable");
      const result = remote.data as { payload: CatalogPayload; refreshStatus: "updated" | "unchanged"; updatedProducts: number };
      await androidStorage.saveCatalog(result.payload);
      return Response.json(result);
    } catch { return Response.json({ error: "Le guide Cardmarket reste disponible hors connexion." }, { status: 503 }); }
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
  useEffect(() => { const listener = () => setPathname(window.location.pathname); window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); }, []);
  return routeFor(pathname);
}
