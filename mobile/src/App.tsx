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

window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString(), window.location.href);
  if (url.pathname === "/api/catalog" && (init?.method ?? "GET") === "GET") {
    const code = setFromRequest(url);
    return Response.json((await androidStorage.readCatalog(code)) ?? embeddedCatalog(code));
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
