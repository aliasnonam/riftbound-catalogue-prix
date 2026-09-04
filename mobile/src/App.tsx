import { useEffect, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import rawCards from "@/data/card-catalog.json";
import priceSnapshot from "@/data/cardmarket-prices.json";
import productSnapshot from "@/data/cardmarket-products.json";
import { CatalogPage } from "@/app/components/catalog-page";
import { CollectionPage, type CollectionView } from "@/app/components/collection-page";
import {
  buildCatalog,
  type CatalogPayload,
  type PriceGuide,
  type PriceSeries,
  type RawCard,
} from "@/lib/catalog";
import { SETS, type SetCode } from "@/lib/sets";
import { androidStorage } from "./storage";
import "./sync-status.css";

const REMOTE_ORIGIN = "https://riftbound-catalogue-prix.hydegoody.chatgpt.site";
const MOBILE_PRICES_URL = `${REMOTE_ORIGIN}/api/mobile/prices`;
const nativeFetch = window.fetch.bind(window);

type PriceSourceStatus = "live" | "snapshot";

type LocalPriceData = {
  updatedAt: string;
  sourceStatus: PriceSourceStatus;
  priceGuides: PriceGuide[];
};

type RemotePriceRecord = {
  idProduct: number;
  normal: PriceSeries;
  foil: PriceSeries;
};

type RemotePricesResponse = {
  updatedAt: string;
  sourceStatus: PriceSourceStatus;
  prices: RemotePriceRecord[];
};

type PriceSyncStatus =
  | { state: "syncing" }
  | { state: "synced"; updatedAt: string; sourceStatus: PriceSourceStatus }
  | { state: "offline"; updatedAt: string; sourceStatus: PriceSourceStatus; cached: boolean };

let activePriceData: LocalPriceData = {
  updatedAt: priceSnapshot.createdAt,
  sourceStatus: "snapshot",
  priceGuides: priceSnapshot.priceGuides as PriceGuide[],
};
let activePriceSync: Promise<void> | null = null;
let currentPriceSyncStatus: PriceSyncStatus = { state: "syncing" };

function setFromRequest(url: URL): SetCode {
  const code = (url.searchParams.get("set") ?? "OGN").toUpperCase() as SetCode;
  return SETS.some((set) => set.code === code) ? code : "OGN";
}

function localCatalog(code: SetCode): CatalogPayload {
  const set = SETS.find((item) => item.code === code)!;
  return buildCatalog({
    set,
    cards: rawCards as RawCard[],
    products: productSnapshot.products,
    prices: activePriceData.priceGuides,
    pricesUpdatedAt: activePriceData.updatedAt,
    productsUpdatedAt: productSnapshot.createdAt,
    refreshAvailableAt: null,
    sourceStatus: activePriceData.sourceStatus,
  });
}

function isPriceValue(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isPriceSeries(value: unknown): value is PriceSeries {
  if (!value || typeof value !== "object") return false;
  const series = value as Partial<PriceSeries>;
  return isPriceValue(series.low)
    && isPriceValue(series.trend)
    && isPriceValue(series.avg30);
}

function isRemotePricesResponse(value: unknown): value is RemotePricesResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<RemotePricesResponse>;
  return typeof response.updatedAt === "string"
    && Number.isFinite(Date.parse(response.updatedAt))
    && (response.sourceStatus === "live" || response.sourceStatus === "snapshot")
    && Array.isArray(response.prices)
    && response.prices.length > 0
    && response.prices.every(
      (price) =>
        price !== null
        && typeof price === "object"
        && Number.isInteger((price as RemotePriceRecord).idProduct)
        && isPriceSeries((price as RemotePriceRecord).normal)
        && isPriceSeries((price as RemotePriceRecord).foil),
    );
}

function emptyPriceGuide(idProduct: number): PriceGuide {
  return {
    idProduct,
    idCategory: 0,
    avg: null,
    low: null,
    trend: null,
    avg1: null,
    avg7: null,
    avg30: null,
    "avg-foil": null,
    "low-foil": null,
    "trend-foil": null,
    "avg1-foil": null,
    "avg7-foil": null,
    "avg30-foil": null,
  };
}

function mergeSitePrices(prices: RemotePriceRecord[]): PriceGuide[] {
  // The endpoint intentionally contains only the six values shown by the app.
  // Preserve the bundled fields for every other price and product.
  const guidesByProduct = new Map<number, PriceGuide>(
    (priceSnapshot.priceGuides as PriceGuide[]).map((guide) => [
      guide.idProduct,
      { ...guide },
    ]),
  );

  for (const price of prices) {
    const previous = guidesByProduct.get(price.idProduct) ?? emptyPriceGuide(price.idProduct);
    guidesByProduct.set(price.idProduct, {
      ...previous,
      low: price.normal.low,
      trend: price.normal.trend,
      avg30: price.normal.avg30,
      "low-foil": price.foil.low,
      "trend-foil": price.foil.trend,
      "avg30-foil": price.foil.avg30,
    });
  }

  return [...guidesByProduct.values()];
}

function isLocalPriceData(value: unknown): value is LocalPriceData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<LocalPriceData>;
  return typeof data.updatedAt === "string"
    && Number.isFinite(Date.parse(data.updatedAt))
    && (data.sourceStatus === "live" || data.sourceStatus === "snapshot")
    && Array.isArray(data.priceGuides)
    && data.priceGuides.length > 0
    && data.priceGuides.every(
      (price) => price !== null
        && typeof price === "object"
        && Number.isInteger((price as PriceGuide).idProduct),
    );
}

