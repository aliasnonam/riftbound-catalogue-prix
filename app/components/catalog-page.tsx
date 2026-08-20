"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type {
  CatalogPayload,
  CatalogRow,
  CatalogVariant,
  PriceSeries,
  SpecialCategory,
  VariantKind,
} from "@/lib/catalog";
import {
  getSetHref,
  SET_BY_CODE,
  SETS,
  type SetCode,
} from "@/lib/sets";

type PriceMode = "low" | "trend" | "avg30";
type FilterKind =
  | "all"
  | "numbered"
  | "alternate"
  | "overnumbered"
  | "signature"
  | "extras"
  | SpecialCategory;
type SortMode = "number" | "name" | "price-desc" | "price-asc";

const PAGE_SIZE = 50;

const EURO = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const RARITY_LABELS: Record<string, string> = {
  Common: "Commune",
  Uncommon: "Peu commune",
  Rare: "Rare",
  Epic: "Épique",
  Showcase: "Showcase",
  Ultimate: "Ultimate",
  Special: "Spéciale",
};

const RARITY_ORDER = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Showcase",
  "Ultimate",
  "Special",
  "—",
];

type FilterDefinition = { id: FilterKind; label: string };

const FILTERS_BY_SET: Record<SetCode, FilterDefinition[]> = {
  OGN: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
  SFD: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
  UNL: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "signature", label: "Signées" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "sfd-reprint", label: "SFD Reprint" },
    { id: "nashor", label: "Nashor" },
    { id: "extras", label: "Runes & tokens" },
  ],
  VEN: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "signature", label: "Signées" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "sfd-reprint", label: "SFD Reprint" },
    { id: "unl-reprint", label: "UNL Reprint" },
    { id: "crystal-rose", label: "Crystal Rose" },
    { id: "extras", label: "Runes & tokens" },
  ],
};

function isSpecialFilter(filter: FilterKind): filter is SpecialCategory {
  return (
    filter === "ogn-reprint" ||
    filter === "sfd-reprint" ||
    filter === "unl-reprint" ||
    filter === "nashor" ||
    filter === "crystal-rose"
  );
}

function matchesSpecialFilter(row: CatalogRow, filter: SpecialCategory) {
  if (filter === "ogn-reprint") return row.originSet === "OGN";
  if (filter === "sfd-reprint") return row.originSet === "SFD";
  if (filter === "unl-reprint") return row.originSet === "UNL";
  return row.specialEdition === filter;
}

function metricValue(series: PriceSeries, mode: PriceMode) {
  const value = series[mode];
  return value !== null && value > 0 ? value : null;
}

function formatPrice(value: number | null) {
  return value === null ? "—" : EURO.format(value);
}

function variantsOf(row: CatalogRow, kind: VariantKind) {
  return row.variants.filter((variant) => variant.kind === kind);
}

function associatedVariantsOf(row: CatalogRow, kind: VariantKind) {
  return row.associatedVariants.filter((variant) => variant.kind === kind);
}

function variantsForFilter(row: CatalogRow, filter: FilterKind) {
  if (filter === "all") return row.variants;
  if (filter === "numbered") {
    return row.isNumbered ? variantsOf(row, "base") : [];
  }
  if (filter === "extras") return row.isExtra ? row.variants : [];
  if (isSpecialFilter(filter)) {
    if (!matchesSpecialFilter(row, filter)) return [];
    if (filter === "crystal-rose") return variantsOf(row, "alternate");
    return row.variants.filter(
      (variant) =>
        variant.kind === "overnumbered" || variant.kind === "signature",
    );
  }

  return variantsOf(row, filter);
}

function variantForDisplay(
  row: CatalogRow,
  filter: FilterKind,
  rarity: string,
) {
  const candidates = variantsForFilter(row, filter);
  if (rarity !== "all") {
    const rarityMatch = candidates.find(
      (variant) => variant.rarity === rarity,
    );
    if (rarityMatch) return rarityMatch;
  }

  return (
    candidates[0] ??
    row.variants.find((variant) => variant.kind === "base") ??
    row.variants[0]
  );
}

