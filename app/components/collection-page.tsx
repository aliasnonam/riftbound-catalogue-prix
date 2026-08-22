"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { SiteHeader } from "@/app/components/site-header";
import type { CatalogPayload, CatalogVariant, VariantKind } from "@/lib/catalog";
import {
  flattenCatalogPayload,
  getCollectionPrice,
  type CollectionImpression,
} from "@/lib/collection";
import { getVariantFoilPrice, getVariantNormalPrice, type PriceMode } from "@/lib/pricing";
import { SETS, type SetCode } from "@/lib/sets";
import { useCollection } from "@/hooks/use-collection";

type CollectionView = "home" | "missing" | "owned";
type ListMode = "list" | "add";
type SortMode = "number" | "name" | "price-desc" | "price-asc";

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Showcase", "Ultimate", "Special"];
const RARITY_LABELS: Record<string, string> = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Epic: "Épique", Showcase: "Showcase", Ultimate: "Ultimate", Special: "Spéciale" };
const KIND_LABELS: Record<VariantKind, string> = { base: "Set", alternate: "Alternative", "crystal-rose": "Crystal Rose", overnumbered: "Outnumbered", signature: "Signée", other: "Spéciale" };

function formatPrice(value: number | null) { return value === null ? "—" : EURO.format(value); }
function labelForVariant(variant: CatalogVariant) { return variant.kind === "base" ? (RARITY_LABELS[variant.rarity] ?? variant.rarity) : KIND_LABELS[variant.kind]; }

