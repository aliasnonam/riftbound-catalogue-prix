"use client";

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
  CatalogRow as CatalogRowData,
} from "@/lib/catalog";
import { formatCardmarketSyncDate } from "@/lib/cardmarket-date";
import { isRefreshCooldownActive } from "@/lib/cardmarket-cooldown";
import {
  FILTERS_BY_SET,
  type FilterKind,
} from "@/lib/catalog-presentation";
import {
  compareByEffectivePrice,
  type PriceMode,
} from "@/lib/pricing";
import {
  SET_BY_CODE,
  type SetCode,
} from "@/lib/sets";
import { SiteHeader } from "@/app/components/site-header";
import { CatalogRow } from "@/app/components/catalog/CatalogRow";
import { CatalogFilters } from "@/app/components/catalog/CatalogFilters";
import { StatsStrip } from "@/app/components/catalog/StatsStrip";
import { HeroCardDialog } from "@/app/components/hero/HeroCardDialog";
import { OriginsGallery } from "@/app/components/galleries/OriginsGallery";
import { RivalsGallery } from "@/app/components/galleries/RivalsGallery";
import type {
  HeroPreviewCard,
  RivalDiptych,
} from "@/app/components/hero/types";
import {
  RARITY_ORDER,
  variantForDisplay,
  variantsForFilter,
} from "@/app/components/catalog/catalog-utils";

type SortMode = "number" | "name" | "price-desc" | "price-asc";
type RefreshState = "idle" | "loading" | "success" | "error";

type CatalogRefreshResponse = {
  payload: CatalogPayload;
  refreshStatus: "updated" | "unchanged";
  updatedProducts: number;
};

type CatalogCooldownResponse = {
  error: "Réessayer plus tard";
  pricesUpdatedAt: string;
  refreshAvailableAt: string;
};

const PAGE_SIZE = 50;

const VENDETTA_RIVAL_CARDS = {
  vi: {
    name: "Vi, Destructive",
    imageUrl:
      "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/dff596efc7413bfdd9cc8e667c46bd4228447de5-744x1039.png?accountingTag=RB",
  },
  jinx: {
    name: "Jinx, Demolitionist",
    imageUrl:
      "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/3a7304f3c9897967812940838e978e54e251e545-744x1039.png?accountingTag=RB",
  },
} as const;

const FEATURED_HERO_CARDS: Partial<
  Record<SetCode, HeroPreviewCard>
> = {
  SFD: {
    number: "227*",
    name: "Ahri, Inquisitive — signée",
    imageUrl: "/hero/sfd-ahri-signed.webp",
  },
  UNL: {
    number: "238",
    name: "Baron Nashor",
    imageUrl: "/hero/unl-baron-nashor.webp",
  },
};

const ORIGINS_SIGNED_HERO_CARDS = [
  {
    number: "299*",
    name: "Kai’Sa — Daughter of the Void",
    imageUrl: "/hero/ogn-299-signed.webp",
  },
  {
    number: "300*",
    name: "Volibear — Relentless Storm",
    imageUrl: "/hero/ogn-300-signed.webp",
  },
  {
    number: "301*",
    name: "Jinx — Loose Cannon",
    imageUrl: "/hero/ogn-301-signed.webp",
  },
  {
    number: "302*",
    name: "Darius — Hand of Noxus",
    imageUrl: "/hero/ogn-302-signed.webp",
  },
  {
    number: "303*",
    name: "Ahri — Nine-Tailed Fox",
    imageUrl: "/hero/ogn-303-signed.webp",
  },
  {
    number: "304*",
    name: "Lee Sin — Blind Monk",
    imageUrl: "/hero/ogn-304-signed.webp",
  },
  {
    number: "305*",
    name: "Yasuo — Unforgiven",
    imageUrl: "/hero/ogn-305-signed.webp",
  },
  {
    number: "306*",
    name: "Leona — Radiant Dawn",
    imageUrl: "/hero/ogn-306-signed.webp",
  },
  {
    number: "307*",
    name: "Teemo — Swift Scout",
    imageUrl: "/hero/ogn-307-signed.webp",
  },
  {
    number: "308*",
    name: "Viktor — Herald of the Arcane",
    imageUrl: "/hero/ogn-308-signed.webp",
  },
  {
    number: "309*",
    name: "Miss Fortune — Bounty Hunter",
    imageUrl: "/hero/ogn-309-signed.webp",
  },
  {
    number: "310*",
    name: "Sett — The Boss",
    imageUrl: "/hero/ogn-310-signed.webp",
  },
] as const;

