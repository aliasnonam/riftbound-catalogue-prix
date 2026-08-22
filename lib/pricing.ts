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

function collectorNumberRoot(number: string) {
  return number.trim().replace(/\*$/, "");
}

function linkedSignature(
  row: CatalogRow,
  overnumbered: CatalogVariant,
) {
  const overnumberedNumber = collectorNumberRoot(overnumbered.number);
  const signatures = row.variants.filter(
    (variant) => variant.kind === "signature",
  );

  return (
    signatures.find(
      (variant) =>
        collectorNumberRoot(variant.number) === overnumberedNumber,
    ) ?? (signatures.length === 1 ? signatures[0] : undefined)
  );
}

/**
 * Prix de tri de la seule impression représentée par la ligne courante.
 * Les variantes de la même famille ne doivent pas valoriser une ligne de base.
 * Seule exception volontaire : une Outnumbered est la ligne principale de sa
 * famille premium et prend le prix de sa Signée jumelle lorsqu'il existe.
 */
export function getEffectiveSortPrice(
  row: CatalogRow,
  displayedVariant: CatalogVariant | undefined,
  priceMode: PriceMode,
) {
  if (!displayedVariant) return null;

  if (displayedVariant.kind === "overnumbered") {
    const signature = linkedSignature(row, displayedVariant);
    const signaturePrice = signature
      ? getPrimaryVariantPrice(signature, priceMode)
      : null;

    return (
      signaturePrice ?? getPrimaryVariantPrice(displayedVariant, priceMode)
    );
  }

  if (displayedVariant.kind === "base") {
    return getVariantFoilPrice(displayedVariant, priceMode);
  }

  return getPrimaryVariantPrice(displayedVariant, priceMode);
}

export function compareByEffectivePrice(
  a: { row: CatalogRow; displayedVariant: CatalogVariant | undefined },
  b: { row: CatalogRow; displayedVariant: CatalogVariant | undefined },
  priceMode: PriceMode,
  direction: "asc" | "desc" = "desc",
) {
  const aValue = getEffectiveSortPrice(a.row, a.displayedVariant, priceMode);
  const bValue = getEffectiveSortPrice(b.row, b.displayedVariant, priceMode);

  if (aValue === null && bValue === null) {
    return a.row.sortOrder - b.row.sortOrder;
  }
  if (aValue === null) return 1;
  if (bValue === null) return -1;

  const difference =
    direction === "desc" ? bValue - aValue : aValue - bValue;
  return difference !== 0
    ? difference
    : a.row.sortOrder - b.row.sortOrder;
}