function useAllImpressions() {
  const [payloads, setPayloads] = useState<CatalogPayload[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(SETS.map(async (set) => {
      const response = await fetch(`/api/catalog?set=${set.code}`, { cache: "no-store" });
      if (!response.ok) throw new Error("catalogue unavailable");
      return response.json() as Promise<CatalogPayload>;
    })).then((next) => { if (active) setPayloads(next); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return { impressions: payloads.flatMap(flattenCatalogPayload), loading: !error && payloads.length !== SETS.length, error };
}

function CollectionStatusButtons({ impression, compact = false }: { impression: CollectionImpression; compact?: boolean }) {
  const collection = useCollection();
  const status = collection.getStatus(impression.impressionId);
  return <div className={`collection-status-buttons${compact ? " is-compact" : ""}`} aria-label={`Statut de collection de ${impression.variant.name}`}>
    <button type="button" className={status === "owned" ? "is-active owned" : ""} onClick={() => collection.setOwned(impression.impressionId)}>Possédée</button>
    <button type="button" className={status === "missing" ? "is-active missing" : ""} onClick={() => collection.setMissing(impression.impressionId)}>Manquante</button>
    {status !== "unknown" ? <button type="button" className="clear" onClick={() => collection.clearStatus(impression.impressionId)}>Retirer</button> : null}
  </div>;
}

function Filters({ setFilter, onSetFilter, rarity, onRarity, kind, onKind, sort, onSort, priceMode, onPriceMode }: {
  setFilter: "all" | SetCode; onSetFilter: (value: "all" | SetCode) => void; rarity: string; onRarity: (value: string) => void; kind: "all" | VariantKind; onKind: (value: "all" | VariantKind) => void; sort: SortMode; onSort: (value: SortMode) => void; priceMode: PriceMode; onPriceMode: (value: PriceMode) => void;
}) {
  return <div className="collection-filters">
    <label><span>Set</span><select value={setFilter} onChange={(event) => onSetFilter(event.target.value as "all" | SetCode)}><option value="all">Tous les sets</option>{SETS.map((set) => <option value={set.code} key={set.code}>{set.name}</option>)}</select></label>
    <label><span>Rareté</span><select value={rarity} onChange={(event) => onRarity(event.target.value)}><option value="all">Toutes</option>{RARITIES.map((item) => <option value={item} key={item}>{RARITY_LABELS[item]}</option>)}</select></label>
    <label><span>Impression</span><select value={kind} onChange={(event) => onKind(event.target.value as "all" | VariantKind)}><option value="all">Toutes</option>{(Object.keys(KIND_LABELS) as VariantKind[]).map((item) => <option value={item} key={item}>{KIND_LABELS[item]}</option>)}</select></label>
    <label><span>Trier</span><select value={sort} onChange={(event) => onSort(event.target.value as SortMode)}><option value="number">Numéro</option><option value="name">Nom A–Z</option><option value="price-desc">Prix le plus élevé</option><option value="price-asc">Prix le plus bas</option></select></label>
    <label><span>Valeur affichée</span><select value={priceMode} onChange={(event) => onPriceMode(event.target.value as PriceMode)}><option value="low">Prix minimum</option><option value="trend">Tendance Cardmarket</option><option value="avg30">Moyenne 30 jours</option></select></label>
  </div>;
}

function ImpressionCard({ impression, priceMode, showStatus = true, action, onPreview }: { impression: CollectionImpression; priceMode: PriceMode; showStatus?: boolean; action?: ReactNode; onPreview: () => void }) {
  const { variant, row, setName } = impression;
  return <article className="collection-impression-card">
    <button className="collection-impression-preview" type="button" onClick={onPreview} disabled={!variant.imageUrl} aria-label={variant.imageUrl ? `Agrandir ${variant.name}` : undefined}>
      <span className="collection-impression-art">{variant.imageUrl ? <img src={variant.imageUrl} alt={`Carte ${variant.name}`} loading="lazy" /> : <span>◇</span>}</span>
      <span className="collection-impression-copy">
        <span className="collection-impression-kicker"><span>{setName}</span><b>{variant.number}</b><em>{labelForVariant(variant)}</em></span>
        <strong className="collection-impression-title">{variant.name}</strong>
        <span className="collection-impression-type">{row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</span>
        <span className="collection-impression-prices">
          {variant.pricing === "dual" ? <><span>Normal <b>{formatPrice(getVariantNormalPrice(variant, priceMode))}</b></span><span>Foil <b>{formatPrice(getVariantFoilPrice(variant, priceMode))}</b></span></> : <span>{labelForVariant(variant)} <b>{formatPrice(getCollectionPrice(impression, priceMode))}</b></span>}
        </span>
      </span>
    </button>
    {showStatus ? <CollectionStatusButtons impression={impression} compact /> : action}
  </article>;
}

function CollectionCardDialog({ impression, onClose }: { impression: CollectionImpression; onClose: () => void }) {
  const { variant, row, setName } = impression;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!variant.imageUrl) return null;
  return createPortal(
    <div className="card-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="card-preview-dialog" role="dialog" aria-modal="true" aria-label={`${variant.name}, ${variant.number}`}>
        <button className="card-preview-close" type="button" aria-label="Fermer l’aperçu" onClick={onClose}>×</button>
        <img src={variant.imageUrl} alt={`Carte ${variant.name}`} />
        <p>{setName} · {variant.number} · {labelForVariant(variant)} · {row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</p>
      </section>
    </div>,
    document.body,
  );
}

function CollectionList({ view, impressions }: { view: Exclude<CollectionView, "home">; impressions: CollectionImpression[] }) {
  const collection = useCollection();
  const [mode, setMode] = useState<ListMode>("list");
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState<"all" | SetCode>("all");
  const [rarity, setRarity] = useState("all");
  const [kind, setKind] = useState<"all" | VariantKind>("all");
  const [sort, setSort] = useState<SortMode>("number");
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [preview, setPreview] = useState<CollectionImpression | null>(null);
  const targetStatus = view;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return impressions.filter((impression) => {
      if (mode === "list" && collection.getStatus(impression.impressionId) !== targetStatus) return false;
      if (setFilter !== "all" && impression.setCode !== setFilter) return false;
      if (rarity !== "all" && impression.variant.rarity !== rarity) return false;
      if (kind !== "all" && impression.variant.kind !== kind) return false;
      return !normalized || [impression.variant.name, impression.variant.number, impression.setName, impression.setCode, ...impression.row.domains].join(" ").toLocaleLowerCase("fr").includes(normalized);
    }).sort((a, b) => {
      if (sort === "name") return a.variant.name.localeCompare(b.variant.name, "fr");
      if (sort === "price-desc" || sort === "price-asc") {
        const aPrice = getCollectionPrice(a, priceMode); const bPrice = getCollectionPrice(b, priceMode);
        if (aPrice === null) return 1; if (bPrice === null) return -1;
        return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice;
      }
      return a.row.sortOrder - b.row.sortOrder || a.variant.number.localeCompare(b.variant.number, "fr");
    });
  }, [collection, impressions, kind, mode, priceMode, query, rarity, setFilter, sort, targetStatus]);
  const title = view === "missing" ? "Mes cartes manquantes" : "Mes cartes possédées";
  const actionLabel = view === "missing" ? "manquantes" : "possédées";
  return <main className="collection-shell">
    <div className="collection-heading"><div><p className="eyebrow">Ma collection</p><h1>{title}</h1><p>{mode === "list" ? "Retrouve les impressions que tu as déjà classées dans ta collection." : "Recherche parmi les quatre sets puis classe chaque impression."}</p></div><div className="collection-count"><strong>{mode === "list" ? filtered.length : Object.values(collection.state).filter((status) => status === targetStatus).length}</strong><span>{mode === "list" ? "impressions affichées" : title.toLocaleLowerCase()}</span></div></div>
    <nav className="collection-subnav" aria-label="Sections de ma collection"><Link href="/collection/missing" aria-current={view === "missing" ? "page" : undefined}>Cartes manquantes</Link><Link href="/collection/owned" aria-current={view === "owned" ? "page" : undefined}>Cartes possédées</Link></nav>
    <div className="collection-mode-switch"><button className={mode === "list" ? "is-active" : ""} type="button" onClick={() => setMode("list")}>Ma liste</button><button className={mode === "add" ? "is-active" : ""} type="button" onClick={() => setMode("add")}>Ajouter des cartes</button></div>
    <label className="collection-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une carte, un numéro, un set ou un domaine…" /></label>
    <Filters setFilter={setFilter} onSetFilter={setSetFilter} rarity={rarity} onRarity={setRarity} kind={kind} onKind={setKind} sort={sort} onSort={setSort} priceMode={priceMode} onPriceMode={setPriceMode} />
    <div className="collection-results"><strong>{filtered.length}</strong> impression{filtered.length > 1 ? "s" : ""}</div>
    {filtered.length ? <div className="collection-grid">{filtered.map((impression) => {
      const alreadyInTarget = collection.getStatus(impression.impressionId) === targetStatus;
      return <ImpressionCard key={impression.impressionId} impression={impression} priceMode={priceMode} onPreview={() => setPreview(impression)} showStatus={mode === "list"} action={mode === "add" ? <div className="collection-add-actions"><button type="button" className={alreadyInTarget ? "is-added" : ""} onClick={() => targetStatus === "owned" ? collection.setOwned(impression.impressionId) : collection.setMissing(impression.impressionId)}>{alreadyInTarget ? `Ajoutée aux ${actionLabel} ✓` : `+ Ajouter aux ${actionLabel}`}</button></div> : undefined} />;
    })}</div> : <div className="collection-empty"><span>◇</span><h2>{mode === "list" ? "Aucune impression dans cette liste." : "Aucune carte ne correspond."}</h2><p>{mode === "list" ? "Passe en mode « Ajouter des cartes » pour commencer." : "Essaie avec une autre recherche ou un autre filtre."}</p></div>}
    {preview ? <CollectionCardDialog impression={preview} onClose={() => setPreview(null)} /> : null}
  </main>;
}

export function CollectionPage({ view }: { view: CollectionView }) {
  const { impressions, loading, error } = useAllImpressions();
  const collection = useCollection();
  const stats = useMemo(() => SETS.map((set) => { const setItems = impressions.filter((item) => item.setCode === set.code); return { set, total: setItems.length, owned: setItems.filter((item) => collection.getStatus(item.impressionId) === "owned").length, missing: setItems.filter((item) => collection.getStatus(item.impressionId) === "missing").length }; }), [collection, impressions]);
  const total = impressions.length; const owned = stats.reduce((sum, item) => sum + item.owned, 0); const missing = stats.reduce((sum, item) => sum + item.missing, 0);
  return <div className="site-shell collection-site-shell"><SiteHeader />{loading ? <main className="collection-shell"><div className="collection-loading">Chargement de la collection…</div></main> : error ? <main className="collection-shell"><div className="collection-empty"><h2>La collection n’a pas pu être chargée.</h2><p>Réessaie dans un instant.</p></div></main> : view === "home" ? <main className="collection-shell">
    <div className="collection-heading"><div><p className="eyebrow">Collection personnelle</p><h1>Ma collection</h1><p>Organise toutes tes impressions Riftbound, directement sur cet appareil.</p></div><div className="collection-progress"><strong>{owned} / {total}</strong><span>impressions possédées</span><i><b style={{ width: total ? `${Math.round((owned / total) * 100)}%` : "0%" }} /></i></div></div>
    <section className="collection-overview-cards"><Link href="/collection/missing" className="collection-overview-card missing"><span>◇</span><div><small>À compléter</small><h2>Cartes manquantes</h2><p>Prépare ta liste d’achat et compare les prix en un coup d’œil.</p></div><strong>{missing}</strong><em>Voir la liste →</em></Link><Link href="/collection/owned" className="collection-overview-card owned"><span>✦</span><div><small>Déjà dans le classeur</small><h2>Cartes possédées</h2><p>Retrouve tes impressions classées et ta progression par set.</p></div><strong>{owned}</strong><em>Voir la liste →</em></Link></section>
    <section className="collection-breakdown"><div><p className="eyebrow">Progression par set</p><h2>Les quatre premiers sets</h2></div><div className="collection-breakdown-grid">{stats.map(({ set, total: setTotal, owned: setOwned, missing: setMissing }) => <article key={set.code} style={{ "--local-accent": set.accent } as CSSProperties}><span>{set.name}</span><strong>{setOwned} / {setTotal}</strong><p>{setMissing} manquante{setMissing > 1 ? "s" : ""}</p><i><b style={{ width: setTotal ? `${Math.round((setOwned / setTotal) * 100)}%` : "0%" }} /></i></article>)}</div></section>
  </main> : <CollectionList view={view} impressions={impressions} />}<footer className="site-footer"><div><strong>Riftbound — Catalogue & prix</strong><p>Ta collection est mémorisée localement sur cet appareil.</p></div></footer></div>;
}