function publishPriceSyncStatus(status: PriceSyncStatus) {
  currentPriceSyncStatus = status;
  window.dispatchEvent(
    new CustomEvent<PriceSyncStatus>("riftbound:price-sync-status", { detail: status }),
  );
}

function applyPriceData(next: LocalPriceData) {
  activePriceData = next;
  for (const set of SETS) {
    // CatalogPage already listens to this event. It only replaces prices;
    // card definitions always come from rawCards bundled in the APK.
    window.dispatchEvent(
      new CustomEvent<CatalogPayload>("riftbound:catalog-updated", {
        detail: localCatalog(set.code),
      }),
    );
  }
}

async function readCachedPriceData(): Promise<LocalPriceData | null> {
  const cached = await androidStorage.readPriceCache();
  return isLocalPriceData(cached) ? cached : null;
}

async function fetchPricesFromSite(): Promise<LocalPriceData> {
  const remote = Capacitor.isNativePlatform()
    ? await CapacitorHttp.get({
        url: MOBILE_PRICES_URL,
        connectTimeout: 10_000,
        readTimeout: 20_000,
      })
    : await (async () => {
        const response = await nativeFetch(MOBILE_PRICES_URL, { cache: "no-store" });
        return { status: response.status, data: await response.json() };
      })();

  if (remote.status < 200 || remote.status >= 300 || !remote.data) {
    throw new Error("Le site n'a pas fourni de prix.");
  }

  const data = typeof remote.data === "string"
    ? JSON.parse(remote.data) as unknown
    : remote.data as unknown;
  if (!isRemotePricesResponse(data)) {
    throw new Error("La réponse de prix du site est incomplète.");
  }

  return {
    updatedAt: data.updatedAt,
    sourceStatus: data.sourceStatus,
    priceGuides: mergeSitePrices(data.prices),
  };
}

function synchronisePricesFromSite() {
  if (activePriceSync) return activePriceSync;

  publishPriceSyncStatus({ state: "syncing" });
  activePriceSync = (async () => {
    let cached: LocalPriceData | null = null;
    try {
      cached = await readCachedPriceData();
      if (cached) applyPriceData(cached);
    } catch {
      // IndexedDB is an optimisation; the bundled catalogue remains usable.
    }

    try {
      const latest = await fetchPricesFromSite();
      applyPriceData(latest);
      try {
        await androidStorage.savePriceCache(latest);
      } catch {
        // The live response is still valid when the local cache cannot write.
      }
      publishPriceSyncStatus({
        state: "synced",
        updatedAt: latest.updatedAt,
        sourceStatus: latest.sourceStatus,
      });
    } catch {
      const fallback = cached ?? activePriceData;
      publishPriceSyncStatus({
        state: "offline",
        updatedAt: fallback.updatedAt,
        sourceStatus: fallback.sourceStatus,
        cached: cached !== null,
      });
    }
  })().finally(() => {
    activePriceSync = null;
  });

  return activePriceSync;
}