const RIVAL_DIPTYCHES: readonly RivalDiptych[] = [
  {
    imageUrl: "/hero/rivals/01-vi-jinx.png",
    cards: [
      { number: 167, name: "Vi, Destructive" },
      { number: 168, name: "Jinx, Demolitionist" },
    ],
  },
  {
    imageUrl: "/hero/rivals/02-zed-shen.png",
    cards: [
      { number: 169, name: "Zed, From the Shadows" },
      { number: 170, name: "Shen, Scourge of Shadows" },
    ],
  },
  {
    imageUrl: "/hero/rivals/03-riven-draven.png",
    cards: [
      { number: 171, name: "Riven, Shattered" },
      { number: 172, name: "Draven, Showboat" },
    ],
  },
  {
    imageUrl: "/hero/rivals/04-swain-irelia.png",
    cards: [
      { number: 173, name: "Swain, Visionary" },
      { number: 174, name: "Irelia, Fervent" },
    ],
  },
  {
    imageUrl: "/hero/rivals/05-jayce-viktor.png",
    cards: [
      { number: 175, name: "Jayce, Man of Progress" },
      { number: 176, name: "Viktor, Innovator" },
    ],
  },
  {
    imageUrl: "/hero/rivals/06-renekton-nasus.png",
    cards: [
      { number: 177, name: "Renekton, Brute" },
      { number: 178, name: "Nasus, Guardian of Knowledge" },
    ],
  },
  {
    imageUrl: "/hero/rivals/07-rengar-khazix.png",
    cards: [
      { number: 179, name: "Rengar, Trophy Hunter" },
      { number: 180, name: "Kha’Zix, Evolving Hunter" },
    ],
  },
  {
    imageUrl: "/hero/rivals/08-gangplank-illaoi.png",
    cards: [
      { number: 181, name: "Gangplank, Naval" },
      { number: 182, name: "Illaoi, Prophet of the Great Kraken" },
    ],
  },
  {
    imageUrl: "/hero/rivals/09-diana-leona.png",
    cards: [
      { number: 183, name: "Diana, No Longer Human" },
      { number: 184, name: "Leona, Determined" },
    ],
  },
  {
    imageUrl: "/hero/rivals/10-kayle-morgana.png",
    cards: [
      { number: 185, name: "Kayle, Justified" },
      { number: 186, name: "Morgana, Vindictive" },
    ],
  },
  {
    imageUrl: "/hero/rivals/11-ambessa-mel.png",
    cards: [
      { number: 187, name: "Ambessa, Respected and Feared" },
      { number: 188, name: "Mel, Defiant Soul" },
    ],
  },
] as const;

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
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [cooldownClock, setCooldownClock] = useState(() => Date.now());
  const [heroPreview, setHeroPreview] = useState<HeroPreviewCard | null>(null);
  const [originsGalleryIndex, setOriginsGalleryIndex] = useState<number | null>(
    null,
  );
  const [rivalsGalleryOpen, setRivalsGalleryOpen] = useState(false);
  const refreshResetTimerRef = useRef<number | null>(null);
  const filterTabsRef = useRef<HTMLDivElement | null>(null);
  const availableFilters = FILTERS_BY_SET[setCode];
  const activeFilterKind = availableFilters.some(
    (filter) => filter.id === filterKind,
  )
    ? filterKind
    : "all";

  const loadCatalog = useCallback(
    async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/catalog?set=${setCode}`, {
          cache: "no-store",
        });
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

  const refreshCatalog = useCallback(async () => {
    if (refreshResetTimerRef.current !== null) {
      window.clearTimeout(refreshResetTimerRef.current);
      refreshResetTimerRef.current = null;
    }
    setRefreshState("loading");

    try {
      const response = await fetch(`/api/catalog/refresh?set=${setCode}`, {
        method: "POST",
        cache: "no-store",
      });
      if (response.status === 429) {
        const result = (await response.json()) as CatalogCooldownResponse;
        setPayload((current) =>
          current
            ? {
                ...current,
                pricesUpdatedAt: result.pricesUpdatedAt,
                refreshAvailableAt: result.refreshAvailableAt,
              }
            : current,
        );
        setCooldownClock(Date.now());
        setRefreshState("idle");
        return;
      }
      if (!response.ok) throw new Error("Cardmarket refresh failed");
      const result = (await response.json()) as CatalogRefreshResponse;
      setPayload(result.payload);
      setError(null);
      setRefreshState("success");
      refreshResetTimerRef.current = window.setTimeout(() => {
        setRefreshState("idle");
        refreshResetTimerRef.current = null;
      }, 2500);
    } catch {
      setRefreshState("error");
      refreshResetTimerRef.current = window.setTimeout(() => {
        setRefreshState("idle");
        refreshResetTimerRef.current = null;
      }, 4000);
    }
  }, [setCode]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setCooldownClock(Date.now());
    }, 0);
    const availableTime = payload?.refreshAvailableAt
      ? Date.parse(payload.refreshAvailableAt)
      : Number.NaN;
    const remaining = availableTime - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      return () => window.clearTimeout(syncTimer);
    }

    const expiryTimer = window.setTimeout(() => {
      setCooldownClock(Date.now());
    }, remaining + 50);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [payload?.refreshAvailableAt]);

  useEffect(() => {
    let active = true;
    if (refreshResetTimerRef.current !== null) {
      window.clearTimeout(refreshResetTimerRef.current);
      refreshResetTimerRef.current = null;
    }
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
      if (refreshResetTimerRef.current !== null) {
        window.clearTimeout(refreshResetTimerRef.current);
        refreshResetTimerRef.current = null;
      }
    };
  }, [setCode]);

  useEffect(() => {
    const tabs = filterTabsRef.current;
    if (!tabs) return;

    tabs.scrollLeft = 0;
    setHeroPreview(null);
    setOriginsGalleryIndex(null);
    setRivalsGalleryOpen(false);
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

  const rivalCatalogCards = useMemo(() => {
    const cards: Record<number, HeroPreviewCard> = {};
    if (!payload || setCode !== "VEN") return cards;

    const variants = payload.rows.flatMap((row) => [
      ...row.variants,
      ...row.associatedVariants,
    ]);

    for (const diptych of RIVAL_DIPTYCHES) {
      for (const definition of diptych.cards) {
        const matchingVariants = variants.filter((variant) => {
          const number = variant.number.match(/\d+/)?.[0];
          return Number(number) === definition.number && variant.imageUrl;
        });
        const variant =
          matchingVariants.find(
            (candidate) => candidate.kind === "overnumbered",
          ) ?? matchingVariants[0];

        if (variant?.imageUrl) {
          cards[definition.number] = {
            number: variant.number,
            name: definition.name,
            imageUrl: variant.imageUrl,
          };
        }
      }
    }

    return cards;
  }, [payload, setCode]);

  const filteredRows = (() => {
    if (!payload) return [] as CatalogRowData[];
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

    const sortableRows = rows.map((row) => ({
      row,
      displayedVariant: variantForDisplay(row, activeFilterKind, rarity),
    }));

    return sortableRows.sort((a, b) => {
      if (sortMode === "name") {
        return a.row.name.localeCompare(b.row.name, "fr");
      }
      if (sortMode === "price-desc") {
        return compareByEffectivePrice(a, b, priceMode, "desc");
      }
      if (sortMode === "price-asc") {
        return compareByEffectivePrice(a, b, priceMode, "asc");
      }
      if (a.row.sortOrder !== b.row.sortOrder) {
        return a.row.sortOrder - b.row.sortOrder;
      }
      return a.row.name.localeCompare(b.row.name, "fr");
    }).map(({ row }) => row);
  })();

  const visibleRows = filteredRows.slice(0, visibleCount);
  const remainingCount = Math.max(0, filteredRows.length - visibleRows.length);
  const nextBatchCount = Math.min(PAGE_SIZE, remainingCount);
  const refreshBlocked = isRefreshCooldownActive(
    payload?.refreshAvailableAt ?? null,
    cooldownClock,
  );
  const style = {
    "--set-accent": set.accent,
    "--set-accent-soft": set.accentSoft,
  } as CSSProperties;
  const featuredHeroCard = FEATURED_HERO_CARDS[setCode];
  const heroClassName = [
    "set-hero",
    `set-hero--${setCode.toLowerCase()}`,
    setCode === "VEN"
      ? "set-hero--rivals"
      : setCode === "OGN"
        ? "set-hero--binder"
        : featuredHeroCard
          ? "set-hero--featured-card"
          : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      <SiteHeader activeSetCode={setCode} />

      <main>
        <section className={heroClassName}>
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
            {setCode === "VEN" || setCode === "OGN" ? (
              <button
                className="hero-gallery-cta"
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  if (setCode === "VEN") setRivalsGalleryOpen(true);
                  else setOriginsGalleryIndex(0);
                }}
              >
                {setCode === "VEN"
                  ? "Voir les 11 diptyques Rivals"
                  : "Voir les 12 Outnumbered signées"} {" "}
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
          {setCode === "VEN" ? (
            <figure
              className="rival-hero-cards"
              aria-label="Diptyque Rival Overnumbered : Vi face à Jinx"
            >
              <button
                className="rival-hero-card rival-hero-card--vi"
                type="button"
                aria-label="Voir les 11 diptyques Rivals à partir de Vi"
                aria-haspopup="dialog"
                onClick={() => setRivalsGalleryOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={VENDETTA_RIVAL_CARDS.vi.imageUrl}
                  alt={`Carte ${VENDETTA_RIVAL_CARDS.vi.name}`}
                  decoding="async"
                />
              </button>
              <button
                className="rival-hero-card rival-hero-card--jinx"
                type="button"
                aria-label="Voir les 11 diptyques Rivals à partir de Jinx"
                aria-haspopup="dialog"
                onClick={() => setRivalsGalleryOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={VENDETTA_RIVAL_CARDS.jinx.imageUrl}
                  alt={`Carte ${VENDETTA_RIVAL_CARDS.jinx.name}`}
                  decoding="async"
                />
              </button>
            </figure>
          ) : setCode === "OGN" ? (
            <figure
              className="origins-binder-hero"
              aria-label="Planche de collection des 12 cartes signées Outnumbered d’Origins, de 299 à 310"
            >
              <div className="origins-binder-grid">
                {ORIGINS_SIGNED_HERO_CARDS.map((card, cardIndex) => (
                  <button
                    className="origins-binder-slot"
                    type="button"
                    aria-label={`Ouvrir la fiche de ${card.name}, ${card.number}`}
                    aria-haspopup="dialog"
                    onClick={() => setOriginsGalleryIndex(cardIndex)}
                    key={card.number}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.imageUrl}
                      alt={`Carte ${card.number} ${card.name}`}
                      decoding="async"
                    />
                    <small>{card.number}</small>
                  </button>
                ))}
              </div>
            </figure>
          ) : featuredHeroCard ? (
            <figure
              className={`featured-hero-card featured-hero-card--${setCode.toLowerCase()}`}
              aria-label={`Carte mise en avant : ${featuredHeroCard.name}`}
            >
              <button
                className="featured-hero-card-frame"
                type="button"
                aria-label={`Ouvrir la fiche de ${featuredHeroCard.name}`}
                aria-haspopup="dialog"
                onClick={() => setHeroPreview(featuredHeroCard)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featuredHeroCard.imageUrl}
                  alt={`Carte ${featuredHeroCard.name}`}
                  decoding="async"
                />
              </button>
            </figure>
          ) : (
            <div className="hero-sigil" aria-hidden="true">
              <span>{set.code}</span>
            </div>
          )}
        </section>

        <section className="catalog-wrap" aria-labelledby="catalog-title">
          <div className="catalog-intro">
            <div>
              <p className="eyebrow">Catalogue dynamique</p>
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
                  <span>{formatCardmarketSyncDate(payload.pricesUpdatedAt)}</span>
                </div>
                <button
                  className={`refresh-button is-${refreshState}${refreshBlocked ? " is-cooldown" : ""}`}
                  type="button"
                  disabled={refreshState === "loading" || refreshBlocked}
                  aria-live="polite"
                  onClick={() => void refreshCatalog()}
                >
                  {refreshState === "loading"
                    ? "Actualisation…"
                    : refreshState === "success"
                      ? "À jour ✓"
                      : refreshState === "error"
                        ? "Échec de l’actualisation"
                        : refreshBlocked
                          ? "Réessayer plus tard"
                          : "Actualiser"}
                </button>
              </div>
            ) : null}
          </div>

          {payload ? <StatsStrip stats={payload.stats} /> : null}

          <CatalogFilters
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              setVisibleCount(PAGE_SIZE);
            }}
            rarity={rarity}
            rarities={rarities}
            onRarityChange={(value) => {
              setRarity(value);
              setVisibleCount(PAGE_SIZE);
            }}
            sortMode={sortMode}
            onSortModeChange={(value) => {
              setSortMode(value);
              setVisibleCount(PAGE_SIZE);
            }}
            priceMode={priceMode}
            onPriceModeChange={(value) => {
              setPriceMode(value);
              setVisibleCount(PAGE_SIZE);
            }}
            filters={availableFilters}
            activeFilterKind={activeFilterKind}
            onFilterKindChange={(value) => {
              setFilterKind(value);
              setVisibleCount(PAGE_SIZE);
            }}
            tabsRef={filterTabsRef}
          />

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
              <button type="button" onClick={() => void loadCatalog()}>
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
              <div
                className="catalog-rows"
                key={`${setCode}-${activeFilterKind}-${rarity}-${sortMode}-${priceMode}`}
              >
                {visibleRows.map((row) => (
                  <CatalogRow
                    key={row.id}
                    row={row}
                    activeFilterKind={activeFilterKind}
                    rarity={rarity}
                    priceMode={priceMode}
                    setCode={setCode}
                    isOpen={expanded.has(row.id)}
                    onToggle={toggleExpanded}
                  />
                ))}
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

      {heroPreview ? (
        <HeroCardDialog
          card={heroPreview}
          onClose={() => setHeroPreview(null)}
        />
      ) : null}
      {originsGalleryIndex !== null ? (
        <OriginsGallery
          cards={ORIGINS_SIGNED_HERO_CARDS}
          initialIndex={originsGalleryIndex}
          onClose={() => setOriginsGalleryIndex(null)}
        />
      ) : null}
      {rivalsGalleryOpen ? (
        <RivalsGallery
          catalogCards={rivalCatalogCards}
          diptyches={RIVAL_DIPTYCHES}
          onClose={() => setRivalsGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}
