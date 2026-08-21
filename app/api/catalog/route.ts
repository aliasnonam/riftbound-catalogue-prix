import { NextResponse } from "next/server";

import rawCards from "@/data/card-catalog.json";
import {
  buildCatalog,
  type RawCard,
} from "@/lib/catalog";
import { getMarketBundle } from "@/lib/market-data";
import { SET_BY_CODE, type SetCode } from "@/lib/sets";

export const dynamic = "force-dynamic";

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

  const bundle = await getMarketBundle();
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
      "Cache-Control": "no-store",
    },
  });
}
