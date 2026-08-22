import type { CatalogRow, CatalogVariant, VariantKind } from "@/lib/catalog";
import {
  isSpecialFilter,
  matchesSpecialFilter,
  type FilterKind,
} from "@/lib/catalog-presentation";
import type { PriceMode } from "@/lib/pricing";

const EURO = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const RARITY_LABELS: Record<string, string> = {
  Common: "Commune",
  Uncommon: "Peu commune",
  Rare: "Rare",
  Epic: "Épique",
  Showcase: "Showcase",
  Ultimate: "Ultimate",
  Special: "Spéciale",
};

export const RARITY_ORDER = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Showcase",
  "Ultimate",
  "Special",
  "—",
];

export function formatPrice(value: number | null) {
  return value === null ? "—" : EURO.format(value);
}

export function variantsOf(row: CatalogRow, kind: VariantKind) {
  return row.variants.filter((variant) => variant.kind === kind);
}

export function associatedVariantsOf(row: CatalogRow, kind: VariantKind) {
  return row.associatedVariants.filter((variant) => variant.kind === kind);
}

export function variantsForFilter(row: CatalogRow, filter: FilterKind) {
  if (filter === "all") return row.variants;
  if (filter === "numbered") return row.isNumbered ? variantsOf(row, "base") : [];
  if (filter === "extras") return row.isExtra ? row.variants : [];
  if (isSpecialFilter(filter)) {
    if (!matchesSpecialFilter(row, filter)) return [];
    if (filter === "crystal-rose") return variantsOf(row, "crystal-rose");
    return row.variants.filter(
      (variant) => variant.kind === "overnumbered" || variant.kind === "signature",
    );
  }

  return variantsOf(row, filter);
}

export function variantForDisplay(row: CatalogRow, filter: FilterKind, rarity: string) {
  const candidates = variantsForFilter(row, filter);
  if (rarity !== "all") {
    const rarityMatch = candidates.find((variant) => variant.rarity === rarity);
    if (rarityMatch) return rarityMatch;
  }

  return candidates[0] ?? row.variants.find((variant) => variant.kind === "base") ?? row.variants[0];
}

export function rarityLabel(rarity: string) {
  return RARITY_LABELS[rarity] ?? rarity;
}

export function kindLabel(kind: VariantKind) {
  if (kind === "base") return "Carte du set";
  if (kind === "alternate") return "Alternative";
  if (kind === "crystal-rose") return "Crystal Rose";
  if (kind === "overnumbered") return "Outnumbered";
  if (kind === "signature") return "Signée";
  return "Variante";
}

export function variantBadgeLabel(variant: CatalogVariant) {
  return variant.kind === "base" ? rarityLabel(variant.rarity) : kindLabel(variant.kind);
}

export function rarityClassName(rarity: string) {
  return rarity.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "-");
}

export function modeLabel(mode: PriceMode) {
  if (mode === "low") return "À partir de";
  if (mode === "trend") return "Tendance";
  return "Moyenne 30 j";
}