function maxPrice(
  row: CatalogRow,
  mode: PriceMode,
  filter: FilterKind,
  rarity: string,
) {
  const relevantVariants = variantsForFilter(row, filter).filter(
    (variant) => rarity === "all" || variant.rarity === rarity,
  );
  const values = relevantVariants.flatMap((variant) => [
    metricValue(variant.standard, mode),
    metricValue(variant.foil, mode),
  ]);
  return Math.max(0, ...values.filter((value): value is number => value !== null));
}

function associatedMaxPrice(row: CatalogRow, mode: PriceMode) {
  const values = row.associatedVariants.flatMap((variant) => [
    metricValue(variant.standard, mode),
    metricValue(variant.foil, mode),
  ]);
  return Math.max(0, ...values.filter((value): value is number => value !== null));
}

function rarityLabel(rarity: string) {
  return RARITY_LABELS[rarity] ?? rarity;
}

function kindLabel(kind: VariantKind) {
  if (kind === "base") return "Normale";
  if (kind === "alternate") return "Alternative";
  if (kind === "overnumbered") return "Outnumbered";
  if (kind === "signature") return "Signée";
  return "Variante";
}

function modeLabel(mode: PriceMode) {
  if (mode === "low") return "À partir de";
  if (mode === "trend") return "Tendance";
  return "Moyenne 30 j";
}

type PreviewPlacement = {
  left: number;
  top: number;
  width: number;
};

type PreviewState =
  | { mode: "hover"; placement: PreviewPlacement }
  | { mode: "dialog" };

const CARD_ASPECT_RATIO = 63 / 88;

function previewPlacement(rect: DOMRect): PreviewPlacement {
  const margin = 14;
  const gap = 18;
  const maximumWidth = Math.min(430, window.innerWidth - margin * 2);
  const maximumHeight = Math.min(660, window.innerHeight - margin * 2);
  const width = Math.min(maximumWidth, maximumHeight * CARD_ASPECT_RATIO);
  const height = width / CARD_ASPECT_RATIO;

  let left: number;
  if (rect.right + gap + width <= window.innerWidth - margin) {
    left = rect.right + gap;
  } else if (rect.left - gap - width >= margin) {
    left = rect.left - gap - width;
  } else {
    left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - margin - width,
    );
  }

  const top = Math.min(
    Math.max(margin, rect.top + rect.height / 2 - height / 2),
    window.innerHeight - margin - height,
  );

  return { left, top, width };
}

