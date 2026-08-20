import { NextResponse } from "next/server";

import rawCards from "@/data/card-catalog.json";
import snapshotPrices from "@/data/cardmarket-prices.json";
import snapshotProducts from "@/data/cardmarket-products.json";
import {
  buildCatalog,
  type MarketProduct,
  type PriceGuide,
  type RawCard,
} from "@/lib/catalog";
import { SET_BY_CODE, type SetCode } from "@/lib/sets";

export const dynamic = "force-dynamic";

const PRODUCTS_URL =
  "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json";
const PRICES_URL =
  "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json";

type ProductExport = {
  version: number;
  createdAt: string;
  products: MarketProduct[];
};

type PriceExport = {
  version: number;
  createdAt: string;
  priceGuides: PriceGuide[];
};

type MarketBundle = {
  products: ProductExport;
  prices: PriceExport;
  sourceStatus: "live" | "snapshot";
};

let marketCache: { expiresAt: number; value: MarketBundle } | null = null;

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Cardmarket export unavailable (${response.status})`);
  }

  return (await response.json()) as T;
}

async function getMarketBundle(forceRefresh: boolean): Promise<MarketBundle> {
  const now = Date.now();
  if (!forceRefresh && marketCache && marketCache.expiresAt > now) {
    return marketCache.value;
  }

  try {
    const [products, prices] = await Promise.all([
      fetchJson<ProductExport>(PRODUCTS_URL),
      fetchJson<PriceExport>(PRICES_URL),
    ]);
    const value: MarketBundle = {
      products,
      prices,
      sourceStatus: "live",
    };
    marketCache = { expiresAt: now + 15 * 60 * 1000, value };
    return value;
  } catch {
    return {
      products: snapshotProducts as ProductExport,
      prices: snapshotPrices as PriceExport,
      sourceStatus: "snapshot",
    };
  }
}

function isSetCode(value: string): value is SetCode {
  return value in SET_BY_CODE;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedSet = (url.searchParams.get("set") ?? "OGN").toUpperCase();

  if (!isSetCode(requestedSet)) {
    return NextResponse.json(
      { error: "Set inconnu. Utilise OGN, SFD, UNL ou VEN." },
      { status: 400 },
    );
  }

  const bundle = await getMarketBundle(
    url.searchParams.get("refresh") === "1",
  );
  const payload = buildCatalog({
    set: SET_BY_CODE[requestedSet],
    cards: rawCards as RawCard[],
    products: bundle.products.products,
    prices: bundle.prices.priceGuides,
    pricesUpdatedAt: bundle.prices.createdAt,
    productsUpdatedAt: bundle.products.createdAt,
    sourceStatus: bundle.sourceStatus,
  });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
