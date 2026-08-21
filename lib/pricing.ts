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
  if (variant.pricing === "single") {
    return getActivePrice(variant.price, priceMode);
  }

  return (
    getActivePrice(variant.normal, priceMode) ??
    getActivePrice(variant.foil, priceMode)
  );
}

export function getVariantNormalPrice(
  variant: CatalogVariant,
  priceMode: PriceMode,
) {
  if (variant.pricing !== "dual") return null;
  return getActivePrice(variant.normal, priceMode);
}

export function getVariantFoilPrice(
  variant: CatalogVariant,
  priceMode: PriceMode,
) {
  if (variant.pricing === "dual") {
    return getActivePrice(variant.foil, priceMode);
  }

  // Une impression unique du set numéroté (Rare, Epic, Ultimate, etc.)
  // occupe la colonne Foil ; sa colonne Normal reste volontairement vide.
  return variant.kind === "base"
    ? getActivePrice(variant.price, priceMode)
    : null;
}

export function getVariantActivePrices(
  variant: CatalogVariant,
  priceMode: PriceMode,
) {
  if (variant.pricing === "dual") {
    return [
      getActivePrice(variant.normal, priceMode),
      getActivePrice(variant.foil, priceMode),
    ].filter((value): value is number => value !== null);
  }

  const primary = getPrimaryVariantPrice(variant, priceMode);
  return primary === null ? [] : [primary];
}

export function getSortValue(row: CatalogRow, priceMode: PriceMode) {
  const availableValues = row.associatedVariants
    .flatMap((variant) => getVariantActivePrices(variant, priceMode));

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