function CardPreviewThumb({
  className,
  imageUrl,
  name,
}: {
  className: string;
  imageUrl: string | null;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const suppressFocusPreviewRef = useRef(false);

  function openHoverPreview() {
    if (!imageUrl || failed || !triggerRef.current) return;
    setPreview({
      mode: "hover",
      placement: previewPlacement(triggerRef.current.getBoundingClientRect()),
    });
  }

  function closePreview(restoreFocus = false) {
    setPreview(null);
    if (restoreFocus) {
      suppressFocusPreviewRef.current = true;
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
        suppressFocusPreviewRef.current = false;
      });
    }
  }

  useEffect(() => {
    if (!preview) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && preview.mode === "dialog") {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") return;
      const restoreFocus = preview.mode === "dialog";
      setPreview(null);
      if (restoreFocus) {
        suppressFocusPreviewRef.current = true;
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
          suppressFocusPreviewRef.current = false;
        });
      }
    };
    const handleViewportChange = () => {
      if (preview.mode === "hover") setPreview(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    let focusFrame = 0;
    const previousBodyOverflow = document.body.style.overflow;
    if (preview.mode === "dialog") {
      document.body.style.overflow = "hidden";
      focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
      if (preview.mode === "dialog") {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [preview]);

  if (!imageUrl || failed) {
    return (
      <div className={`${className} card-preview-unavailable`}>
        <span aria-hidden="true">◇</span>
      </div>
    );
  }

  const previewLayer = preview
    ? createPortal(
        preview.mode === "hover" ? (
          <div
            className="card-preview-popover"
            style={preview.placement}
            role="img"
            aria-label={`Aperçu agrandi de la carte ${name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" />
          </div>
        ) : (
          <div
            className="card-preview-backdrop"
            role="presentation"
            onPointerDown={() => closePreview(true)}
          >
            <div
              className="card-preview-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`Aperçu agrandi de la carte ${name}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                ref={closeRef}
                className="card-preview-close"
                type="button"
                aria-label="Fermer l’aperçu"
                onClick={() => closePreview(true)}
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={`Carte ${name}`} />
              <p>{name}</p>
            </div>
          </div>
        ),
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        className={`${className} card-preview-trigger`}
        type="button"
        aria-label={`Agrandir la carte ${name}`}
        title="Survoler pour agrandir · cliquer pour ouvrir"
        onPointerEnter={() => {
          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            openHoverPreview();
          }
        }}
        onPointerLeave={() => {
          setPreview((current) =>
            current?.mode === "hover" ? null : current,
          );
        }}
        onFocus={() => {
          if (
            !suppressFocusPreviewRef.current &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches
          ) {
            openHoverPreview();
          }
        }}
        onBlur={() => {
          setPreview((current) =>
            current?.mode === "hover" ? null : current,
          );
        }}
        onClick={() => setPreview({ mode: "dialog" })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => {
            setFailed(true);
            setPreview(null);
          }}
        />
        <span className="card-preview-icon" aria-hidden="true">
          ⌕
        </span>
      </button>
      {previewLayer}
    </>
  );
}

function PriceCell({
  row,
  column,
  mode,
}: {
  row: CatalogRow;
  column: "normal" | "foil" | "alternate" | "overnumbered" | "signature";
  mode: PriceMode;
}) {
  const base = row.associatedVariants.find(
    (variant) => variant.kind === "base",
  );
  let variants: CatalogVariant[] = [];
  let primary: number | null = null;
  let secondary: number | null = null;

  if (column === "normal") {
    primary = base ? metricValue(base.standard, mode) : null;
  } else if (column === "foil") {
    primary = base ? metricValue(base.foil, mode) : null;
  } else {
    const kind =
      column === "alternate"
        ? "alternate"
        : column === "overnumbered"
          ? "overnumbered"
          : "signature";
    variants = associatedVariantsOf(row, kind);
    const first = variants[0];
    if (first) {
      primary =
        metricValue(first.standard, mode) ?? metricValue(first.foil, mode);
      if (column === "alternate") {
        secondary = metricValue(first.foil, mode);
        if (secondary === primary) secondary = null;
      }
    }
  }

  return (
    <div className={`price-cell ${primary === null ? "is-empty" : ""}`}>
      <span className="price-value">{formatPrice(primary)}</span>
      {secondary !== null ? (
        <span className="price-note">foil {formatPrice(secondary)}</span>
      ) : variants.length > 1 ? (
        <span className="price-note">+{variants.length - 1} variante</span>
      ) : null}
    </div>
  );
}

function VariantDetails({ row, mode }: { row: CatalogRow; mode: PriceMode }) {
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
        {row.associatedVariants.map((variant) => (
          <article className="variant-card" key={variant.id}>
            <CardPreviewThumb
              className="variant-thumb"
              imageUrl={variant.imageUrl}
              name={`${variant.name} — ${kindLabel(variant.kind)}`}
            />
            <div className="variant-copy">
              <div className="variant-title-line">
                <span className={`variant-kind kind-${variant.kind}`}>
                  {kindLabel(variant.kind)}
                </span>
                <span className="variant-number">{variant.number}</span>
              </div>
              <strong>{variant.name}</strong>
              <div className="variant-prices">
                <span>
                  Normal
                  <b>{formatPrice(metricValue(variant.standard, mode))}</b>
                </span>
                <span>
                  Foil
                  <b>{formatPrice(metricValue(variant.foil, mode))}</b>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CatalogLoading() {
  return (
    <div className="catalog-loading" aria-label="Chargement du catalogue">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="skeleton skeleton-image" />
          <span className="skeleton skeleton-copy" />
          <span className="skeleton skeleton-price" />
          <span className="skeleton skeleton-price" />
          <span className="skeleton skeleton-price" />
        </div>
      ))}
    </div>
  );
}

export function CatalogPage({ setCode }: { setCode: SetCode }) {
  const set = SET_BY_CODE[setCode];
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [sortMode, setSortMode] = useState<SortMode>("number");
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const availableFilters = FILTERS_BY_SET[setCode];
  const activeFilterKind = availableFilters.some(
    (filter) => filter.id === filterKind,
  )
    ? filterKind
    : "all";

  const loadCatalog = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/catalog?set=${setCode}${refresh ? "&refresh=1" : ""}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Le catalogue n'a pas pu être chargé.");
        const nextPayload = (await response.json()) as CatalogPayload;
        setPayload(nextPayload);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Le catalogue n'a pas pu être chargé.",
        );
      } finally {
        setLoading(false);
      }
    },
    [setCode],
  );

  useEffect(() => {
    let active = true;
    fetch(`/api/catalog?set=${setCode}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Le catalogue n'a pas pu être chargé.");
        return response.json() as Promise<CatalogPayload>;
      })
      .then((nextPayload) => {
        if (!active) return;
        setPayload(nextPayload);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Le catalogue n'a pas pu être chargé.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setCode]);

  const rarities = useMemo(() => {
    if (!payload) return [];
    return [
      ...new Set(
        payload.rows.flatMap((row) =>
          row.variants.map((variant) => variant.rarity),
        ),
      ),
    ].sort((a, b) => RARITY_ORDER.indexOf(a) - RARITY_ORDER.indexOf(b));
  }, [payload]);

  const filteredRows = useMemo(() => {
    if (!payload) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    const rows = payload.rows.filter((row) => {
      const relevantVariants = variantsForFilter(row, activeFilterKind);
      const matchesQuery =
        !normalizedQuery ||
        row.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        row.number.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        row.variants.some(
          (variant) =>
            variant.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
            variant.number.toLocaleLowerCase("fr").includes(normalizedQuery),
        ) ||
        row.domains.some((domain) =>
          domain.toLocaleLowerCase("fr").includes(normalizedQuery),
        );
      const matchesKind = relevantVariants.length > 0;
      const matchesRarity =
        rarity === "all" ||
        relevantVariants.some((variant) => variant.rarity === rarity);

      return matchesQuery && matchesRarity && matchesKind;
    });

    return rows.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "fr");
      if (sortMode === "price-desc") {
        const difference =
          associatedMaxPrice(b, priceMode) - associatedMaxPrice(a, priceMode);
        if (difference !== 0) return difference;
        return a.sortOrder - b.sortOrder;
      }
      if (sortMode === "price-asc") {
        const aValue =
          maxPrice(a, priceMode, activeFilterKind, rarity) ||
          Number.POSITIVE_INFINITY;
        const bValue =
          maxPrice(b, priceMode, activeFilterKind, rarity) ||
          Number.POSITIVE_INFINITY;
        return aValue - bValue;
      }
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name, "fr");
    });
  }, [payload, query, rarity, activeFilterKind, sortMode, priceMode]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const remainingCount = Math.max(0, filteredRows.length - visibleRows.length);
  const nextBatchCount = Math.min(PAGE_SIZE, remainingCount);
  const activeFilterLabel =
    availableFilters.find((filter) => filter.id === activeFilterKind)?.label ??
    "Toutes";
  const style = {
    "--set-accent": set.accent,
    "--set-accent-soft": set.accentSoft,
  } as CSSProperties;

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="site-shell" style={style}>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Catalogue Riftbound">
          <span className="brand-mark" aria-hidden="true">
            ◇
          </span>
          <span>
            <strong>RIFTBOUND</strong>
            <small>Catalogue & prix</small>
          </span>
        </Link>
        <nav className="set-nav" aria-label="Choisir un set">
          {SETS.map((item) => (
            <Link
              href={getSetHref(item.code)}
              key={item.code}
              aria-current={item.code === setCode ? "page" : undefined}
            >
              <span>{String(item.number).padStart(2, "0")}</span>
              {item.name}
            </Link>
          ))}
        </nav>
      </header>

      <main>
        <section className="set-hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow">
              Set {String(set.number).padStart(2, "0")} <span>·</span> {set.code}
            </p>
            <h1>{set.name}</h1>
            <p className="hero-subtitle">{set.subtitle}</p>
            <div className="hero-meta">
              <span>Sortie : {set.release}</span>
              <span>{set.baseSize} cartes dans le set numéroté</span>
            </div>
          </div>
          <div className="hero-sigil" aria-hidden="true">
            <span>{set.code}</span>
          </div>
        </section>

        <section className="catalog-wrap" aria-labelledby="catalog-title">
          <div className="catalog-intro">
            <div>
              <p className="eyebrow">Catalogue vivant</p>
              <h2 id="catalog-title">Toutes les cartes, toutes les finitions</h2>
              <p>
                Normal, foil, alternatives, outnumbered et signatures réunis
                sur une seule ligne par carte.
              </p>
            </div>
            {payload ? (
              <div className="update-card">
                <span
                  className={`live-dot ${payload.sourceStatus === "snapshot" ? "snapshot" : ""}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>
                    {payload.sourceStatus === "live"
                      ? "Guide Cardmarket à jour"
                      : "Dernier relevé disponible"}
                  </strong>
                  <span>{DATE.format(new Date(payload.pricesUpdatedAt))}</span>
                </div>
                <button type="button" onClick={() => void loadCatalog(true)}>
                  Actualiser
                </button>
              </div>
            ) : null}
          </div>

          {payload ? (
            <div className="stat-strip" aria-label="Résumé du set">
              <div>
                <span>Cartes</span>
                <strong>{payload.stats.cards}</strong>
              </div>
              <div>
                <span>Produits cotés</span>
                <strong>{payload.stats.products}</strong>
              </div>
              <div>
                <span>Alternatives</span>
                <strong>{payload.stats.alternatives}</strong>
              </div>
              <div>
                <span>Outnumbered</span>
                <strong>{payload.stats.overnumbered}</strong>
              </div>
              <div>
                <span>Signées</span>
                <strong>{payload.stats.signatures}</strong>
              </div>
            </div>
          ) : null}

          <div className="filter-shell">
            <div className="filter-primary">
              <label className="search-field">
                <span className="sr-only">Rechercher une carte</span>
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
                  placeholder="Nom, numéro, domaine…"
                />
              </label>
              <label className="select-field">
                <span>Rareté</span>
                <select
                  value={rarity}
                  onChange={(event) => {
                    setRarity(event.target.value);
                    setVisibleCount(PAGE_SIZE);
                  }}
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
                  onChange={(event) => {
                    setSortMode(event.target.value as SortMode);
                    setVisibleCount(PAGE_SIZE);
                  }}
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
                  onChange={(event) => {
                    setPriceMode(event.target.value as PriceMode);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <option value="low">Prix minimum</option>
                  <option value="trend">Tendance Cardmarket</option>
                  <option value="avg30">Moyenne 30 jours</option>
                </select>
              </label>
            </div>
            <div className="filter-tabs" role="group" aria-label="Type de carte">
              {availableFilters.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  className={activeFilterKind === filter.id ? "is-active" : ""}
                  onClick={() => {
                    setFilterKind(filter.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="result-line" aria-live="polite">
            <span>
              <strong>{filteredRows.length}</strong> carte
              {filteredRows.length > 1 ? "s" : ""}
            </span>
            <span className="result-meta">
              <span className="preview-hint preview-hint-hover">
                Survole une carte pour l’agrandir
              </span>
              <span className="preview-hint preview-hint-touch">
                Touche une carte pour l’agrandir
              </span>
              <span aria-hidden="true">·</span>
              {modeLabel(priceMode)} · EUR
            </span>
          </div>

          {loading ? <CatalogLoading /> : null}
          {error ? (
            <div className="error-card" role="alert">
              <span aria-hidden="true">!</span>
              <div>
                <strong>Impossible de charger les prix.</strong>
                <p>{error}</p>
              </div>
              <button type="button" onClick={() => void loadCatalog(true)}>
                Réessayer
              </button>
            </div>
          ) : null}

          {!loading && !error && payload ? (
            <div className="catalog-table">
              <div className="catalog-head" aria-hidden="true">
                <span>Carte</span>
                <span>Normal</span>
                <span>Foil</span>
                <span>Alternative</span>
                <span>Outnumbered</span>
                <span>Signée</span>
                <span />
              </div>
              <div className="catalog-rows">
                {visibleRows.map((row) => {
                  const isOpen = expanded.has(row.id);
                  const displayVariant = variantForDisplay(
                    row,
                    activeFilterKind,
                    rarity,
                  );
                  const displayRarity = displayVariant?.rarity ?? row.rarity;
                  const displayNumber =
                    displayVariant?.number && displayVariant.number !== "—"
                      ? displayVariant.number
                      : row.number;
                  return (
                    <article className={`catalog-row ${isOpen ? "is-open" : ""}`} key={row.id}>
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
                              <span
                                className={`rarity rarity-${displayRarity.toLowerCase()}`}
                              >
                                {rarityLabel(displayRarity)}
                              </span>
                              {isSpecialFilter(activeFilterKind) &&
                              matchesSpecialFilter(row, activeFilterKind) ? (
                                <span className="reprint-badge">
                                  {activeFilterLabel}
                                </span>
                              ) : null}
                            </div>
                            <h3>{row.name}</h3>
                            <p>
                              {row.type}
                              {row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}
                            </p>
                          </div>
                        </div>
                        <PriceCell row={row} column="normal" mode={priceMode} />
                        <PriceCell row={row} column="foil" mode={priceMode} />
                        <PriceCell row={row} column="alternate" mode={priceMode} />
                        <PriceCell row={row} column="overnumbered" mode={priceMode} />
                        <PriceCell row={row} column="signature" mode={priceMode} />
                        <button
                          className="expand-button"
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Masquer" : "Afficher"} les variantes de ${row.name}`}
                          onClick={() => toggleExpanded(row.id)}
                        >
                          <span aria-hidden="true">⌄</span>
                        </button>
                      </div>
                      {isOpen ? <VariantDetails row={row} mode={priceMode} /> : null}
                    </article>
                  );
                })}
              </div>

              {visibleRows.length === 0 ? (
                <div className="empty-state">
                  <span aria-hidden="true">◇</span>
                  <h3>Aucune carte ne correspond.</h3>
                  <p>Essaie un autre nom ou retire un filtre.</p>
                </div>
              ) : null}

              {remainingCount > 0 ? (
                <div className="load-controls">
                  <button
                    className="load-more"
                    type="button"
                    onClick={() =>
                      setVisibleCount((count) => count + PAGE_SIZE)
                    }
                  >
                    Afficher {nextBatchCount} carte
                    {nextBatchCount > 1 ? "s" : ""} de plus
                  </button>
                  <span className="load-separator" aria-hidden="true">
                    ·
                  </span>
                  <button
                    className="show-all"
                    type="button"
                    onClick={() => setVisibleCount(filteredRows.length)}
                  >
                    Tout afficher
                  </button>
                  <span className="load-progress">
                    {visibleRows.length} / {filteredRows.length}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <aside className="pricing-note">
            <span aria-hidden="true">i</span>
            <div>
              <strong>Comment lire les prix</strong>
              <p>
                Le « prix minimum » provient du guide public Cardmarket et peut
                inclure plusieurs langues ou états. Il ne garantit donc pas une
                offre française Near Mint. Utilise le lien Cardmarket dans le
                détail d’une carte pour vérifier les annonces disponibles.
              </p>
            </div>
          </aside>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <strong>Riftbound — Catalogue & prix</strong>
          <p>
            Projet de collection non officiel. Riftbound et League of Legends
            appartiennent à Riot Games.
          </p>
        </div>
        <p>Données de marché : guide public Cardmarket, actualisé quotidiennement.</p>
      </footer>
    </div>
  );
}
