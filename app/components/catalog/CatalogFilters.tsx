"use client";

import type { RefObject } from "react";

import type { FilterDefinition, FilterKind } from "@/lib/catalog-presentation";
import type { PriceMode } from "@/lib/pricing";

import { CustomSelect } from "@/app/components/ui/custom-select";
import { useSiteLanguage } from "@/app/lib/site-language";

import { rarityLabel } from "./catalog-utils";

type SortMode = "number" | "name" | "price-desc" | "price-asc";

function filterLabel(label: string, english: boolean) {
  if (!english) return label;
  return ({
    "Toutes": "All",
    "Set numéroté": "Numbered set",
    "Alternatives": "Alternates",
    "Signées": "Signed",
    "Runes & tokens": "Runes & tokens",
  } as Record<string, string>)[label] ?? label;
}

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
  const { language } = useSiteLanguage();
  const en = language === "en";
  return (
    <div className="filter-shell">
      <div className="filter-primary">
        <label className="search-field">
          <span className="sr-only">{en ? "Search a card" : "Rechercher une carte"}</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={en ? "Name, number, domain…" : "Nom, numéro, domaine…"}
          />
        </label>
        <CustomSelect className="select-field" label={en ? "Rarity" : "Rareté"} value={rarity} onChange={onRarityChange} options={[{ value: "all", label: en ? "All" : "Toutes" }, ...rarities.map((item) => ({ value: item, label: en ? item : rarityLabel(item) }))]} />
        <CustomSelect className="select-field" label={en ? "Sort" : "Trier"} value={sortMode} onChange={(value) => onSortModeChange(value as SortMode)} options={[{ value: "number", label: en ? "Number ascending" : "Numéro croissant" }, { value: "name", label: en ? "Name A–Z" : "Nom A–Z" }, { value: "price-desc", label: en ? "Highest price" : "Prix le plus élevé" }, { value: "price-asc", label: en ? "Lowest price" : "Prix le plus bas" }]} />
        <CustomSelect className="select-field price-mode-field" label={en ? "Displayed value" : "Valeur affichée"} value={priceMode} onChange={(value) => onPriceModeChange(value as PriceMode)} options={[{ value: "low", label: en ? "Lowest price" : "Prix minimum" }, { value: "trend", label: en ? "Cardmarket trend" : "Tendance Cardmarket" }, { value: "avg30", label: en ? "30-day average" : "Moyenne 30 jours" }]} />
      </div>
      <div className="filter-tabs-wrap">
        <div
          className="filter-tabs"
          ref={tabsRef}
          role="group"
          aria-label={en ? "Card type" : "Type de carte"}
        >
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={activeFilterKind === filter.id ? "is-active" : ""}
              onClick={() => onFilterKindChange(filter.id)}
            >
              {filterLabel(filter.label, en)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
