"use client";

import type { CatalogRow as CatalogRowData, CatalogVariant } from "@/lib/catalog";
import {
  getDescriptiveBadges,
  type FilterKind,
} from "@/lib/catalog-presentation";
import {
  getPrimaryVariantPrice,
  getVariantFoilPrice,
  getVariantNormalPrice,
  type PriceMode,
} from "@/lib/pricing";
import type { SetCode } from "@/lib/sets";
import { useSiteLanguage } from "@/app/lib/site-language";

import { CardPreviewThumb } from "./CardPreview";
import { VariantDetails } from "./VariantDetails";
import {
  associatedVariantsOf,
  formatPrice,
  rarityLabel,
  variantForDisplay,
} from "./catalog-utils";

type PriceColumn = "normal" | "foil" | "alternate" | "overnumbered" | "signature";

function PriceCell({
  row,
  column,
  mode,
  displayVariant,
  language,
}: {
  row: CatalogRowData;
  column: PriceColumn;
  mode: PriceMode;
  displayVariant: CatalogVariant | undefined;
  language: "fr" | "en";
}) {
  const base = row.associatedVariants.find((variant) => variant.kind === "base");
  let variants: CatalogVariant[] = [];
  let primary: number | null = null;

  if (column === "normal") {
    primary =
      displayVariant?.pricing === "dual" && base
        ? getVariantNormalPrice(base, mode)
        : null;
  } else if (column === "foil") {
    primary = base ? getVariantFoilPrice(base, mode) : null;
  } else {
    variants =
      column === "alternate"
        ? [
            ...associatedVariantsOf(row, "alternate"),
            ...associatedVariantsOf(row, "crystal-rose"),
          ]
        : associatedVariantsOf(
            row,
            column === "overnumbered" ? "overnumbered" : "signature",
          );
    const first = variants[0];
    if (first) primary = getPrimaryVariantPrice(first, mode);
  }

  return (
    <div className={`price-cell ${primary === null ? "is-empty" : ""}`}>
      <span className="price-value">{formatPrice(primary)}</span>
      {variants.length > 1 ? (
        <span className="price-note">+{variants.length - 1} {language === "en" ? "variant" : "variante"}</span>
      ) : null}
    </div>
  );
}

export function CatalogRow({
  row,
  activeFilterKind,
  rarity,
  priceMode,
  setCode,
  isOpen,
  onToggle,
}: {
  row: CatalogRowData;
  activeFilterKind: FilterKind;
  rarity: string;
  priceMode: PriceMode;
  setCode: SetCode;
  isOpen: boolean;
  onToggle: (rowId: string) => void;
}) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const displayVariant = variantForDisplay(row, activeFilterKind, rarity);
  const displayRarity = displayVariant?.rarity ?? row.rarity;
  const displayNumber =
    displayVariant?.number && displayVariant.number !== "—"
      ? displayVariant.number
      : row.number;

  return (
    <article className={`catalog-row ${isOpen ? "is-open" : ""}`}>
      <div className="catalog-row-main">
        <div className="card-identity">
          <CardPreviewThumb
            className="card-thumb"
            imageUrl={displayVariant?.imageUrl ?? row.imageUrl}
            name={displayVariant?.name ?? row.name}
          />
          <div className="card-copy">
            <div className="card-kicker">
              <span className="collector-number">{displayNumber}</span>
              <span className={`rarity rarity-${displayRarity.toLowerCase()}`}>
                {rarityLabel(displayRarity, language)}
              </span>
              {getDescriptiveBadges(row, setCode).map((badge) => (
                <span
                  className={`property-badge property-badge--${badge.id}`}
                  key={badge.id}
                >
                  {badge.label}
                </span>
              ))}
            </div>
            <h3 className={`rarity-title-${displayRarity.toLowerCase()}`}>
              {row.name}
            </h3>
            <p>
              {row.type}
              {row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}
            </p>
          </div>
        </div>
        <PriceCell row={row} column="normal" mode={priceMode} displayVariant={displayVariant} language={language} />
        <PriceCell row={row} column="foil" mode={priceMode} displayVariant={displayVariant} language={language} />
        <PriceCell row={row} column="alternate" mode={priceMode} displayVariant={displayVariant} language={language} />
        <PriceCell row={row} column="overnumbered" mode={priceMode} displayVariant={displayVariant} language={language} />
        <PriceCell row={row} column="signature" mode={priceMode} displayVariant={displayVariant} language={language} />
        <button
          className="expand-button"
          type="button"
          aria-expanded={isOpen}
          aria-label={(isOpen ? (en ? "Hide" : "Masquer") : (en ? "Show" : "Afficher")) + " " + (en ? "variants for" : "les variantes de") + " " + row.name}
          onClick={() => onToggle(row.id)}
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>
      {isOpen ? <VariantDetails row={row} mode={priceMode} setCode={setCode} /> : null}
    </article>
  );
}
