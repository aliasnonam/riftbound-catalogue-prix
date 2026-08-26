"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { SiteHeader } from "@/app/components/site-header";
import { CustomSelect } from "@/app/components/ui/custom-select";
import type { CatalogPayload, CatalogVariant, VariantKind } from "@/lib/catalog";
import {
  collectionBackupFilename,
  createCollectionBackup,
  flattenCatalogPayload,
  getCollectionFinancialSummary,
  getCollectionPrice,
  getCollectionProgress,
  parseCollectionBackup,
  type CollectionImpression,
  type CollectionState,
} from "@/lib/collection";
import { getVariantFoilPrice, getVariantNormalPrice, type PriceMode } from "@/lib/pricing";
import { SETS, type SetCode } from "@/lib/sets";
import { useCollection } from "@/hooks/use-collection";

export type CollectionView = "home" | "missing" | "owned" | "manage";
type SortMode = "number" | "name" | "price-desc" | "price-asc";
type DisplayStatus = "owned" | "missing" | "unknown";
type CollectionExclusion = "signature" | "overnumbered" | "alternate" | "Epic" | "Showcase";

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Showcase", "Ultimate", "Special"];
const RARITY_LABELS: Record<string, string> = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Epic: "Épique", Showcase: "Showcase", Ultimate: "Ultimate", Special: "Spéciale" };
const KIND_LABELS: Record<VariantKind, string> = { base: "Set", alternate: "Alternative", "crystal-rose": "Crystal Rose", overnumbered: "Outnumbered", signature: "Signée", other: "Spéciale" };

