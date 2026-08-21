import type { CatalogRow, CatalogVariant, PriceSeries } from "./catalog";

export type PriceMode = "low" | "trend" | "avg30";

export function getActivePrice(
  impression: PriceSeries,
  priceMode: PriceMode,
) {
  const value = impression[priceMode];
  return value !== null && value > 0 ? value : null;
}

export function getPrimaryVariantPrice(
  variant: CatalogVariant,
  priceMode: PriceMode,
) {
  return (
    getActivePrice(variant.standard, priceMode) ??
    getActivePrice(variant.foil, priceMode)
  );
}

function getDisplayedVariantPrices(
  variant: CatalogVariant,
  priceMode: PriceMode,
) {
  if (
    variant.kind === "base" ||
    variant.kind === "alternate" ||
    variant.kind === "crystal-rose"
  ) {
    return [
      getActivePrice(variant.standard, priceMode),
      getActivePrice(variant.foil, priceMode),
    ].filter((value): value is number => value !== null);
  }

  const primary = getPrimaryVariantPrice(variant, priceMode);
  return primary === null ? [] : [primary];
}

export function getSortValue(row: CatalogRow, priceMode: PriceMode) {
  const availableValues = row.associatedVariants
    .flatMap((variant) => getDisplayedVariantPrices(variant, priceMode));

  return availableValues.length ? Math.max(...availableValues) : null;
}

export function compareByHighestActivePrice(
  a: CatalogRow,
  b: CatalogRow,
  priceMode: PriceMode,
) {
  const aValue = getSortValue(a, priceMode);
  const bValue = getSortValue(b, priceMode);

  if (aValue === null && bValue === null) return a.sortOrder - b.sortOrder;
  if (aValue === null) return 1;
  if (bValue === null) return -1;

  const difference = bValue - aValue;
  return difference !== 0 ? difference : a.sortOrder - b.sortOrder;
}
