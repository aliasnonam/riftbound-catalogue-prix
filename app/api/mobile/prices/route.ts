import { NextResponse } from "next/server";

import type { PriceGuide } from "@/lib/catalog";
import { getMarketBundle } from "@/lib/market-data";

export const dynamic = "force-dynamic";

type MobilePrice = {
  idProduct: number;
  normal: {
    low: number | null;
    trend: number | null;
    avg30: number | null;
  };
  foil: {
    low: number | null;
    trend: number | null;
    avg30: number | null;
  };
};

function toMobilePrice(guide: PriceGuide): MobilePrice {
  return {
    idProduct: guide.idProduct,
    normal: {
      low: guide.low,
      trend: guide.trend,
      avg30: guide.avg30,
    },
    foil: {
      // Some price-guide records omit foil fields entirely. The mobile
      // contract always exposes the three keys so one missing foil price
      // cannot invalidate the whole synchronisation payload.
      low: guide["low-foil"] ?? null,
      trend: guide["trend-foil"] ?? null,
      avg30: guide["avg30-foil"] ?? null,
    },
  };
}

/**
 * Read-only payload for the Android application.
 *
 * The price cache is populated exclusively by the manual refresh endpoint used
 * on the website. `getMarketBundle` only reads that cache (or the bundled
 * fallback), so this route never requests Cardmarket itself.
 */
export async function GET() {
  const bundle = await getMarketBundle();
  const knownProductIds = new Set(
    bundle.products.products.map((product) => product.idProduct),
  );
  const prices = bundle.prices.priceGuides
    .filter((guide) => knownProductIds.has(guide.idProduct))
    .map(toMobilePrice);

  return NextResponse.json(
    {
      updatedAt: bundle.prices.createdAt,
      sourceStatus: bundle.sourceStatus,
      prices,
    },
    {
      headers: {
        // Do not let a CDN or the Android HTTP cache hide a manual refresh.
        "Cache-Control": "no-store",
        // Also permits testing the endpoint from the Capacitor webview/browser.
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