window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString(), window.location.href);
  if (url.pathname === "/api/catalog" && (init?.method ?? "GET") === "GET") {
    const code = setFromRequest(url);
    if (url.searchParams.get("lang") === "fr") {
      try {
        const remote = Capacitor.isNativePlatform()
          ? await CapacitorHttp.get({ url: `${REMOTE_ORIGIN}/api/catalog?set=${code}&lang=fr`, connectTimeout: 10_000, readTimeout: 20_000 })
          : await (async () => { const response = await nativeFetch(`${REMOTE_ORIGIN}/api/catalog?set=${code}&lang=fr`, { cache: "no-store" }); return { status: response.status, data: await response.json() }; })();
        if (remote.status >= 200 && remote.status < 300 && remote.data) return Response.json(typeof remote.data === "string" ? JSON.parse(remote.data) : remote.data);
      } catch {
        // The bundled English catalogue remains available offline.
      }
    }
    return Response.json(localCatalog(code));
  }
  if (url.pathname === "/api/catalog/refresh" && (init?.method ?? "GET") === "POST") {
    // Price refreshes are intentionally triggered manually on the website.
    // The Android button is hidden; this preserves the shared component API.
    return Response.json({ refreshStatus: "unchanged", updatedProducts: 0 });
  }
  return nativeFetch(input, init);
};

function routeFor(pathname: string) {
  if (pathname.startsWith("/collection")) {
    const parts = pathname.split("/").filter(Boolean);
    const view = (["owned", "missing", "manage"].includes(parts.at(-1) ?? "") ? parts.at(-1) : "home") as CollectionView;
    return <CollectionPage view={view} focusSetCode={SETS.find((set) => set.slug === parts.at(-2))?.code} isMobileApp />;
  }
  const setCode = (pathname === "/" ? SETS[0] : SETS.find((set) => pathname === `/sets/${set.slug}`) ?? SETS[0]).code;
  // The mobile shell keeps the same React component while navigating between
  // sets. A key deliberately remounts the catalog so pagination returns to 50.
  return <CatalogPage key={setCode} setCode={setCode} isMobileApp />;
}

function formatSyncDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

function MobilePriceSyncStatus() {
  const [status, setStatus] = useState<PriceSyncStatus>(currentPriceSyncStatus);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const receiveStatus = (event: Event) => {
      const next = (event as CustomEvent<PriceSyncStatus>).detail;
      if (next) {
        setStatus(next);
        setVisible(true);
      }
    };
    window.addEventListener("riftbound:price-sync-status", receiveStatus);
    return () => window.removeEventListener("riftbound:price-sync-status", receiveStatus);
  }, []);

  useEffect(() => {
    if (status.state === "syncing") return;
    const timer = window.setTimeout(() => setVisible(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!visible) return null;

  if (status.state === "syncing") {
    return (
      <aside className="android-price-sync is-syncing" role="status" aria-live="polite">
        <span className="android-price-sync-dot" aria-hidden="true" />
        <div>
          <strong>Synchronisation avec le site…</strong>
          <span>Les cartes et les derniers prix locaux restent disponibles.</span>
        </div>
      </aside>
    );
  }

  const usingSiteReleve = status.sourceStatus === "live";
  const title = status.state === "offline"
    ? "Hors connexion"
    : usingSiteReleve
      ? "Dernier relevé du site"
      : "Prix inclus dans l’application";
  const detail = status.state === "offline"
    ? `${status.cached ? "Dernier relevé conservé" : "Derniers prix inclus"} : ${formatSyncDate(status.updatedAt)}`
    : formatSyncDate(status.updatedAt);

  return (
    <aside className={`android-price-sync is-${status.state}`} role="status" aria-live="polite">
      <span className="android-price-sync-dot" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </aside>
  );
}

export function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const listener = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    void synchronisePricesFromSite();
  }, []);
  return <>
    {routeFor(pathname)}
    <MobilePriceSyncStatus />
  </>;
}
