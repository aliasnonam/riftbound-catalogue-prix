"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { FilePicker } from "@capawesome/capacitor-file-picker";

import { SiteHeader } from "@/app/components/site-header";
import { CachedCardImage } from "@/app/components/offline-image";
import { OfflineImageControls } from "@/app/components/offline-image-controls";
import { CardScanner } from "@/app/components/card-scanner";
import { CustomSelect } from "@/app/components/ui/custom-select";
import type { CatalogPayload, CatalogVariant, VariantKind } from "@/lib/catalog";
import {
  collectionBackupFilename,
  createCollectionBackup,
  flattenCatalogPayload,
  getCollectionFinancialTotals,
  getCollectionPrice,
  getCollectionProgress,
  parseCollectionBackup,
  type CollectionImpression,
  type CollectionState,
} from "@/lib/collection";
import { getVariantFoilPrice, getVariantNormalPrice, type PriceMode } from "@/lib/pricing";
import { getSetDisplayName, SETS, type SetCode } from "@/lib/sets";
import { useCollection } from "@/hooks/use-collection";
import { useSiteLanguage } from "@/app/lib/site-language";
import { CollectionBackupDownload } from "@/app/lib/native-backup-download";

export type CollectionView = "home" | "missing" | "owned" | "manage" | "recent";
type SortMode = "number" | "name" | "price-desc" | "price-asc";
type DisplayStatus = "owned" | "missing";
type CollectionExclusion = "signature" | "overnumbered" | "alternate" | "Epic" | "Showcase";

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Showcase", "Ultimate", "Special"];
const RARITY_LABELS: Record<string, string> = { Common: "Commune", Uncommon: "Peu commune", Rare: "Rare", Epic: "Épique", Showcase: "Showcase", Ultimate: "Ultimate", Special: "Spéciale" };
const KIND_LABELS: Record<VariantKind, string> = { base: "Set", alternate: "Alternative", "crystal-rose": "Crystal Rose", overnumbered: "Outnumbered", signature: "Signée", other: "Spéciale" };
const COLLECTION_BATCH_SIZE = 36;

