"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CachedCardImage } from "@/app/components/offline-image";
import { useSiteLanguage } from "@/app/lib/site-language";
import type { CollectionImpression } from "@/lib/collection";
import {
  calculatePriceDifference,
  calculatePriceDifferencePercent,
  calculateSessionTotals,
  getPurchasePriceTone,
  normaliseSellerPrice,
  type PurchaseSession,
  type PurchaseSessionItem,
} from "@/lib/purchase-sessions";
import { useCollection } from "@/hooks/use-collection";
import { usePurchaseSessions } from "@/hooks/use-purchase-sessions";

const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
type Sort = "deal" | "saving" | "seller-asc" | "seller-desc" | "market" | "added";

function formatPrice(value: number | null) { return value === null ? "—" : EURO.format(value); }
function formatDifference(value: number | null) { return value === null ? "—" : `${value > 0 ? "+" : ""}${EURO.format(value)}`; }

export function PurchaseSessionsPage({ impressions }: { impressions: CollectionImpression[] }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const purchases = usePurchaseSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = purchases.sessions.find((session) => session.id === selectedId) ?? null;

  return <main className="collection-shell purchase-sessions-shell">
    <Link className="collection-back-link" href="/outils">← {en ? "Back to tools" : "Retour aux outils"}</Link>
    <div className="collection-heading"><div><p className="eyebrow">{en ? "Purchase mode" : "Mode achat"}</p><h1>{en ? "Potential purchases" : "Achats potentiels"}</h1><p>{en ? "Your seller sessions are stored only on this device." : "Tes sessions chez les vendeurs sont enregistrées uniquement sur cet appareil."}</p></div></div>
    {selected ? <PurchaseSessionDetail session={selected} impressions={impressions} onBack={() => setSelectedId(null)} /> : <div className="purchase-session-list">{purchases.sessions.length ? purchases.sessions.map((session) => <PurchaseSessionSummary key={session.id} session={session} onOpen={() => setSelectedId(session.id)} />) : <div className="collection-empty"><span>◇</span><h2>{en ? "No potential purchases yet." : "Aucun achat potentiel pour le moment."}</h2><p>{en ? "Start Purchase mode from Tools to scan cards at a seller." : "Démarre le Mode achat depuis Outils pour scanner des cartes chez un vendeur."}</p></div>}</div>}
  </main>;
}

function PurchaseSessionSummary({ session, onOpen }: { session: PurchaseSession; onOpen: () => void }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const totals = calculateSessionTotals(session.items);
  return <article className="purchase-session-summary"><div><p className="eyebrow">{new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.createdAt))}</p><h2>{session.name}</h2><p>{totals.count} {en ? (totals.count === 1 ? "card" : "cards") : `carte${totals.count > 1 ? "s" : ""}`}</p></div><dl><div><dt>{en ? "Seller price" : "Prix vendeur"}</dt><dd>{formatPrice(totals.sellerTotal)}</dd></div><div><dt>{en ? "Cardmarket value" : "Valeur Cardmarket"}</dt><dd>{formatPrice(totals.cardmarketTotal)}</dd></div><div><dt>{en ? "Difference" : "Économie"}</dt><dd className={totals.difference !== null && totals.difference < 0 ? "is-saving" : ""}>{totals.difference === null ? "—" : formatDifference(-totals.difference)}</dd></div></dl><button type="button" onClick={onOpen}>{en ? "Open" : "Ouvrir"}</button></article>;
}