function formatPrice(value: number | null) { return value === null ? "—" : EURO.format(value); }
function formatPercent(value: number) { return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`; }
function labelForVariant(variant: CatalogVariant) { return variant.kind === "base" ? (RARITY_LABELS[variant.rarity] ?? variant.rarity) : KIND_LABELS[variant.kind]; }
function statusLabel(status: DisplayStatus) { return status === "owned" ? "✓ Possédée" : status === "missing" ? "✕ Manquante" : "— Non renseignée"; }
function collectionHref(view: Exclude<CollectionView, "home">, focusSetCode?: SetCode) {
  const set = focusSetCode ? SETS.find((item) => item.code === focusSetCode) : undefined;
  return set ? `/collection/${set.slug}/${view}` : `/collection/${view}`;
}

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

function CollectionStatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`collection-status-badge is-${status}`}>{statusLabel(status)}</span>;
}

function ManageStatusActions({ impression, status }: { impression: CollectionImpression; status: DisplayStatus }) {
  const collection = useCollection();
  const foilAvailable = status === "owned" && impression.variant.pricing === "dual";
  const isFoil = collection.isFoil(impression);
  return <div className="collection-manage-actions" aria-label={`Gérer ${impression.variant.name}`}>
    {status !== "owned" ? <button type="button" className="owned" onClick={() => collection.setOwned(impression.impressionId)}>Marquer comme possédée</button> : null}
    {status !== "missing" ? <button type="button" className="missing" onClick={() => collection.setMissing(impression.impressionId)}>Marquer comme manquante</button> : null}
    {status !== "unknown" ? <button type="button" className="clear" onClick={() => collection.clearStatus(impression.impressionId)}>Retirer le statut</button> : null}
    {foilAvailable ? <button type="button" className={`foil${isFoil ? " is-active" : ""}`} aria-pressed={isFoil} aria-label={`${isFoil ? "Retirer" : "Indiquer"} la finition Foil pour ${impression.variant.name}`} onClick={() => collection.setFoil(impression, !isFoil)}>{isFoil ? "✦ Foil" : "☆ Foil"}</button> : null}
  </div>;
}

function Filters({ focusSetCode, setFilter, onSetFilter, rarity, onRarity, kind, onKind, sort, onSort, priceMode, onPriceMode, exclusions, onToggleExclusion, onClearExclusions }: {
  focusSetCode?: SetCode; setFilter: "all" | SetCode; onSetFilter: (value: "all" | SetCode) => void; rarity: string; onRarity: (value: string) => void; kind: "all" | VariantKind; onKind: (value: "all" | VariantKind) => void; sort: SortMode; onSort: (value: SortMode) => void; priceMode: PriceMode; onPriceMode: (value: PriceMode) => void; exclusions: ReadonlySet<CollectionExclusion>; onToggleExclusion: (value: CollectionExclusion) => void; onClearExclusions: () => void;
}) {
  const premiumExclusions: CollectionExclusion[] = ["signature", "overnumbered", "alternate"];
  const premiumActive = premiumExclusions.every((exclusion) => exclusions.has(exclusion));
  const togglePremium = () => {
    premiumExclusions.forEach((exclusion) => {
      if (premiumActive || !exclusions.has(exclusion)) onToggleExclusion(exclusion);
    });
  };
  const exclusionOptions: { value: CollectionExclusion; label: string }[] = [
    { value: "signature", label: "Signées" },
    { value: "overnumbered", label: "Outnumbered" },
    { value: "alternate", label: "Alternatives" },
    { value: "Epic", label: "Épiques" },
    { value: "Showcase", label: "Showcase" },
  ];
  return <>
    <div className={`collection-filters${focusSetCode ? " is-focused" : ""}`}>
      {!focusSetCode ? <CustomSelect className="collection-select" label="Set" value={setFilter} onChange={(value) => onSetFilter(value as "all" | SetCode)} options={[{ value: "all", label: "Tous les sets" }, ...SETS.map((set) => ({ value: set.code, label: set.name }))]} /> : null}
      <CustomSelect className="collection-select" label="Rareté" value={rarity} onChange={onRarity} options={[{ value: "all", label: "Toutes" }, ...RARITIES.map((item) => ({ value: item, label: RARITY_LABELS[item] }))]} />
      <CustomSelect className="collection-select" label="Impression" value={kind} onChange={(value) => onKind(value as "all" | VariantKind)} options={[{ value: "all", label: "Toutes" }, ...(Object.keys(KIND_LABELS) as VariantKind[]).map((item) => ({ value: item, label: KIND_LABELS[item] }))]} />
      <CustomSelect className="collection-select" label="Trier" value={sort} onChange={(value) => onSort(value as SortMode)} options={[{ value: "number", label: "Numéro" }, { value: "name", label: "Nom A–Z" }, { value: "price-desc", label: "Prix le plus élevé" }, { value: "price-asc", label: "Prix le plus bas" }]} />
      <CustomSelect className="collection-select" label="Valeur affichée" value={priceMode} onChange={(value) => onPriceMode(value as PriceMode)} options={[{ value: "low", label: "Prix minimum" }, { value: "trend", label: "Tendance Cardmarket" }, { value: "avg30", label: "Moyenne 30 jours" }]} />
    </div>
    <div className="collection-exclusions" aria-label="Exclure des impressions">
      <span>Exclure</span>
      <button type="button" className={premiumActive ? "is-active" : ""} onClick={togglePremium} aria-pressed={premiumActive}>Sans variantes premium</button>
      {exclusionOptions.map((option) => <button type="button" key={option.value} className={exclusions.has(option.value) ? "is-active" : ""} onClick={() => onToggleExclusion(option.value)} aria-pressed={exclusions.has(option.value)}>{exclusions.has(option.value) ? "✕ " : ""}{option.label}</button>)}
      {exclusions.size ? <button type="button" className="collection-exclusions-reset" onClick={onClearExclusions}>Réinitialiser</button> : null}
    </div>
  </>;
}

function ImpressionCard({ impression, priceMode, editable, onPreview }: { impression: CollectionImpression; priceMode: PriceMode; editable: boolean; onPreview: () => void }) {
  const collection = useCollection();
  const { variant, row, setName } = impression;
  const status = collection.getStatus(impression.impressionId);
  const isFoil = collection.isFoil(impression);
  return <article className="collection-impression-card">
    <button className="collection-impression-preview" type="button" onClick={onPreview} disabled={!variant.imageUrl} aria-label={variant.imageUrl ? `Agrandir ${variant.name}` : undefined}>
      <span className="collection-impression-art">{variant.imageUrl ? <img src={variant.imageUrl} alt={`Carte ${variant.name}`} loading="lazy" /> : <span>◇</span>}</span>
      <span className="collection-impression-copy">
        <span className="collection-impression-kicker"><span>{setName}</span><b>{variant.number}</b><em>{labelForVariant(variant)}</em></span>
        <strong className="collection-impression-title">{variant.name}</strong>
        <span className="collection-impression-type">{row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</span>
        <span className="collection-impression-prices">{variant.pricing === "dual" ? <><span>Normal <b>{formatPrice(getVariantNormalPrice(variant, priceMode))}</b></span><span>Foil <b>{formatPrice(getVariantFoilPrice(variant, priceMode))}</b></span></> : <span>{labelForVariant(variant)} <b>{formatPrice(getCollectionPrice(impression, priceMode))}</b></span>}</span>
      </span>
    </button>
    <footer className="collection-card-footer">
      <span className="collection-card-statuses"><CollectionStatusBadge status={status} />{!editable && isFoil ? <span className="collection-foil-badge">✦ Foil</span> : null}</span>
      {editable ? <ManageStatusActions impression={impression} status={status} /> : <a className="collection-cardmarket-link" href={row.cardmarketUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{status === "missing" ? "Voir / acheter sur Cardmarket ↗" : "Voir sur Cardmarket ↗"}</a>}
    </footer>
  </article>;
}

function CollectionCardDialog({ impression, onClose }: { impression: CollectionImpression; onClose: () => void }) {
  const { variant, row, setName } = impression;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);
  if (!variant.imageUrl) return null;
  return createPortal(<div className="card-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="card-preview-dialog" role="dialog" aria-modal="true" aria-label={`${variant.name}, ${variant.number}`}><button className="card-preview-close" type="button" aria-label="Fermer l’aperçu" onClick={onClose}>×</button><img src={variant.imageUrl} alt={`Carte ${variant.name}`} /><p>{setName} · {variant.number} · {labelForVariant(variant)} · {row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</p></section></div>, document.body);
}

type PendingCollectionRestore = {
  collection: CollectionState;
  restored: number;
  ignored: number;
};

function CollectionBackupControls({ impressions }: { impressions: CollectionImpression[] }) {
  const collection = useCollection();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingCollectionRestore | null>(null);
  const knownImpressionIds = useMemo(() => new Set(impressions.map((impression) => impression.impressionId)), [impressions]);

  useEffect(() => {
    if (!pendingRestore) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPendingRestore(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pendingRestore]);

  const restore = (next: PendingCollectionRestore) => {
    collection.restore(next.collection);
    setPendingRestore(null);
    setMessage({
      kind: "success",
      text: `Collection restaurée ✓ — ${next.restored} statut${next.restored > 1 ? "s" : ""} restauré${next.restored > 1 ? "s" : ""}${next.ignored ? ` · ${next.ignored} entrée${next.ignored > 1 ? "s" : ""} inconnue${next.ignored > 1 ? "s" : ""} ignorée${next.ignored > 1 ? "s" : ""}` : ""}`,
    });
  };

  const exportBackup = () => {
    const backup = createCollectionBackup(collection.state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = collectionBackupFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    setMessage({ kind: "success", text: "Sauvegarde exportée ✓" });
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      setMessage({ kind: "error", text: "Impossible d’importer ce fichier. La sauvegarde n’est pas valide." });
      return;
    }
    const parsed = parseCollectionBackup(raw);
    if (!parsed.ok) {
      setMessage({
        kind: "error",
        text: parsed.reason === "unsupported-version" ? "Cette sauvegarde utilise une version non prise en charge." : "Impossible d’importer ce fichier. La sauvegarde n’est pas valide.",
      });
      return;
    }
    const entries = Object.entries(parsed.backup.collection);
    const accepted = entries.filter(([impressionId]) => knownImpressionIds.has(impressionId));
    if (!accepted.length && entries.length) {
      setMessage({ kind: "error", text: "Aucun statut de cette sauvegarde ne correspond au catalogue actuel." });
      return;
    }
    const next = { collection: Object.fromEntries(accepted), restored: accepted.length, ignored: entries.length - accepted.length };
    if (Object.keys(collection.state).length) setPendingRestore(next);
    else restore(next);
  };

  return <section className="collection-backup" aria-labelledby="collection-backup-title">
    <div>
      <p className="eyebrow">Sauvegarde locale</p>
      <h2 id="collection-backup-title">Sauvegarde de la collection</h2>
      <p>Sauvegarde ou restaure tes cartes possédées et manquantes sur cet appareil.</p>
    </div>
    <div className="collection-backup-actions">
      <button type="button" onClick={exportBackup}>Exporter ma collection</button>
      <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>Importer ma collection</button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={(event) => { const [file] = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void importBackup(file); }} />
    </div>
    {message ? <p className={`collection-backup-message is-${message.kind}`} role="status">{message.text}</p> : null}
    {pendingRestore ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingRestore(null); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-restore-title"><p className="eyebrow">Sauvegarde locale</p><h2 id="collection-restore-title">Restaurer cette sauvegarde ?</h2><p>Cette opération remplacera les statuts actuellement enregistrés sur cet appareil.</p><p className="collection-confirm-summary"><strong>{pendingRestore.restored}</strong> statut{pendingRestore.restored > 1 ? "s" : ""} à restaurer{pendingRestore.ignored ? <> · <strong>{pendingRestore.ignored}</strong> entrée{pendingRestore.ignored > 1 ? "s" : ""} inconnue{pendingRestore.ignored > 1 ? "s" : ""} ignorée{pendingRestore.ignored > 1 ? "s" : ""}</> : null}</p><div><button type="button" className="secondary" onClick={() => setPendingRestore(null)}>Annuler</button><button type="button" onClick={() => restore(pendingRestore)}>Restaurer</button></div></section></div>, document.body) : null}
  </section>;
}

function CollectionList({ view, impressions, focusSetCode }: { view: Exclude<CollectionView, "home">; impressions: CollectionImpression[]; focusSetCode?: SetCode }) {
  const collection = useCollection();
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState<"all" | SetCode>(focusSetCode ?? "all");
  const [rarity, setRarity] = useState("all");
  const [kind, setKind] = useState<"all" | VariantKind>("all");
  const [sort, setSort] = useState<SortMode>("number");
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [exclusions, setExclusions] = useState<Set<CollectionExclusion>>(() => new Set());
  const [preview, setPreview] = useState<CollectionImpression | null>(null);
  const targetStatus = view === "manage" ? null : view;
  const focusedSet = focusSetCode ? SETS.find((set) => set.code === focusSetCode) : undefined;
  const scoped = useMemo(() => impressions.filter((impression) => !focusSetCode || impression.setCode === focusSetCode), [focusSetCode, impressions]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    return scoped.filter((impression) => {
      if (targetStatus && collection.getStatus(impression.impressionId) !== targetStatus) return false;
      if (!focusSetCode && setFilter !== "all" && impression.setCode !== setFilter) return false;
      if (rarity !== "all" && impression.variant.rarity !== rarity) return false;
      if (kind !== "all" && impression.variant.kind !== kind) return false;
      if (exclusions.has(impression.variant.kind as CollectionExclusion)) return false;
      if (exclusions.has(impression.variant.rarity as CollectionExclusion)) return false;
      return !normalized || [impression.variant.name, impression.variant.number, impression.setName, impression.setCode, ...impression.row.domains].join(" ").toLocaleLowerCase("fr").includes(normalized);
    }).sort((a, b) => {
      if (sort === "name") return a.variant.name.localeCompare(b.variant.name, "fr");
      if (sort === "price-desc" || sort === "price-asc") { const aPrice = getCollectionPrice(a, priceMode); const bPrice = getCollectionPrice(b, priceMode); if (aPrice === null) return 1; if (bPrice === null) return -1; return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice; }
      return a.row.sortOrder - b.row.sortOrder || a.variant.number.localeCompare(b.variant.number, "fr");
    });
  }, [collection, exclusions, focusSetCode, kind, priceMode, query, rarity, scoped, setFilter, sort, targetStatus]);
  const title = view === "missing" ? "Cartes manquantes" : view === "owned" ? "Cartes possédées" : "Gérer mes cartes";
  const description = view === "missing" ? "Les impressions qu’il reste à ajouter à ta collection." : view === "owned" ? "Les impressions déjà classées dans ta collection." : "Ajoute, modifie ou retire le statut de chaque impression.";
  return <main className="collection-shell">
    <Link className="collection-back-link" href="/collection">← Retour à Ma collection</Link>
    <div className="collection-heading"><div><p className="eyebrow" style={focusedSet ? { color: focusedSet.accent } : undefined}>{focusedSet ? `Ma collection · ${focusedSet.name}` : "Ma collection"}</p><h1>{title}</h1><p>{description}</p></div><div className="collection-count"><strong>{filtered.length}</strong><span>impression{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}</span></div></div>
    <nav className="collection-subnav" aria-label="Sections de ma collection"><Link href={collectionHref("missing", focusSetCode)} aria-current={view === "missing" ? "page" : undefined}>Cartes manquantes</Link><Link href={collectionHref("owned", focusSetCode)} aria-current={view === "owned" ? "page" : undefined}>Cartes possédées</Link><Link href={collectionHref("manage", focusSetCode)} aria-current={view === "manage" ? "page" : undefined}>Gérer mes cartes</Link></nav>
    <label className="collection-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={focusedSet ? `Rechercher dans ${focusedSet.name}…` : "Rechercher une carte, un numéro, un set ou un domaine…"} /></label>
    <Filters focusSetCode={focusSetCode} setFilter={setFilter} onSetFilter={setSetFilter} rarity={rarity} onRarity={setRarity} kind={kind} onKind={setKind} sort={sort} onSort={setSort} priceMode={priceMode} onPriceMode={setPriceMode} exclusions={exclusions} onToggleExclusion={(value) => setExclusions((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; })} onClearExclusions={() => setExclusions(new Set())} />
    <div className="collection-results"><strong>{filtered.length}</strong> impression{filtered.length > 1 ? "s" : ""}</div>
    {filtered.length ? <div className="collection-grid">{filtered.map((impression) => <ImpressionCard key={impression.impressionId} impression={impression} priceMode={priceMode} editable={view === "manage"} onPreview={() => setPreview(impression)} />)}</div> : <div className="collection-empty"><span>◇</span><h2>{view === "manage" ? "Aucune carte ne correspond." : "Aucune impression dans cette liste."}</h2><p>{view === "manage" ? "Essaie avec une autre recherche ou un autre filtre." : "Gère tes cartes pour ajouter ou modifier un statut."}</p></div>}
    {preview ? <CollectionCardDialog impression={preview} onClose={() => setPreview(null)} /> : null}
  </main>;
}

export function CollectionPage({ view, focusSetCode }: { view: CollectionView; focusSetCode?: SetCode }) {
  const { impressions, loading, error } = useAllImpressions();
  const collection = useCollection();
  const [dashboardPriceMode, setDashboardPriceMode] = useState<PriceMode>("low");
  const dashboard = useMemo(() => {
    const masterSet = getCollectionProgress(impressions, collection.state);
    const numberedSet = getCollectionProgress(impressions, collection.state, (impression) => impression.row.isNumbered);
    const ownedValue = getCollectionFinancialSummary(impressions, collection.state, "owned", dashboardPriceMode);
    const missingCost = getCollectionFinancialSummary(impressions, collection.state, "missing", dashboardPriceMode);
    const sets = SETS.map((set) => {
      const setImpressions = impressions.filter((impression) => impression.setCode === set.code);
      return {
        set,
        masterSet: getCollectionProgress(setImpressions, collection.state),
        numberedSet: getCollectionProgress(setImpressions, collection.state, (impression) => impression.row.isNumbered),
        missing: setImpressions.filter((impression) => collection.getStatus(impression.impressionId) === "missing").length,
        ownedValue: getCollectionFinancialSummary(setImpressions, collection.state, "owned", dashboardPriceMode),
        missingCost: getCollectionFinancialSummary(setImpressions, collection.state, "missing", dashboardPriceMode),
      };
    });
    return { masterSet, numberedSet, ownedValue, missingCost, sets };
  }, [collection, dashboardPriceMode, impressions]);
  const { masterSet, numberedSet, ownedValue, missingCost, sets: stats } = dashboard;
  const owned = masterSet.owned;
  const missing = stats.reduce((sum, item) => sum + item.missing, 0);
  return <div className="site-shell collection-site-shell"><SiteHeader />{loading ? <main className="collection-shell"><div className="collection-loading">Chargement de la collection…</div></main> : error ? <main className="collection-shell"><div className="collection-empty"><h2>La collection n’a pas pu être chargée.</h2><p>Réessaie dans un instant.</p></div></main> : view === "home" ? <main className="collection-shell">
    <div className="collection-heading"><div><p className="eyebrow">Collection personnelle</p><h1>Ma collection</h1><p>Organise toutes tes impressions Riftbound, directement sur cet appareil.</p></div></div>
    <section className="collection-dashboard" aria-label="Résumé de ma collection">
      <div className="collection-dashboard-kpi"><span>Set numéroté</span><strong>{numberedSet.owned} / {numberedSet.total}</strong><p>{formatPercent(numberedSet.percentage)}</p><i><b style={{ width: `${numberedSet.percentage}%` }} /></i></div>
      <div className="collection-dashboard-kpi"><span>Master set</span><strong>{masterSet.owned} / {masterSet.total}</strong><p>{formatPercent(masterSet.percentage)}</p><i><b style={{ width: `${masterSet.percentage}%` }} /></i></div>
      <div className="collection-dashboard-kpi is-value"><span>Valeur estimée</span><strong>{formatPrice(ownedValue.total)}</strong>{ownedValue.withoutPrice ? <p>{ownedValue.withoutPrice} impression{ownedValue.withoutPrice > 1 ? "s" : ""} sans prix</p> : <p>Cartes possédées</p>}</div>
      <div className="collection-dashboard-kpi is-value"><span>Coût pour compléter</span><strong>{formatPrice(missingCost.total)}</strong>{missingCost.withoutPrice ? <p>{missingCost.withoutPrice} impression{missingCost.withoutPrice > 1 ? "s" : ""} sans prix</p> : <p>Cartes manquantes</p>}</div>
      <CustomSelect className="collection-dashboard-select" label="Valeur utilisée" value={dashboardPriceMode} onChange={(value) => setDashboardPriceMode(value as PriceMode)} options={[{ value: "low", label: "Prix minimum" }, { value: "trend", label: "Tendance Cardmarket" }, { value: "avg30", label: "Moyenne 30 jours" }]} />
    </section>
    <section className="collection-overview-cards"><Link href="/collection/missing" className="collection-overview-card missing"><span>◇</span><div><small>À compléter</small><h2>Cartes manquantes</h2><p>Prépare ta liste d’achat et compare les prix en un coup d’œil.</p></div><strong>{missing}</strong><em>Voir la liste →</em></Link><Link href="/collection/owned" className="collection-overview-card owned"><span>✦</span><div><small>Déjà dans le classeur</small><h2>Cartes possédées</h2><p>Retrouve tes impressions classées et ta progression par set.</p></div><strong>{owned}</strong><em>Voir la liste →</em></Link><Link href="/collection/manage" className="collection-overview-card manage"><span>☷</span><div><small>Organisation</small><h2>Gérer mes cartes</h2><p>Ajoute, modifie ou retire le statut de chaque impression.</p></div><strong>{owned + missing}</strong><em>Gérer la collection →</em></Link></section>
    <CollectionBackupControls impressions={impressions} />
    <section className="collection-breakdown"><div><p className="eyebrow">Progression par set</p><h2>Les quatre premiers sets</h2></div><div className="collection-breakdown-grid">{stats.map(({ set, numberedSet: setNumbered, masterSet: setMaster, missing: setMissing, ownedValue: setOwnedValue, missingCost: setMissingCost }) => <Link href={`/collection/${set.slug}/missing`} key={set.code} className="collection-set-progress" style={{ "--local-accent": set.accent } as CSSProperties}><span>{set.name}</span><div className="collection-set-metrics"><p>Set numéroté <strong>{setNumbered.owned} / {setNumbered.total}</strong> · {formatPercent(setNumbered.percentage)}</p><p>Master set <strong>{setMaster.owned} / {setMaster.total}</strong> · {formatPercent(setMaster.percentage)}</p></div><p>{setMissing} manquante{setMissing > 1 ? "s" : ""}</p><div className="collection-set-financial"><small>Valeur possédée <b>{formatPrice(setOwnedValue.total)}</b></small><small>Coût restant <b>{formatPrice(setMissingCost.total)}</b></small></div><i><b style={{ width: `${setMaster.percentage}%` }} /></i></Link>)}</div></section>
  </main> : <CollectionList view={view} impressions={impressions} focusSetCode={focusSetCode} />}<footer className="site-footer"><div><strong>Riftbound — Catalogue & prix</strong><p>Ta collection est mémorisée localement sur cet appareil.</p></div></footer></div>;
}