function formatPrice(value: number | null) { return value === null ? "—" : EURO.format(value); }
function formatPercent(value: number) { return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`; }
function labelForVariant(variant: CatalogVariant, language: "fr" | "en" = "fr") {
  if (variant.kind === "base") return language === "en" ? variant.rarity : (RARITY_LABELS[variant.rarity] ?? variant.rarity);
  if (language === "en") return variant.kind === "alternate" ? "Alternate" : variant.kind === "signature" ? "Signed" : variant.kind === "other" ? "Special" : KIND_LABELS[variant.kind];
  return KIND_LABELS[variant.kind];
}
function statusLabel(status: DisplayStatus, language: "fr" | "en") { return status === "owned" ? (language === "en" ? "✓ Owned" : "✓ Possédée") : (language === "en" ? "✕ Missing" : "✕ Manquante"); }
function collectionHref(view: Exclude<CollectionView, "home">, focusSetCode?: SetCode) {
  const set = focusSetCode ? SETS.find((item) => item.code === focusSetCode) : undefined;
  return set ? `/collection/${set.slug}/${view}` : `/collection/${view}`;
}

function useAllImpressions() {
  const { language } = useSiteLanguage();
  const [payloads, setPayloads] = useState<CatalogPayload[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all(SETS.map(async (set) => {
      const response = await fetch(`/api/catalog?set=${set.code}&lang=${language}`, { cache: "no-store" });
      if (!response.ok) throw new Error("catalogue unavailable");
      return response.json() as Promise<CatalogPayload>;
    })).then((next) => { if (active) setPayloads(next); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [language]);
  return { impressions: payloads.flatMap(flattenCatalogPayload), loading: !error && payloads.length !== SETS.length, error };
}

function CollectionStatusBadge({ status }: { status: DisplayStatus }) {
  const { language } = useSiteLanguage();
  return <span className={`collection-status-badge is-${status}`}>{statusLabel(status, language)}</span>;
}

function ManageStatusActions({ impression, status }: { impression: CollectionImpression; status: DisplayStatus }) {
  const collection = useCollection();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const foilAvailable = status === "owned" && impression.variant.pricing === "dual";
  const isFoil = collection.isFoil(impression);
  return <div className="collection-manage-actions" aria-label={en ? `Manage ${impression.variant.name}` : `Gérer ${impression.variant.name}`}>
    {status === "missing" ? <button type="button" className="owned" onClick={() => collection.setOwned(impression.impressionId)}>{en ? "Mark as owned" : "Marquer comme possédée"}</button> : <button type="button" className="missing" onClick={() => collection.setMissing(impression.impressionId)}>{en ? "Mark as missing" : "Marquer comme manquante"}</button>}
    {foilAvailable ? <button type="button" className={`foil${isFoil ? " is-active" : ""}`} aria-pressed={isFoil} aria-label={en ? `${isFoil ? "Remove" : "Mark"} Foil finish for ${impression.variant.name}` : `${isFoil ? "Retirer" : "Indiquer"} la finition Foil pour ${impression.variant.name}`} onClick={() => collection.setFoil(impression, !isFoil)}>{isFoil ? "✦ Foil" : "☆ Foil"}</button> : null}
  </div>;
}

function Filters({ focusSetCode, setFilter, onSetFilter, rarity, onRarity, kind, onKind, sort, onSort, priceMode, onPriceMode, exclusions, onToggleExclusion, onClearExclusions }: {
  focusSetCode?: SetCode; setFilter: "all" | SetCode; onSetFilter: (value: "all" | SetCode) => void; rarity: string; onRarity: (value: string) => void; kind: "all" | VariantKind; onKind: (value: "all" | VariantKind) => void; sort: SortMode; onSort: (value: SortMode) => void; priceMode: PriceMode; onPriceMode: (value: PriceMode) => void; exclusions: ReadonlySet<CollectionExclusion>; onToggleExclusion: (value: CollectionExclusion) => void; onClearExclusions: () => void;
}) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const premiumExclusions: CollectionExclusion[] = ["signature", "overnumbered", "alternate"];
  const premiumActive = premiumExclusions.every((exclusion) => exclusions.has(exclusion));
  const togglePremium = () => {
    premiumExclusions.forEach((exclusion) => {
      if (premiumActive || !exclusions.has(exclusion)) onToggleExclusion(exclusion);
    });
  };
  const exclusionOptions: { value: CollectionExclusion; label: string }[] = [
    { value: "signature", label: en ? "Signed" : "Signées" },
    { value: "overnumbered", label: "Outnumbered" },
    { value: "alternate", label: en ? "Alternates" : "Alternatives" },
    { value: "Epic", label: en ? "Epic" : "Épiques" },
    { value: "Showcase", label: "Showcase" },
  ];
  return <>
    <div className={`collection-filters${focusSetCode ? " is-focused" : ""}`}>
      {!focusSetCode ? <CustomSelect className="collection-select" label={en ? "Set" : "Set"} value={setFilter} onChange={(value) => onSetFilter(value as "all" | SetCode)} options={[{ value: "all", label: en ? "All sets" : "Tous les sets" }, ...SETS.map((set) => ({ value: set.code, label: getSetDisplayName(set, language) }))]} /> : null}
      <CustomSelect className="collection-select" label={en ? "Rarity" : "Rareté"} value={rarity} onChange={onRarity} options={[{ value: "all", label: en ? "All" : "Toutes" }, ...RARITIES.map((item) => ({ value: item, label: en ? item : RARITY_LABELS[item] }))]} />
      <CustomSelect className="collection-select" label={en ? "Printing" : "Impression"} value={kind} onChange={(value) => onKind(value as "all" | VariantKind)} options={[{ value: "all", label: en ? "All" : "Toutes" }, ...(Object.keys(KIND_LABELS) as VariantKind[]).map((item) => ({ value: item, label: en ? (item === "base" ? "Set" : item === "alternate" ? "Alternate" : item === "signature" ? "Signed" : item === "other" ? "Special" : KIND_LABELS[item]) : KIND_LABELS[item] }))]} />
      <CustomSelect className="collection-select" label={en ? "Sort" : "Trier"} value={sort} onChange={(value) => onSort(value as SortMode)} options={[{ value: "number", label: en ? "Number" : "Numéro" }, { value: "name", label: en ? "Name A–Z" : "Nom A–Z" }, { value: "price-desc", label: en ? "Highest price" : "Prix le plus élevé" }, { value: "price-asc", label: en ? "Lowest price" : "Prix le plus bas" }]} />
      <CustomSelect className="collection-select" label={en ? "Displayed value" : "Valeur affichée"} value={priceMode} onChange={(value) => onPriceMode(value as PriceMode)} options={[{ value: "low", label: en ? "Lowest price" : "Prix minimum" }, { value: "trend", label: en ? "Cardmarket trend" : "Tendance Cardmarket" }, { value: "avg30", label: en ? "30-day average" : "Moyenne 30 jours" }]} />
    </div>
    <div className="collection-exclusions" aria-label={en ? "Exclude printings" : "Exclure des impressions"}>
      <span>{en ? "Exclude" : "Exclure"}</span>
      <button type="button" className={premiumActive ? "is-active" : ""} onClick={togglePremium} aria-pressed={premiumActive}>{en ? "No premium variants" : "Sans variantes premium"}</button>
      {exclusionOptions.map((option) => <button type="button" key={option.value} className={exclusions.has(option.value) ? "is-active" : ""} onClick={() => onToggleExclusion(option.value)} aria-pressed={exclusions.has(option.value)}>{exclusions.has(option.value) ? "✕ " : ""}{option.label}</button>)}
      {exclusions.size ? <button type="button" className="collection-exclusions-reset" onClick={onClearExclusions}>{en ? "Reset" : "Réinitialiser"}</button> : null}
    </div>
  </>;
}

function ImpressionCard({ impression, priceMode, editable, onPreview, position }: { impression: CollectionImpression; priceMode: PriceMode; editable: boolean; onPreview: () => void; position?: number }) {
  const collection = useCollection();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const { variant, row, setName } = impression;
  const status = collection.getStatus(impression.impressionId);
  const isFoil = collection.isFoil(impression);
  return <article className="collection-impression-card" data-collection-position={position}>
    <button className="collection-impression-preview" type="button" onClick={onPreview} disabled={!variant.imageUrl} aria-label={variant.imageUrl ? (en ? `Enlarge ${variant.name}` : `Agrandir ${variant.name}`) : undefined}>
      <span className="collection-impression-art">{variant.imageUrl ? <CachedCardImage src={variant.imageUrl} alt={`${en ? "Card" : "Carte"} ${variant.name}`} loading="lazy" /> : <span>◇</span>}</span>
      <span className="collection-impression-copy">
        <span className="collection-impression-kicker"><span>{setName}</span><b>{variant.number}</b><em>{labelForVariant(variant, language)}</em></span>
        <strong className="collection-impression-title">{variant.name}</strong>
        <span className="collection-impression-type">{row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</span>
        <span className="collection-impression-prices">{variant.pricing === "dual" ? <><span>Normal <b>{formatPrice(getVariantNormalPrice(variant, priceMode))}</b></span><span>Foil <b>{formatPrice(getVariantFoilPrice(variant, priceMode))}</b></span></> : <span>{labelForVariant(variant, language)} <b>{formatPrice(getCollectionPrice(impression, priceMode))}</b></span>}</span>
      </span>
    </button>
    <footer className="collection-card-footer">
      <span className="collection-card-statuses"><CollectionStatusBadge status={status} />{!editable && isFoil ? <span className="collection-foil-badge">✦ Foil</span> : null}</span>
      {editable ? <ManageStatusActions impression={impression} status={status} /> : <a className="collection-cardmarket-link" href={row.cardmarketUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{status === "missing" ? (en ? "View / buy on Cardmarket ↗" : "Voir / acheter sur Cardmarket ↗") : (en ? "View on Cardmarket ↗" : "Voir sur Cardmarket ↗")}</a>}
    </footer>
  </article>;
}

function CollectionCardDialog({ impression, onClose }: { impression: CollectionImpression; onClose: () => void }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const { variant, row, setName } = impression;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);
  if (!variant.imageUrl) return null;
  return createPortal(<div className="card-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="card-preview-dialog" role="dialog" aria-modal="true" aria-label={`${variant.name}, ${variant.number}`}><button className="card-preview-close" type="button" aria-label={en ? "Close preview" : "Fermer l’aperçu"} onClick={onClose}>×</button><CachedCardImage src={variant.imageUrl} alt={`${en ? "Card" : "Carte"} ${variant.name}`} /><p>{setName} · {variant.number} · {labelForVariant(variant, language)} · {row.type}{row.domains.length ? ` · ${row.domains.join(" / ")}` : ""}</p></section></div>, document.body);
}

type PendingCollectionRestore = {
  collection: CollectionState;
  restored: number;
  ignored: number;
};

function decodeBase64Utf8(value: string) {
  const binary = window.atob(value.replace(/^data:[^,]+,/, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function CollectionBackupControls({ impressions }: { impressions: CollectionImpression[] }) {
  const collection = useCollection();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingCollectionRestore | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const knownImpressionIds = useMemo(() => new Set(impressions.map((impression) => impression.impressionId)), [impressions]);

  useEffect(() => {
    if (!pendingRestore && !confirmClear) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setPendingRestore(null); setConfirmClear(false); } };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmClear, pendingRestore]);

  const restore = (next: PendingCollectionRestore) => {
    collection.restore(next.collection);
    setPendingRestore(null);
    setMessage({
      kind: "success",
      text: en ? `Collection restored ✓ — ${next.restored} owned printing${next.restored > 1 ? "s" : ""} restored${next.ignored ? ` · ${next.ignored} unknown entr${next.ignored > 1 ? "ies" : "y"} ignored` : ""}` : `Collection restaurée ✓ — ${next.restored} carte${next.restored > 1 ? "s" : ""} possédée${next.restored > 1 ? "s" : ""} restaurée${next.restored > 1 ? "s" : ""}${next.ignored ? ` · ${next.ignored} entrée${next.ignored > 1 ? "s" : ""} non reconnue${next.ignored > 1 ? "s" : ""} ignorée${next.ignored > 1 ? "s" : ""}` : ""}`,
    });
  };

  const exportBackup = async () => {
    const backup = createCollectionBackup(collection.state);
    const contents = JSON.stringify(backup, null, 2);
    const filename = collectionBackupFilename();
    if (Capacitor.isNativePlatform()) {
      try {
        await CollectionBackupDownload.saveDownload({ filename, contents });
        setMessage({ kind: "success", text: en ? `Backup exported to Downloads/Riftbound: ${filename}` : `Sauvegarde exportée dans Téléchargements/Riftbound : ${filename}` });
      } catch {
        setMessage({ kind: "error", text: en ? "The backup could not be saved in Downloads. Try again." : "Impossible d’enregistrer la sauvegarde dans Téléchargements. Réessaie." });
      }
      return;
    }
    const blob = new Blob([contents], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    setMessage({ kind: "success", text: en ? "Backup exported ✓" : "Sauvegarde exportée ✓" });
  };

  const importBackupText = (raw: string) => {
    const parsed = parseCollectionBackup(raw);
    if (!parsed.ok) {
      setMessage({
        kind: "error",
        text: parsed.reason === "unsupported-version" ? (en ? "This backup uses an unsupported version." : "Cette sauvegarde utilise une version non prise en charge.") : (en ? "This file cannot be imported. The backup is invalid." : "Impossible d’importer ce fichier. La sauvegarde n’est pas valide."),
      });
      return;
    }
    const entries = Object.entries(parsed.backup.collection);
    const accepted = entries.filter(([impressionId]) => knownImpressionIds.has(impressionId));
    if (!accepted.length && entries.length) {
      setMessage({ kind: "error", text: en ? "None of the owned cards in this backup match the current catalogue." : "Aucune carte possédée de cette sauvegarde ne correspond au catalogue actuel." });
      return;
    }
    const next = { collection: Object.fromEntries(accepted), restored: accepted.length, ignored: entries.length - accepted.length };
    if (Object.keys(collection.state).length) setPendingRestore(next);
    else restore(next);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      importBackupText(await file.text());
    } catch {
      setMessage({ kind: "error", text: en ? "This file cannot be imported. The backup is invalid." : "Impossible d’importer ce fichier. La sauvegarde n’est pas valide." });
    }
  };

  const openBackupPicker = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const result = await FilePicker.pickFiles({
        types: ["application/json", "text/json"],
        limit: 1,
        readData: true,
      });
      const selected = result.files[0];
      if (!selected) return;
      if (!selected.data) throw new Error("file data unavailable");
      importBackupText(decodeBase64Utf8(selected.data));
    } catch (error) {
      if (error instanceof Error && /cancel/i.test(error.message)) return;
      setMessage({ kind: "error", text: en ? "This file could not be opened. Select a Riftbound JSON backup." : "Impossible d’ouvrir ce fichier. Sélectionne une sauvegarde Riftbound au format JSON." });
    }
  };

  return <section className="collection-backup" aria-labelledby="collection-backup-title">
    <div>
      <p className="eyebrow">{en ? "Local backup" : "Sauvegarde locale"}</p>
      <h2 id="collection-backup-title">{en ? "Collection backup" : "Sauvegarde de la collection"}</h2>
      <p>{en ? "Back up or restore your owned cards on this device. All other printings remain missing by default." : "Sauvegarde ou restaure tes cartes possédées sur cet appareil. Les autres impressions restent manquantes par défaut."}</p>
    </div>
    <div className="collection-backup-actions">
      <button type="button" onClick={() => { void exportBackup(); }}>{en ? "Export my collection" : "Exporter ma collection"}</button>
      <button type="button" className="secondary" onClick={() => { void openBackupPicker(); }}>{en ? "Import my collection" : "Importer ma collection"}</button>
      <button type="button" className="danger" onClick={() => setConfirmClear(true)}>{en ? "Delete my collection" : "Supprimer ma collection"}</button>
      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={(event) => { const [file] = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void importBackup(file); }} />
    </div>
    {message ? <p className={`collection-backup-message is-${message.kind}`} role="status">{message.text}</p> : null}
    {pendingRestore ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingRestore(null); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-restore-title"><p className="eyebrow">{en ? "Local backup" : "Sauvegarde locale"}</p><h2 id="collection-restore-title">{en ? "Restore this backup?" : "Restaurer cette sauvegarde ?"}</h2><p>{en ? "This operation will replace the owned cards currently stored on this device." : "Cette opération remplacera les cartes possédées actuellement enregistrées sur cet appareil."}</p><p className="collection-confirm-summary"><strong>{pendingRestore.restored}</strong> {en ? `owned printing${pendingRestore.restored > 1 ? "s" : ""} to restore` : `carte${pendingRestore.restored > 1 ? "s" : ""} possédée${pendingRestore.restored > 1 ? "s" : ""} à restaurer`}{pendingRestore.ignored ? <> · <strong>{pendingRestore.ignored}</strong> {en ? `unknown entr${pendingRestore.ignored > 1 ? "ies" : "y"} ignored` : `entrée${pendingRestore.ignored > 1 ? "s" : ""} non reconnue${pendingRestore.ignored > 1 ? "s" : ""} ignorée${pendingRestore.ignored > 1 ? "s" : ""}`}</> : null}</p><div><button type="button" className="secondary" onClick={() => setPendingRestore(null)}>{en ? "Cancel" : "Annuler"}</button><button type="button" onClick={() => restore(pendingRestore)}>{en ? "Restore" : "Restaurer"}</button></div></section></div>, document.body) : null}
    {confirmClear ? createPortal(<div className="collection-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmClear(false); }}><section className="collection-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-clear-title"><p className="eyebrow">{en ? "Local collection" : "Collection locale"}</p><h2 id="collection-clear-title">{en ? "Delete the whole collection?" : "Supprimer toute la collection ?"}</h2><p>{en ? "Every card marked as owned will be removed from this device. This action cannot be undone without a backup file." : "Toutes les cartes marquées comme possédées seront retirées de cet appareil. Cette action est irréversible sans fichier de sauvegarde."}</p><div><button type="button" className="secondary" onClick={() => setConfirmClear(false)}>{en ? "Cancel" : "Annuler"}</button><button type="button" className="danger" onClick={() => { collection.clear(); setConfirmClear(false); setMessage({ kind: "success", text: en ? "Collection deleted." : "Collection supprimée." }); }}>{en ? "Delete" : "Supprimer"}</button></div></section></div>, document.body) : null}
  </section>;
}

function CollectionList({ view, impressions, focusSetCode }: { view: Exclude<CollectionView, "home">; impressions: CollectionImpression[]; focusSetCode?: SetCode }) {
  const collection = useCollection();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const [query, setQuery] = useState("");
  const [setFilter, setSetFilter] = useState<"all" | SetCode>(focusSetCode ?? "all");
  const [rarity, setRarity] = useState("all");
  const [kind, setKind] = useState<"all" | VariantKind>("all");
  const [sort, setSort] = useState<SortMode>("number");
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [exclusions, setExclusions] = useState<Set<CollectionExclusion>>(() => new Set());
  const [preview, setPreview] = useState<CollectionImpression | null>(null);
  const [visibleCount, setVisibleCount] = useState(COLLECTION_BATCH_SIZE);
  const [jumpInput, setJumpInput] = useState("");
  const [jumpSetCode, setJumpSetCode] = useState<"all" | SetCode>(focusSetCode ?? "all");
  const [manageStatus, setManageStatus] = useState<"all" | DisplayStatus>("all");
  const [pendingJumpIndex, setPendingJumpIndex] = useState<number | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const targetStatus: DisplayStatus | null = view === "manage" ? null : view === "recent" ? "owned" : view;
  const focusedSet = focusSetCode ? SETS.find((set) => set.code === focusSetCode) : undefined;
  const scoped = useMemo(() => impressions.filter((impression) => !focusSetCode || impression.setCode === focusSetCode), [focusSetCode, impressions]);
  const filtered = useMemo(() => {
    const legacyAddedOrder = new Map(Object.keys(collection.state).map((impressionId, index) => [impressionId, index]));
    const normalized = query.trim().toLocaleLowerCase("fr");
    const matching = scoped.filter((impression) => {
      if (targetStatus && collection.getStatus(impression.impressionId) !== targetStatus) return false;
      if (!targetStatus && manageStatus !== "all" && collection.getStatus(impression.impressionId) !== manageStatus) return false;
      if (!focusSetCode && setFilter !== "all" && impression.setCode !== setFilter) return false;
      if (rarity !== "all" && impression.variant.rarity !== rarity) return false;
      if (kind !== "all" && impression.variant.kind !== kind) return false;
      if (exclusions.has(impression.variant.kind as CollectionExclusion)) return false;
      if (exclusions.has(impression.variant.rarity as CollectionExclusion)) return false;
      return !normalized || [impression.variant.name, impression.variant.number, impression.setName, impression.setCode, ...impression.row.domains].join(" ").toLocaleLowerCase("fr").includes(normalized);
    });
    const ordered = matching.sort((a, b) => {
      if (view === "recent") {
        const aAddedAt = Date.parse(collection.state[a.impressionId]?.addedAt ?? "");
        const bAddedAt = Date.parse(collection.state[b.impressionId]?.addedAt ?? "");
        if (Number.isFinite(aAddedAt) && Number.isFinite(bAddedAt)) return bAddedAt - aAddedAt;
        if (Number.isFinite(aAddedAt)) return -1;
        if (Number.isFinite(bAddedAt)) return 1;
        return (legacyAddedOrder.get(b.impressionId) ?? -1) - (legacyAddedOrder.get(a.impressionId) ?? -1);
      }
      if (sort === "name") return a.variant.name.localeCompare(b.variant.name, "fr");
      if (sort === "price-desc" || sort === "price-asc") { const aPrice = getCollectionPrice(a, priceMode); const bPrice = getCollectionPrice(b, priceMode); if (aPrice === null) return 1; if (bPrice === null) return -1; return sort === "price-desc" ? bPrice - aPrice : aPrice - bPrice; }
      return a.row.sortOrder - b.row.sortOrder || a.variant.number.localeCompare(b.variant.number, "fr");
    });
    return view === "recent" ? ordered.slice(0, 100) : ordered;
  }, [collection, exclusions, focusSetCode, kind, manageStatus, priceMode, query, rarity, scoped, setFilter, sort, targetStatus, view]);
  const visibleImpressions = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const normalizedJump = jumpInput.trim().toLowerCase().replace(/^0+(?=\d)/, "");
  const jumpTargetIndex = normalizedJump ? filtered.findIndex((impression) => {
    const cardNumber = impression.variant.number.trim().toLowerCase().replace(/^0+(?=\d)/, "");
    return (jumpSetCode === "all" || impression.setCode === jumpSetCode) && cardNumber === normalizedJump;
  }) : -1;
  const isValidJump = jumpTargetIndex >= 0;
  const resetVisibleList = () => {
    setVisibleCount(COLLECTION_BATCH_SIZE);
    setPendingJumpIndex(null);
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || visibleCount >= filtered.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleCount((current) => Math.min(filtered.length, current + COLLECTION_BATCH_SIZE));
    }, { rootMargin: "1000px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  useEffect(() => {
    if (pendingJumpIndex === null || pendingJumpIndex >= visibleCount) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-collection-position="${pendingJumpIndex + 1}"]`);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      setPendingJumpIndex(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingJumpIndex, visibleCount]);

  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 560);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const jumpToPosition = () => {
    if (!isValidJump) return;
    const targetIndex = jumpTargetIndex;
    setPendingJumpIndex(targetIndex);
    setVisibleCount((current) => Math.max(current, Math.min(filtered.length, Math.ceil((targetIndex + 1) / COLLECTION_BATCH_SIZE) * COLLECTION_BATCH_SIZE)));
  };
  const title = view === "missing" ? (en ? "Missing cards" : "Cartes manquantes") : view === "owned" ? (en ? "Owned cards" : "Cartes possédées") : view === "recent" ? (en ? "My last 100 added cards" : "Mes 100 dernières cartes ajoutées") : (en ? "Manage my cards" : "Gérer mes cartes");
  const description = view === "missing" ? (en ? "Printings still to add to your collection." : "Les impressions qu’il reste à ajouter à ta collection.") : view === "owned" ? (en ? "Printings already saved in your collection." : "Les impressions déjà classées dans ta collection.") : view === "recent" ? (en ? "The most recently added printings appear first." : "Les impressions ajoutées le plus récemment apparaissent en premier.") : (en ? "Mark each printing as owned or missing." : "Classe chaque impression comme possédée ou manquante.");
  return <main className="collection-shell">
    <Link className="collection-back-link" href="/collection">← {en ? "Back to my collection" : "Retour à Ma collection"}</Link>
    <div className="collection-heading"><div><p className="eyebrow" style={focusedSet ? { color: focusedSet.accent } : undefined}>{focusedSet ? `${en ? "My collection" : "Ma collection"} · ${getSetDisplayName(focusedSet, language)}` : (en ? "My collection" : "Ma collection")}</p><h1>{title}</h1><p>{description}</p></div><div className="collection-count"><strong>{filtered.length}</strong><span>{en ? `${filtered.length === 1 ? "printing shown" : "printings shown"}` : `impression${filtered.length > 1 ? "s" : ""} affichée${filtered.length > 1 ? "s" : ""}`}</span></div></div>
    <nav className="collection-subnav" aria-label={en ? "My collection sections" : "Sections de ma collection"}><Link href={collectionHref("missing", focusSetCode)} aria-current={view === "missing" ? "page" : undefined}>{en ? "Missing cards" : "Cartes manquantes"}</Link><Link href={collectionHref("owned", focusSetCode)} aria-current={view === "owned" ? "page" : undefined}>{en ? "Owned cards" : "Cartes possédées"}</Link><Link href={collectionHref("recent", focusSetCode)} aria-current={view === "recent" ? "page" : undefined}>{en ? "Recent additions" : "Ajouts récents"}</Link><Link href={collectionHref("manage", focusSetCode)} aria-current={view === "manage" ? "page" : undefined}>{en ? "Manage my cards" : "Gérer mes cartes"}</Link></nav>
    <label className="collection-search"><span>⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); resetVisibleList(); }} placeholder={focusedSet ? `${en ? "Search in" : "Rechercher dans"} ${getSetDisplayName(focusedSet, language)}…` : (en ? "Search a card, number, set or domain…" : "Rechercher une carte, un numéro, un set ou un domaine…")} /></label>
    <Filters focusSetCode={focusSetCode} setFilter={setFilter} onSetFilter={(value) => { setSetFilter(value); resetVisibleList(); }} rarity={rarity} onRarity={(value) => { setRarity(value); resetVisibleList(); }} kind={kind} onKind={(value) => { setKind(value); resetVisibleList(); }} sort={sort} onSort={(value) => { setSort(value); resetVisibleList(); }} priceMode={priceMode} onPriceMode={(value) => { setPriceMode(value); resetVisibleList(); }} exclusions={exclusions} onToggleExclusion={(value) => { setExclusions((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; }); resetVisibleList(); }} onClearExclusions={() => { setExclusions(new Set()); resetVisibleList(); }} />
    {view === "manage" ? <div className="collection-manage-filter" aria-label={en ? "Filter cards to manage" : "Filtrer les cartes à gérer"}><span>{en ? "Show" : "Afficher"}</span><button type="button" className={manageStatus === "all" ? "is-active" : ""} onClick={() => { setManageStatus("all"); resetVisibleList(); }}>{en ? "All" : "Toutes"}</button><button type="button" className={manageStatus === "owned" ? "is-active" : ""} onClick={() => { setManageStatus("owned"); resetVisibleList(); }}>{en ? "Owned" : "Possédées"}</button><button type="button" className={manageStatus === "missing" ? "is-active" : ""} onClick={() => { setManageStatus("missing"); resetVisibleList(); }}>{en ? "Missing" : "Manquantes"}</button></div> : null}
    <div className="collection-results-row"><div className="collection-results"><strong>{filtered.length}</strong> {en ? (filtered.length === 1 ? "printing" : "printings") : `impression${filtered.length > 1 ? "s" : ""}`}</div>{filtered.length ? <form className="collection-jump" onSubmit={(event) => { event.preventDefault(); jumpToPosition(); }}><label htmlFor={`collection-jump-${view}-${focusSetCode ?? "all"}`}>{en ? "Go to" : "Aller à"}</label>{!focusSetCode ? <select value={jumpSetCode} onChange={(event) => setJumpSetCode(event.target.value as "all" | SetCode)} aria-label={en ? "Card set" : "Set de la carte"}><option value="all">{en ? "All sets" : "Tous les sets"}</option>{SETS.map((set) => <option key={set.code} value={set.code}>{getSetDisplayName(set, language)}</option>)}</select> : null}<input id={`collection-jump-${view}-${focusSetCode ?? "all"}`} type="text" inputMode="text" placeholder="46, 46a, 46*" value={jumpInput} onChange={(event) => setJumpInput(event.target.value)} aria-label={en ? "Card number, for example 46, 46a or 46*" : "Numéro de carte, par exemple 46, 46a ou 46*"} /><button type="submit" aria-label={en ? "Go to this card" : "Aller à cette carte"} disabled={!isValidJump}>→</button></form> : null}</div>
    {filtered.length ? <><div className="collection-grid">{visibleImpressions.map((impression, index) => <ImpressionCard key={impression.impressionId} impression={impression} priceMode={priceMode} editable={view === "manage"} position={index + 1} onPreview={() => setPreview(impression)} />)}</div>{visibleCount < filtered.length ? <div ref={sentinelRef} className="collection-infinite-sentinel" aria-hidden="true" /> : null}</> : <div className="collection-empty"><span>◇</span><h2>{en ? "No cards match this list." : "Aucune carte ne correspond à cette liste."}</h2><p>{view === "manage" ? (en ? "Try another search or filter." : "Essaie avec une autre recherche ou un autre filtre.") : view === "recent" ? (en ? "Newly added cards will appear here." : "Les nouvelles cartes ajoutées apparaîtront ici.") : (en ? "Manage your cards to add or change a status." : "Gère tes cartes pour ajouter ou modifier un statut.")}</p></div>}
    {preview ? <CollectionCardDialog impression={preview} onClose={() => setPreview(null)} /> : null}
    <button type="button" className={`collection-back-to-top${showBackToTop ? " is-visible" : ""}`} aria-label={en ? "Back to top" : "Retour en haut"} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑</button>
  </main>;
}

