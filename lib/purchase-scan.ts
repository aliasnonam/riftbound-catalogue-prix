import { findCardFromDetectedText, findCardFromScan, parseCardScanText, type ResolvedCardScan } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";
import { SET_BY_CODE } from "@/lib/sets";

export const PURCHASE_CODE_EXAMPLE = "OGN · 007/298";

export function formatPurchaseScanCode(impression: CollectionImpression, detectedText = "") {
  const parsed = parseCardScanText(detectedText);
  const total = parsed.ok && parsed.value.setCode === impression.setCode
    ? parsed.value.printedSetTotal : SET_BY_CODE[impression.setCode].baseSize;
  return `${impression.setCode} · ${impression.variant.number.toUpperCase()}${total ? `/${total}` : ""}`;
}

/** Keyboard entry is exact: it accepts an optional printed denominator. */
export function resolveTypedPurchaseCode(raw: string, impressions: CollectionImpression[]): ResolvedCardScan {
  const text = raw.normalize("NFKC").trim().toUpperCase().replace(/[✶✱✳✴✵★☆⋆∗﹡]/g, "*");
  const code = text.match(/^(OGN|SFD|UNL|VEN)[\s·•-]*(R?\d{1,3})\s*([*A]?)\s*(?:\/\s*\d{1,3})?$/);
  if (!code) return { kind: "not-found" };
  const canonical = (value: string) => value.toUpperCase().replace(/^(R?)0+(?=\d)/, "$1");
  const number = canonical(`${code[2]}${code[3]}`);
  const candidates = [...new Map(impressions.filter((impression) => impression.setCode === code[1]
    && canonical(impression.variant.number) === number).map((impression) => [impression.impressionId, impression])).values()];
  if (candidates.length === 1) return { kind: "match", impression: candidates[0], confidence: "high" };
  return candidates.length ? { kind: "ambiguous", candidates } : { kind: "not-found" };
}

// Fractions of the visible preview, also used by the CameraX overlay/crop.
export const PURCHASE_CODE_REGION = { x: 0.055, y: 0.855, width: 0.58, height: 0.09 } as const;
export const PURCHASE_CARD_REGION = { x: 0.055, y: 0.055, width: 0.89, height: 0.89 } as const;

/** The purchase scanner reads only the collector code, never nearby names. */
export function resolvePurchaseCode(text: string, impressions: CollectionImpression[]): ResolvedCardScan {
  const parsed = parseCardScanText(text);
  if (!parsed.ok) return parsed.reason === "ambiguous" ? { kind: "ambiguous", candidates: [] } : { kind: "not-found" };
  return findCardFromScan(parsed.value, impressions);
}

/** Automatic scanning can also read the name when the collector line is tiny. */
export function resolveAutomaticPurchaseScan(text: string, impressions: CollectionImpression[]): ResolvedCardScan {
  const parsed = parseCardScanText(text);
  if (parsed.ok) return findCardFromScan(parsed.value, impressions, text);
  if (parsed.reason === "ambiguous") return { kind: "ambiguous", candidates: [] };
  return findCardFromDetectedText(text, impressions);
}

/** Match object-fit: cover before applying the visible code rectangle. */
export function getPurchaseCodeCrop(width: number, height: number, previewRatio = 63 / 88, codeOnly = true) {
  const region = codeOnly ? PURCHASE_CODE_REGION : PURCHASE_CARD_REGION;
  const visibleWidth = Math.min(width, height * previewRatio);
  const visibleHeight = visibleWidth / previewRatio;
  return {
    x: (width - visibleWidth) / 2 + visibleWidth * region.x,
    y: (height - visibleHeight) / 2 + visibleHeight * region.y,
    width: visibleWidth * region.width,
    height: visibleHeight * region.height,
  };
}
