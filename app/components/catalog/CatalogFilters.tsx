"use client";

import type { RefObject } from "react";

import type { FilterDefinition, FilterKind } from "@/lib/catalog-presentation";
import type { PriceMode } from "@/lib/pricing";

import { CustomSelect } from "@/app/components/ui/custom-select";

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
        <CustomSelect className="select-field" label="Rareté" value={rarity} onChange={onRarityChange} options={[{ value: "all", label: "Toutes" }, ...rarities.map((item) => ({ value: item, label: rarityLabel(item) }))]} />
        <CustomSelect className="select-field" label="Trier" value={sortMode} onChange={(value) => onSortModeChange(value as SortMode)} options={[{ value: "number", label: "Numéro croissant" }, { value: "name", label: "Nom A–Z" }, { value: "price-desc", label: "Prix le plus élevé" }, { value: "price-asc", label: "Prix le plus bas" }]} />
        <CustomSelect className="select-field price-mode-field" label="Valeur affichée" value={priceMode} onChange={(value) => onPriceModeChange(value as PriceMode)} options={[{ value: "low", label: "Prix minimum" }, { value: "trend", label: "Tendance Cardmarket" }, { value: "avg30", label: "Moyenne 30 jours" }]} />
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
