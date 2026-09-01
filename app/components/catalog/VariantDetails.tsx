"use client";

import type { CatalogRow } from "@/lib/catalog";
import { getCollectionImpressionId } from "@/lib/collection";
import {
  getPrimaryVariantPrice,
  getVariantFoilPrice,
  getVariantNormalPrice,
  type PriceMode,
} from "@/lib/pricing";
import type { SetCode } from "@/lib/sets";
import { useCollection } from "@/hooks/use-collection";

import { CardPreviewThumb } from "./CardPreview";
import {
  formatPrice,
  modeLabel,
  rarityClassName,
  variantBadgeLabel,
} from "./catalog-utils";

export function VariantDetails({
  row,
  mode,
  setCode,
}: {
  row: CatalogRow;
  mode: PriceMode;
  setCode: SetCode;
}) {
  const collection = useCollection();

  return (
    <div className="variant-panel">
      <div className="variant-panel-heading">
        <div>
          <p className="mini-label">Toutes les impressions associées</p>
          <p>
            Les prix affichés suivent le mode « {modeLabel(mode).toLowerCase()} ».
          </p>
        </div>
        <a href={row.cardmarketUrl} target="_blank" rel="noreferrer">
          Voir les versions sur Cardmarket <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="variant-grid">
        {row.associatedVariants.map((variant) => {
          const collectionStatus = collection.getStatus(
            getCollectionImpressionId(setCode, variant.id),
          );

          return (
            <article className="variant-card" key={variant.id}>
              <CardPreviewThumb
                className="variant-thumb"
                imageUrl={variant.imageUrl}
                name={`${variant.name} — ${variantBadgeLabel(variant)}`}
              />
              <div className="variant-copy">
                <div className="variant-title-line">
                  <span
                    className={`variant-kind kind-${variant.kind} rarity-${rarityClassName(variant.rarity)}`}
                  >
                    {variantBadgeLabel(variant)}
                  </span>
                  <span className="variant-number">{variant.number}</span>
                </div>
                <strong className={`rarity-title-${variant.rarity.toLowerCase()}`}>
                  {variant.name}
                </strong>
                {variant.pricing === "dual" ? (
                  <div className="variant-prices">
                    <span>
                      Normal
                      <b>{formatPrice(getVariantNormalPrice(variant, mode))}</b>
                    </span>
                    <span>
                      Foil
                      <b>{formatPrice(getVariantFoilPrice(variant, mode))}</b>
                    </span>
                  </div>
                ) : (
                  <div className="variant-prices variant-prices--single">
                    <b>{formatPrice(getPrimaryVariantPrice(variant, mode))}</b>
                  </div>
                )}
                <div className="variant-collection-status">
                  <span>Ma collection</span>
                  <b className={`collection-status-badge is-${collectionStatus}`}>
                    {collectionStatus === "owned"
                      ? "✓ Possédée"
                      : "✕ Manquante"}
                  </b>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
