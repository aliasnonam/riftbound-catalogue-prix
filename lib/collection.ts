import type { CatalogPayload, CatalogRow, CatalogVariant } from "@/lib/catalog";
import type { PriceMode } from "@/lib/pricing";
import { getVariantActivePrices } from "@/lib/pricing";
import type { SetCode } from "@/lib/sets";

export type CollectionStatus = "owned" | "missing";
export type CollectionState = Record<string, CollectionStatus>;

export const COLLECTION_STORAGE_KEY = "riftbound-collection-v1";
export const COLLECTION_CHANGE_EVENT = "riftbound-collection-change";

export type CollectionImpression = {
  impressionId: string;
  setCode: SetCode;
  setName: string;
  row: CatalogRow;
  variant: CatalogVariant;
};

export function getCollectionImpressionId(setCode: SetCode, variantId: string) {
  return `${setCode}:${variantId}`;
}

export function flattenCatalogPayload(payload: CatalogPayload): CollectionImpression[] {
  const seen = new Set<string>();
  return payload.rows.flatMap((row) =>
    row.variants.flatMap((variant) => {
      const impressionId = getCollectionImpressionId(payload.set.code, variant.id);
      if (seen.has(impressionId)) return [];
      seen.add(impressionId);
      return [{ impressionId, setCode: payload.set.code, setName: payload.set.name, row, variant }];
    }),
  );
}

export function getCollectionPrice(
  impression: CollectionImpression,
  priceMode: PriceMode,
) {
  const prices = getVariantActivePrices(impression.variant, priceMode);
  return prices.length ? Math.max(...prices) : null;
}

export function readCollectionState(raw: string | null): CollectionState {
  if (!raw) return {};
  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
    return Object.fromEntries(
      Object.entries(candidate).filter(
        (entry): entry is [string, CollectionStatus] =>
          entry[1] === "owned" || entry[1] === "missing",
      ),
    );
  } catch {
    return {};
  }
}