export function CollectionPage({ view, focusSetCode, isMobileApp = false }: { view: CollectionView; focusSetCode?: SetCode; isMobileApp?: boolean }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const { impressions, loading, error } = useAllImpressions();
  const collection = useCollection();
  const [dashboardPriceMode, setDashboardPriceMode] = useState<PriceMode>("low");
  const dashboard = useMemo(() => {
    const masterSet = getCollectionProgress(impressions, collection.state);
    const numberedSet = getCollectionProgress(impressions, collection.state, (impression) => impression.row.isNumbered);
    const financials = getCollectionFinancialTotals(impressions, collection.state, dashboardPriceMode);
    const sets = SETS.map((set) => {
      const setImpressions = impressions.filter((impression) => impression.setCode === set.code);
      const setMaster = getCollectionProgress(setImpressions, collection.state);
      return {
        set,
        masterSet: setMaster,
        numberedSet: getCollectionProgress(setImpressions, collection.state, (impression) => impression.row.isNumbered),
        missing: setMaster.total - setMaster.owned,
        financials: getCollectionFinancialTotals(setImpressions, collection.state, dashboardPriceMode),
      };
    });
    return { masterSet, numberedSet, financials, sets };
  }, [collection, dashboardPriceMode, impressions]);
  const { masterSet, numberedSet, financials, sets: stats } = dashboard;
  const owned = masterSet.owned;
  const missing = masterSet.total - masterSet.owned;
  const recentAdditions = useMemo(
    // Collections created before timestamps were introduced still have a useful
    // insertion order. Count every owned card here so the overview matches the
    // recent-additions page instead of incorrectly showing zero.
    () => Object.values(collection.state).filter((entry) => entry.status === "owned").length,
    [collection.state],
  );
  return <div className="site-shell collection-site-shell"><SiteHeader />{loading ? <main className="collection-shell"><div className="collection-loading">{en ? "Loading collection…" : "Chargement de la collection…"}</div></main> : error ? <main className="collection-shell"><div className="collection-empty"><h2>{en ? "The collection could not be loaded." : "La collection n’a pas pu être chargée."}</h2><p>{en ? "Try again in a moment." : "Réessaie dans un instant."}</p></div></main> : view === "home" ? <main className="collection-shell">
    <div className="collection-heading"><div><p className="eyebrow">{en ? "Personal collection" : "Collection personnelle"}</p><h1>{en ? "My collection" : "Ma collection"}</h1><p>{en ? "Manage all Riftbound printings, directly on this device." : "Organise toutes tes impressions Riftbound, directement sur cet appareil."}</p></div></div>
    <section className="collection-dashboard" aria-label={en ? "My collection summary" : "Résumé de ma collection"}>
      <div className="collection-dashboard-kpi"><span>{en ? "Numbered set" : "Set numéroté"}</span><strong>{numberedSet.owned} / {numberedSet.total}</strong><p>{formatPercent(numberedSet.percentage)}</p><i><b style={{ width: `${numberedSet.percentage}%` }} /></i></div>
      <div className="collection-dashboard-kpi"><span>Master set</span><strong>{masterSet.owned} / {masterSet.total}</strong><p>{formatPercent(masterSet.percentage)}</p><i><b style={{ width: `${masterSet.percentage}%` }} /></i></div>
      <div className="collection-dashboard-kpi is-value"><span>{en ? "Owned value" : "Valeur possédée"}</span><strong>{formatPrice(financials.ownedValue.total)}</strong>{financials.ownedValue.withoutPrice ? <p>{financials.ownedValue.withoutPrice} {en ? "printing" : "impression"}{financials.ownedValue.withoutPrice > 1 ? "s" : ""} {en ? "without price" : "sans prix"}</p> : <p>{en ? "All owned printings" : "Toutes les impressions possédées"}</p>}</div>
      <div className="collection-dashboard-kpi is-value is-primary-cost"><span>{en ? "Remaining for numbered set" : "Restant pour le Set numéroté"}</span><strong>{formatPrice(financials.numberedMissingCost.total)}</strong><p>{en ? "Unowned printings in the numbered set" : "Impressions non possédées du set numéroté"}{financials.numberedMissingCost.withoutPrice ? ` · ${financials.numberedMissingCost.withoutPrice} ${en ? "without price" : "sans prix"}` : ""}</p></div>
      <div className="collection-dashboard-kpi is-value"><span>{en ? "Remaining for master set excluding signed" : "Restant pour le Master hors Signées"}</span><strong>{formatPrice(financials.unsignedMasterMissingCost.total)}</strong><p>{en ? "Unowned printings, signed excluded" : "Impressions non possédées, Signées exclues"}{financials.unsignedMasterMissingCost.withoutPrice ? ` · ${financials.unsignedMasterMissingCost.withoutPrice} ${en ? "without price" : "sans prix"}` : ""}</p></div>
      <div className="collection-dashboard-kpi is-value is-absolute-cost"><span>{en ? "Remaining for master set" : "Restant pour le Master set"}</span><strong>{formatPrice(financials.masterMissingCost.total)}</strong><p>{en ? "All unowned printings" : "Toutes les impressions non possédées"}{financials.masterMissingCost.withoutPrice ? ` · ${financials.masterMissingCost.withoutPrice} ${en ? "without price" : "sans prix"}` : ""}</p></div>
      <CustomSelect className="collection-dashboard-select" label={en ? "Displayed value" : "Valeur utilisée"} value={dashboardPriceMode} onChange={(value) => setDashboardPriceMode(value as PriceMode)} options={[{ value: "low", label: en ? "Lowest price" : "Prix minimum" }, { value: "trend", label: en ? "Cardmarket trend" : "Tendance Cardmarket" }, { value: "avg30", label: en ? "30-day average" : "Moyenne 30 jours" }]} />
    </section>
    <section className="collection-overview-cards"><Link href="/collection/missing" className="collection-overview-card missing"><span>◇</span><div><small>{en ? "To complete" : "À compléter"}</small><h2>{en ? "Missing cards" : "Cartes manquantes"}</h2><p>{en ? "Prepare your shopping list and compare prices at a glance." : "Prépare ta liste d’achat et compare les prix en un coup d’œil."}</p></div><strong>{missing}</strong><em>{en ? "View list →" : "Voir la liste →"}</em></Link><Link href="/collection/owned" className="collection-overview-card owned"><span>✦</span><div><small>{en ? "Already in binder" : "Déjà dans le classeur"}</small><h2>{en ? "Owned cards" : "Cartes possédées"}</h2><p>{en ? "Find your saved printings and progress per set." : "Retrouve tes impressions classées et ta progression par set."}</p></div><strong>{owned}</strong><em>{en ? "View list →" : "Voir la liste →"}</em></Link><Link href="/collection/recent" className="collection-overview-card manage"><span>↺</span><div><small>{en ? "Collection history" : "Historique de collection"}</small><h2>{en ? "Recent additions" : "Ajouts récents"}</h2><p>{en ? "View your last 100 added cards, newest first." : "Vois tes 100 dernières cartes ajoutées, de la plus récente à la plus ancienne."}</p></div><strong>{Math.min(100, recentAdditions)}</strong><em>{en ? "View additions →" : "Voir les ajouts →"}</em></Link><Link href="/collection/manage" className="collection-overview-card manage"><span>☷</span><div><small>{en ? "Organisation" : "Organisation"}</small><h2>{en ? "Manage my cards" : "Gérer mes cartes"}</h2><p>{en ? "Mark each printing as owned or missing." : "Classe chaque impression comme possédée ou manquante."}</p></div><strong>{masterSet.total}</strong><em>{en ? "Manage collection →" : "Gérer la collection →"}</em></Link></section>
    {isMobileApp ? <CardScanner impressions={impressions} /> : null}
    <CollectionBackupControls impressions={impressions} />
    <section className="collection-breakdown"><div><p className="eyebrow">{en ? "Progress by set" : "Progression par set"}</p><h2>{en ? "The first four sets" : "Les quatre premiers sets"}</h2></div><div className="collection-breakdown-grid">{stats.map(({ set, numberedSet: setNumbered, masterSet: setMaster, missing: setMissing, financials: setFinancials }) => <Link href={`/collection/${set.slug}/missing`} key={set.code} className="collection-set-progress" style={{ "--local-accent": set.accent } as CSSProperties}><span>{getSetDisplayName(set, language)}</span><div className="collection-set-metrics"><p>{en ? "Numbered set" : "Set numéroté"} <strong>{setNumbered.owned} / {setNumbered.total}</strong> · {formatPercent(setNumbered.percentage)}</p><p>Master set <strong>{setMaster.owned} / {setMaster.total}</strong> · {formatPercent(setMaster.percentage)}</p></div><p>{setMissing} {en ? "missing" : `manquante${setMissing > 1 ? "s" : ""}`}</p><div className="collection-set-financial"><small>{en ? "Owned value" : "Valeur possédée"} <b>{formatPrice(setFinancials.ownedValue.total)}</b></small><p className="collection-set-financial-label">{en ? "Still to acquire" : "Reste à acquérir"}</p><small className="is-primary">{en ? "Numbered set" : "Set numéroté"} <b>{formatPrice(setFinancials.numberedMissingCost.total)}</b></small><small>{en ? "Master excluding signed" : "Master hors Signées"} <b>{formatPrice(setFinancials.unsignedMasterMissingCost.total)}</b></small><small className="is-absolute">Master set <b>{formatPrice(setFinancials.masterMissingCost.total)}</b></small></div><i><b style={{ width: `${setMaster.percentage}%` }} /></i></Link>)}</div></section>
    {isMobileApp ? <OfflineImageControls imageUrls={impressions.map((impression) => impression.variant.imageUrl)} /> : null}
  </main> : <CollectionList view={view} impressions={impressions} focusSetCode={focusSetCode} />}<footer className="site-footer"><div><strong>{en ? "Riftbound — Catalogue & prices" : "Riftbound — Catalogue & prix"}</strong><p>{en ? "Your collection is stored locally on this device." : "Ta collection est mémorisée localement sur cet appareil."}</p><p>{en ? "This is an independent project and is not affiliated with, sponsored by, or approved by Riot Games, Riftbound or Cardmarket." : "Ce site est un projet indépendant et n’est ni affilié, ni sponsorisé, ni approuvé par Riot Games, Riftbound ou Cardmarket."}</p></div><p>{en ? "Riftbound, League of Legends and Cardmarket belong to their respective owners." : "Riftbound, League of Legends et Cardmarket appartiennent à leurs propriétaires respectifs."}</p></footer></div>;
}
