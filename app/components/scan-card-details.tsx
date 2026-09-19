import type { CatalogVariant } from "@/lib/catalog";
import { getPrimaryVariantPrice, getVariantNormalPrice, getVariantFoilPrice, type PriceMode } from "@/lib/pricing";

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export function ScanFoilOwnership({ variant, foilOwned, en }: { variant: CatalogVariant; foilOwned: boolean; en: boolean }) {
  if (variant.pricing !== "dual") return null;
  return <div className={`scan-foil-ownership ${foilOwned ? "is-owned" : "is-missing"}`}>
    {foilOwned ? (en ? "✓ Foil owned" : "✓ Foil possédée") : (en ? "✕ Foil not owned" : "✕ Foil non possédée")}
  </div>;
}

export function ScanCardPrices({ variant, priceMode, en }: { variant: CatalogVariant; priceMode: PriceMode; en: boolean }) {
  const prices = variant.pricing === "dual"
    ? [
      { label: "Normal", value: getVariantNormalPrice(variant, priceMode) },
      { label: "Foil", value: getVariantFoilPrice(variant, priceMode) },
    ]
    : [{ label: en ? "Cardmarket price" : "Prix Cardmarket", value: getPrimaryVariantPrice(variant, priceMode) }];
  return <dl className="scan-card-prices">
    {prices.map(({ label, value }) => <div key={label}>
      <dt>{label}</dt>
      <dd>{value === null ? (en ? "Unavailable" : "Indisponible") : EURO.format(value)}</dd>
    </div>)}
  </dl>;
}
