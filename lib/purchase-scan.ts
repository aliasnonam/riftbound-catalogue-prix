import { findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";

// Fractions of the visible preview, also used by the CameraX overlay/crop.
export const PURCHASE_CODE_REGION = { x: 0.055, y: 0.855, width: 0.58, height: 0.09 } as const;

/** The purchase scanner reads only the collector code, never nearby names. */
export function resolvePurchaseCode(text: string, impressions: CollectionImpression[]): ResolvedCardScan {
  const parsed = parseCardScanText(text);
  if (!parsed.ok) return parsed.reason === "ambiguous" ? { kind: "ambiguous", candidates: [] } : { kind: "not-found" };
  return findCardFromScan(parsed.value, impressions);
}

/** Match object-fit: cover before applying the visible code rectangle. */
export function getPurchaseCodeCrop(width: number, height: number, previewRatio = 63 / 88) {
  const visibleWidth = Math.min(width, height * previewRatio);
  const visibleHeight = visibleWidth / previewRatio;
  return {
    x: (width - visibleWidth) / 2 + visibleWidth * PURCHASE_CODE_REGION.x,
    y: (height - visibleHeight) / 2 + visibleHeight * PURCHASE_CODE_REGION.y,
    width: visibleWidth * PURCHASE_CODE_REGION.width,
    height: visibleHeight * PURCHASE_CODE_REGION.height,
  };
}
