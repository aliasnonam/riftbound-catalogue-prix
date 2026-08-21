import { eq } from "drizzle-orm";

import snapshotPrices from "@/data/cardmarket-prices.json";
import snapshotProducts from "@/data/cardmarket-products.json";
import { getDb } from "@/db";
import { marketPriceCache } from "@/db/schema";
import {
  isStoredPriceGuideList,
  parsePriceExport,
  preparePriceRefresh,
  type PriceExport,
} from "@/lib/cardmarket-refresh";
import type { MarketProduct, PriceGuide } from "@/lib/catalog";

const CACHE_KEY = "riftbound";
const PRICES_URL =
  "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json";

type ProductExport = {
  version: number;
  createdAt: string;
  products: MarketProduct[];
};

type PriceCache = {
  prices: PriceGuide[];
  sourceVersion: number;
  sourceCreatedAt: string;
  syncedAt: string;
  matchedProducts: number;
};

export type MarketBundle = {
  products: ProductExport;
  prices: PriceExport;
  sourceStatus: "live" | "snapshot";
};

const bundledProducts = snapshotProducts as ProductExport;
const bundledPrices = snapshotPrices as PriceExport;

async function readPriceCache(): Promise<PriceCache | null> {
  const [stored] = await getDb()
    .select()
    .from(marketPriceCache)
    .where(eq(marketPriceCache.key, CACHE_KEY))
    .limit(1);

  if (!stored) return null;
  const prices = JSON.parse(stored.pricesJson) as unknown;
  if (!isStoredPriceGuideList(prices)) return null;

  return {
    prices,
    sourceVersion: stored.sourceVersion,
    sourceCreatedAt: stored.sourceCreatedAt,
    syncedAt: stored.syncedAt,
    matchedProducts: stored.matchedProducts,
  };
}

async function writePriceCache(cache: PriceCache) {
  await getDb()
    .insert(marketPriceCache)
    .values({
      key: CACHE_KEY,
      pricesJson: JSON.stringify(cache.prices),
      sourceVersion: cache.sourceVersion,
      sourceCreatedAt: cache.sourceCreatedAt,
      syncedAt: cache.syncedAt,
      matchedProducts: cache.matchedProducts,
    })
    .onConflictDoUpdate({
      target: marketPriceCache.key,
      set: {
        pricesJson: JSON.stringify(cache.prices),
        sourceVersion: cache.sourceVersion,
        sourceCreatedAt: cache.sourceCreatedAt,
        syncedAt: cache.syncedAt,
        matchedProducts: cache.matchedProducts,
      },
    });
}

function bundleFromCache(cache: PriceCache): MarketBundle {
  return {
    products: bundledProducts,
    prices: {
      version: cache.sourceVersion,
      createdAt: cache.syncedAt,
      priceGuides: cache.prices,
    },
    sourceStatus: "live",
  };
}

function snapshotBundle(): MarketBundle {
  return {
    products: bundledProducts,
    prices: bundledPrices,
    sourceStatus: "snapshot",
  };
}

export async function getMarketBundle(): Promise<MarketBundle> {
  try {
    const cache = await readPriceCache();
    return cache ? bundleFromCache(cache) : snapshotBundle();
  } catch {
    return snapshotBundle();
  }
}

async function fetchLatestPriceGuide() {
  const response = await fetch(PRICES_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`Cardmarket a répondu avec le statut ${response.status}.`);
  }
  return parsePriceExport(await response.json());
}

export async function refreshMarketPrices() {
  const storedCache = await readPriceCache();
  const currentPrices = storedCache?.prices ?? bundledPrices.priceGuides;
  const currentSourceCreatedAt =
    storedCache?.sourceCreatedAt ?? bundledPrices.createdAt;
  const incoming = await fetchLatestPriceGuide();

  const prepared = preparePriceRefresh({
    products: bundledProducts.products,
    currentPrices,
    currentSourceCreatedAt,
    incoming,
  });

  const cache: PriceCache = {
    prices: prepared.prices,
    sourceVersion: prepared.sourceVersion,
    sourceCreatedAt: prepared.sourceCreatedAt,
    syncedAt: prepared.syncedAt,
    matchedProducts: prepared.matchedProducts,
  };
  await writePriceCache(cache);

  return {
    bundle: bundleFromCache(cache),
    refreshStatus: prepared.refreshStatus,
    updatedProducts: prepared.updatedProducts,
  };
}