function PurchaseSessionDetail({ session, impressions, onBack }: { session: PurchaseSession; impressions: CollectionImpression[]; onBack: () => void }) {
  const collection = useCollection();
  const purchases = usePurchaseSessions();
  const { language } = useSiteLanguage();
  const en = language === "en";
  const [sort, setSort] = useState<Sort>("deal");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const totals = calculateSessionTotals(session.items);
  const sortedItems = useMemo(() => [...session.items].sort((a, b) => compareItems(a, b, sort)), [session.items, sort]);
  const addSelectedToCollection = () => {
    for (const item of session.items) {
      if (!selectedItems.has(item.id)) continue;
      const impression = impressions.find((candidate) => candidate.impressionId === item.impressionId);
      if (impression) collection.setOwned(impression.impressionId);
    }
    setSelectedItems(new Set());
  };
  const toggle = (itemId: string) => setSelectedItems((current) => { const next = new Set(current); if (next.has(itemId)) next.delete(itemId); else next.add(itemId); return next; });
  const deleteSession = () => { purchases.deleteSession(session.id); onBack(); };

  return <section className="purchase-session-detail"><button type="button" className="purchase-back-button" onClick={onBack}>← {en ? "All sessions" : "Toutes les sessions"}</button><div className="purchase-session-detail-heading"><div><p className="eyebrow">{en ? "Potential purchase" : "Achat potentiel"}</p><h2>{session.name}</h2></div><button type="button" className="danger" onClick={() => setConfirmDelete(true)}>{en ? "Delete session" : "Supprimer la session"}</button></div><div className="purchase-totals"><div><span>{en ? "Cards" : "Cartes"}</span><strong>{totals.count}</strong></div><div><span>{en ? "Cardmarket value" : "Valeur Cardmarket"}</span><strong>{formatPrice(totals.cardmarketTotal)}</strong></div><div><span>{en ? "Seller price" : "Prix vendeur"}</span><strong>{formatPrice(totals.sellerTotal)}</strong></div><div className={totals.difference !== null && totals.difference < 0 ? "is-saving" : ""}><span>{en ? "Saving" : "Économie"}</span><strong>{totals.difference === null ? "—" : formatDifference(-totals.difference)}</strong><small>{totals.differencePercent === null ? "" : `${totals.differencePercent > 0 ? "+" : ""}${totals.differencePercent.toLocaleString(language === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} %`}</small></div></div><div className="purchase-session-controls"><label>{en ? "Sort" : "Trier"}<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="deal">{en ? "Best deal %" : "Meilleure affaire %"}</option><option value="saving">{en ? "Largest saving €" : "Plus grosse économie €"}</option><option value="seller-asc">{en ? "Seller price low to high" : "Prix vendeur croissant"}</option><option value="seller-desc">{en ? "Seller price high to low" : "Prix vendeur décroissant"}</option><option value="market">{en ? "Cardmarket price" : "Prix Cardmarket"}</option><option value="added">{en ? "Order added" : "Ordre d’ajout"}</option></select></label>{selectedItems.size ? <button type="button" onClick={addSelectedToCollection}>{en ? `Add ${selectedItems.size} card${selectedItems.size > 1 ? "s" : ""} to my collection` : `Ajouter ${selectedItems.size} carte${selectedItems.size > 1 ? "s" : ""} à ma collection`}</button> : null}</div><div className="purchase-items">{sortedItems.map((item) => <PurchaseItemRow key={item.id} item={item} selected={selectedItems.has(item.id)} onToggle={() => toggle(item.id)} onUpdatePrice={(sellerPrice) => purchases.updateSellerPrice(session.id, item.id, sellerPrice)} onDelete={() => purchases.deleteItem(session.id, item.id)} />)}</div>{confirmDelete ? <div className="collection-confirm-backdrop" role="presentation"><section className="collection-confirm-dialog" role="dialog" aria-modal="true"><p className="eyebrow">{en ? "Potential purchase" : "Achat potentiel"}</p><h2>{en ? "Delete this session?" : "Supprimer cette session ?"}</h2><p>{en ? "All cards saved in this potential purchase will be removed. Your collection will not change." : "Toutes les cartes de cet achat potentiel seront supprimées. Ta collection ne sera pas modifiée."}</p><div><button className="secondary" type="button" onClick={() => setConfirmDelete(false)}>{en ? "Cancel" : "Annuler"}</button><button className="danger" type="button" onClick={deleteSession}>{en ? "Delete" : "Supprimer"}</button></div></section></div> : null}</section>;
}

