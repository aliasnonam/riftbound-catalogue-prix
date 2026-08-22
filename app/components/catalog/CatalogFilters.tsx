"use client";

import type { RefObject } from "react";

import type { FilterDefinition, FilterKind } from "@/lib/catalog-presentation";
import type { PriceMode } from "@/lib/pricing";

import { rarityLabel } from "./catalog-utils";

type SortMode = "number" | "name" | "price-desc" | "price-asc";

export function CatalogFilters({
  query,
  onQueryChange,
  rarity,
  rarities,
  onRarityChange,
  sortMode,
  onSortModeChange,
  priceMode,
  onPriceModeChange,
  filters,
  activeFilterKind,
  onFilterKindChange,
  tabsRef,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  rarity: string;
  rarities: readonly string[];
  onRarityChange: (value: string) => void;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
  priceMode: PriceMode;
  onPriceModeChange: (value: PriceMode) => void;
  filters: readonly FilterDefinition[];
  activeFilterKind: FilterKind;
  onFilterKindChange: (value: FilterKind) => void;
  tabsRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="filter-shell">
      <div className="filter-primary">
        <label className="search-field">
          <span className="sr-only">Rechercher une carte</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Nom, numéro, domaine…"
          />
        </label>
        <label className="select-field">
          <span>Rareté</span>
          <select
            value={rarity}
            onChange={(event) => onRarityChange(event.target.value)}
          >
            <option value="all">Toutes</option>
            {rarities.map((item) => (
              <option value={item} key={item}>
                {rarityLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <span>Trier</span>
          <select
            value={sortMode}
            onChange={(event) =>
              onSortModeChange(event.target.value as SortMode)
            }
          >
            <option value="number">Numéro croissant</option>
            <option value="name">Nom A–Z</option>
            <option value="price-desc">Prix le plus élevé</option>
            <option value="price-asc">Prix le plus bas</option>
          </select>
        </label>
        <label className="select-field price-mode-field">
          <span>Valeur affichée</span>
          <select
            value={priceMode}
            onChange={(event) =>
              onPriceModeChange(event.target.value as PriceMode)
            }
          >
            <option value="low">Prix minimum</option>
            <option value="trend">Tendance Cardmarket</option>
            <option value="avg30">Moyenne 30 jours</option>
          </select>
        </label>
      </div>
      <div className="filter-tabs-wrap">
        <div
          className="filter-tabs"
          ref={tabsRef}
          role="group"
          aria-label="Type de carte"
        >
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={activeFilterKind === filter.id ? "is-active" : ""}
              onClick={() => onFilterKindChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
