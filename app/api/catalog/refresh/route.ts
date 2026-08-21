import { NextResponse } from "next/server";

import rawCards from "@/data/card-catalog.json";
import { buildCatalog, type RawCard } from "@/lib/catalog";
import {
  PriceRefreshCooldownError,
  refreshMarketPrices,
} from "@/lib/market-data";
import { SET_BY_CODE, type SetCode } from "@/lib/sets";

export const dynamic = "force-dynamic";

function isSetCode(value: string): value is SetCode {
  return value in SET_BY_CODE;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const requestedSet = (url.searchParams.get("set") ?? "OGN").toUpperCase();
  if (!isSetCode(requestedSet)) {
    return NextResponse.json(
      { error: "Set inconnu. Utilise OGN, SFD, UNL ou VEN." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await refreshMarketPrices();
    const bundle = result.bundle;
    const payload = buildCatalog({
      set: SET_BY_CODE[requestedSet],
      cards: rawCards as RawCard[],
      products: bundle.products.products,
      prices: bundle.prices.priceGuides,
      pricesUpdatedAt: bundle.prices.createdAt,
      productsUpdatedAt: bundle.products.createdAt,
      refreshAvailableAt: bundle.refreshAvailableAt,
      sourceStatus: bundle.sourceStatus,
    });

    return NextResponse.json(
      {
        payload,
        refreshStatus: result.refreshStatus,
        updatedProducts: result.updatedProducts,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PriceRefreshCooldownError) {
      return NextResponse.json(
        {
          error: "Réessayer plus tard",
          pricesUpdatedAt: error.lastSuccessfulAt,
          refreshAvailableAt: error.refreshAvailableAt,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Cardmarket price refresh failed", error);
    return NextResponse.json(
      { error: "Le Price Guide Cardmarket n’a pas pu être actualisé." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