function PurchaseItemRow({ item, selected, onToggle, onUpdatePrice, onDelete }: { item: PurchaseSessionItem; selected: boolean; onToggle: () => void; onUpdatePrice: (price: number | null) => void; onDelete: () => void }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  const [priceInput, setPriceInput] = useState(item.sellerPrice === null ? "" : item.sellerPrice.toFixed(2).replace(".", ","));
  const difference = calculatePriceDifference(item.sellerPrice, item.cardmarketPrice);
  const differencePercent = calculatePriceDifferencePercent(item.sellerPrice, item.cardmarketPrice);
  const tone = getPurchasePriceTone(differencePercent);
  const commit = () => { const normalized = normaliseSellerPrice(priceInput); onUpdatePrice(normalized); setPriceInput(normalized === null ? "" : normalized.toFixed(2).replace(".", ",")); };
  return <article className="purchase-item-row"><label className="purchase-bought"><input type="checkbox" checked={selected} onChange={onToggle} /><span>{en ? "Bought" : "Achetée"}</span></label><CachedCardImage className="purchase-item-art" src={item.imageUrl ?? undefined} alt={item.name} /><div className="purchase-item-copy"><p className={`purchase-ownership ${item.collectionStatus === "owned" ? "is-owned" : "is-missing"}`}>{item.collectionStatus === "owned" ? (en ? "✓ Owned" : "✓ Possédée") : (en ? "✕ Missing" : "✕ Manquante")}</p><h3>{item.name}</h3><p>{item.setName} · #{item.number} · {item.variant} · {item.rarity}</p><a className="collection-cardmarket-link" href={item.cardmarketUrl ?? "#"} target="_blank" rel="noopener noreferrer">{en ? "View on Cardmarket ↗" : "Voir sur Cardmarket ↗"}</a></div><dl><div><dt>Cardmarket</dt><dd>{formatPrice(item.cardmarketPrice)}</dd><small>{item.priceMode === "low" ? (en ? "Lowest price" : "Prix minimum") : item.priceMode === "trend" ? (en ? "Trend" : "Tendance") : (en ? "30-day average" : "Moyenne 30 jours")}</small></div><label>{en ? "Seller price" : "Prix vendeur"}<input inputMode="decimal" value={priceInput} onChange={(event) => setPriceInput(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="—" /></label><div className={`purchase-difference is-${tone}`}><dt>{en ? "Difference" : "Écart"}</dt><dd>{formatDifference(difference)}</dd><small>{differencePercent === null ? "" : `${differencePercent > 0 ? "+" : ""}${differencePercent.toLocaleString(language === "en" ? "en-GB" : "fr-FR", { maximumFractionDigits: 1 })} %`}</small></div></dl><button type="button" className="purchase-remove" onClick={onDelete}>{en ? "Remove" : "Retirer"}</button></article>;
}

function compareItems(a: PurchaseSessionItem, b: PurchaseSessionItem, sort: Sort) {
  const percentage = (item: PurchaseSessionItem) => calculatePriceDifferencePercent(item.sellerPrice, item.cardmarketPrice);
  const difference = (item: PurchaseSessionItem) => calculatePriceDifference(item.sellerPrice, item.cardmarketPrice);
  if (sort === "deal") return (percentage(a) ?? Infinity) - (percentage(b) ?? Infinity);
  if (sort === "saving") return (difference(a) ?? Infinity) - (difference(b) ?? Infinity);
  if (sort === "seller-asc") return (a.sellerPrice ?? Infinity) - (b.sellerPrice ?? Infinity);
  if (sort === "seller-desc") return (b.sellerPrice ?? -Infinity) - (a.sellerPrice ?? -Infinity);
  if (sort === "market") return (b.cardmarketPrice ?? -Infinity) - (a.cardmarketPrice ?? -Infinity);
  return Date.parse(b.addedAt) - Date.parse(a.addedAt);
}
