import { useEffect, useMemo, useState } from "react";
import rawCards from "@/data/card-catalog.json";
import priceSnapshot from "@/data/cardmarket-prices.json";
import productSnapshot from "@/data/cardmarket-products.json";
import { buildCatalog, type CatalogPayload, type CatalogRow, type PriceGuide, type RawCard } from "@/lib/catalog";
import {
  collectionBackupFilename,
  createCollectionBackup,
  flattenCatalogPayload,
  getCollectionFinancialTotals,
  getCollectionProgress,
  getCollectionStatus,
  isCollectionFoil,
  parseCollectionBackup,
  type CollectionImpression,
  type CollectionState,
  withCollectionFoil,
  withCollectionStatus,
} from "@/lib/collection";
import type { PriceMode } from "@/lib/pricing";
import { SETS, type SetCode } from "@/lib/sets";
import { androidStorage } from "./storage";

const API_ORIGIN = "https://riftbound-catalogue-prix.hydegoody.chatgpt.site";

function bundledCatalog(code: SetCode): CatalogPayload {
  const set = SETS.find((candidate) => candidate.code === code)!;
  return buildCatalog({
    set,
    cards: rawCards as RawCard[],
    products: productSnapshot.products,
    prices: priceSnapshot.priceGuides as PriceGuide[],
    pricesUpdatedAt: priceSnapshot.createdAt,
    productsUpdatedAt: productSnapshot.createdAt,
    refreshAvailableAt: null,
    sourceStatus: "snapshot",
  });
}

function currency(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function rowPrice(row: CatalogRow) {
  const variant = row.variants[0];
  if (!variant) return null;
  return variant.pricing === "dual" ? variant.normal.low : variant.price.low;
}

export function App() {
  const [setCode, setSetCode] = useState<SetCode>("OGN");
  const [catalogs, setCatalogs] = useState<Record<string, CatalogPayload>>({});
  const [collection, setCollection] = useState<CollectionState>({});
  const [query, setQuery] = useState("");
  const [screen, setScreen] = useState<"catalog" | "collection">("catalog");
  const [collectionFilter, setCollectionFilter] = useState<"all" | "owned" | "missing">("all");
  const [priceMode, setPriceMode] = useState<PriceMode>("low");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("Catalogue embarqué — prêt hors connexion.");

  useEffect(() => {
    void (async () => {
      const cached = await Promise.all(SETS.map(async (set) => [set.code, await androidStorage.readCatalog(set.code)] as const));
      setCatalogs(Object.fromEntries(cached.map(([code, payload]) => [code, payload ?? bundledCatalog(code)])));
      setCollection((await androidStorage.readCollection()) ?? {});
    })().catch(() => setMessage("Le stockage local est indisponible sur cet appareil."));
  }, []);

  const payload = catalogs[setCode] ?? bundledCatalog(setCode);
  const allPayloads = SETS.map((set) => catalogs[set.code] ?? bundledCatalog(set.code));
  const impressions = useMemo(() => allPayloads.flatMap(flattenCatalogPayload), [catalogs]);
  const rows = useMemo(() => payload.rows.filter((row) => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return !needle || `${row.name} ${row.number} ${row.rarity} ${row.domains.join(" ")}`.toLocaleLowerCase("fr").includes(needle);
  }), [payload.rows, query]);

  const persist = (next: CollectionState) => {
    setCollection(next);
    void androidStorage.saveCollection(next);
  };

  const setOwned = (impression: CollectionImpression) => persist(withCollectionStatus(
    collection,
    impression.impressionId,
    getCollectionStatus(collection, impression.impressionId) === "owned" ? "missing" : "owned",
  ));

  const toggleFoil = (impression: CollectionImpression) => {
    if (impression.variant.pricing !== "dual") return;
    persist(withCollectionFoil(collection, impression, !isCollectionFoil(collection, impression)));
  };

  const exportCollection = () => {
    const blob = new Blob([JSON.stringify(createCollectionBackup(collection), null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href; link.download = collectionBackupFilename(); link.click();
    URL.revokeObjectURL(href);
  };

  const importCollection = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseCollectionBackup(await file.text());
    if (!parsed.ok) { setMessage("Sauvegarde invalide ou version non prise en charge."); return; }
    persist(parsed.backup.collection);
    setMessage("Collection restaurée sur cet appareil.");
  };

  const syncPrices = async () => {
    if (!navigator.onLine) {
      setMessage("Hors connexion : les derniers prix enregistrés restent affichés.");
      return;
    }
    setSyncing(true);
    try {
      const remote = await Promise.all(SETS.map(async (set) => {
        const response = await fetch(`${API_ORIGIN}/api/catalog?set=${set.code}`);
        if (!response.ok) throw new Error("catalog unavailable");
        return await response.json() as CatalogPayload;
      }));
      await Promise.all(remote.map((item) => androidStorage.saveCatalog(item)));
      setCatalogs(Object.fromEntries(remote.map((item) => [item.set.code, item])));
      setMessage(`Prix synchronisés : ${new Date().toLocaleString("fr-FR")}.`);
    } catch {
      setMessage("Synchronisation impossible : les données locales sont conservées.");
    } finally {
      setSyncing(false);
    }
  };

  const collectionRows = impressions.filter((impression) => collectionFilter === "all" || getCollectionStatus(collection, impression.impressionId) === collectionFilter)
    .filter((impression) => !query.trim() || `${impression.variant.name} ${impression.variant.number} ${impression.setName}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  const totals = getCollectionFinancialTotals(impressions, collection, priceMode);
  const progress = getCollectionProgress(impressions, collection);

  return <main>
    <header><p>RIFTBOUND</p><h1>Catalogue</h1><small>{payload.set.name} · prix au {new Date(payload.pricesUpdatedAt).toLocaleDateString("fr-FR")}</small></header>
    <nav aria-label="Navigation"><button className={screen === "catalog" ? "active" : ""} onClick={() => setScreen("catalog")}>Catalogue</button><button className={screen === "collection" ? "active" : ""} onClick={() => setScreen("collection")}>Ma collection</button></nav>
    {screen === "catalog" ? <>
    <nav aria-label="Sets">{SETS.map((set) => <button className={set.code === setCode ? "active" : ""} key={set.code} onClick={() => setSetCode(set.code)}>{set.code}</button>)}</nav>
    <section className="actions">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une carte…" type="search" />
      <button onClick={() => void syncPrices()} disabled={syncing}>{syncing ? "Synchronisation…" : "Actualiser les prix"}</button>
    </section>
    <p className="notice">{message}</p>
    <p className="count">{rows.length} cartes · touche une carte pour l’ajouter ou la retirer de ta collection</p>
    <section className="cards">{rows.map((row) => { const impression = flattenCatalogPayload(payload).find((item) => item.row.id === row.id); return <article className={impression && getCollectionStatus(collection, impression.impressionId) === "owned" ? "owned" : ""} key={row.id} onClick={() => impression && setOwned(impression)}>
      {row.imageUrl ? <img loading="lazy" src={row.imageUrl} alt="" /> : <div className="placeholder">{row.number}</div>}
      <div><strong>{row.name}</strong><span>#{row.number} · {row.rarity}</span><b>{currency(rowPrice(row))}</b></div>
      <em>{impression && getCollectionStatus(collection, impression.impressionId) === "owned" ? "Possédée" : "À ajouter"}</em>
    </article>; })}</section></> : <>
      <section className="dashboard">
        <div><span>Possédées</span><b>{progress.owned} / {progress.total}</b></div>
        <div><span>Manquantes</span><b>{progress.total - progress.owned}</b></div>
        <div><span>Reste à acquérir</span><b>{currency(totals.masterMissingCost.total)}</b></div>
      </section>
      <section className="actions collection-actions"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans ma collection…" type="search" /><select value={priceMode} onChange={(event) => setPriceMode(event.target.value as PriceMode)}><option value="low">Prix minimum</option><option value="trend">Tendance</option><option value="avg30">Moyenne 30 j</option></select></section>
      <nav aria-label="Filtre collection"><button className={collectionFilter === "all" ? "active" : ""} onClick={() => setCollectionFilter("all")}>Gérer ({progress.total})</button><button className={collectionFilter === "owned" ? "active" : ""} onClick={() => setCollectionFilter("owned")}>Possédées ({progress.owned})</button><button className={collectionFilter === "missing" ? "active" : ""} onClick={() => setCollectionFilter("missing")}>Manquantes ({progress.total - progress.owned})</button></nav>
      <section className="backup"><button onClick={exportCollection}>Exporter ma collection</button><label>Importer<input type="file" accept="application/json" onChange={(event) => void importCollection(event.target.files?.[0])} /></label></section>
      <section className="cards">{collectionRows.map((impression) => <article className={getCollectionStatus(collection, impression.impressionId) === "owned" ? "owned" : ""} key={impression.impressionId}>
        {impression.variant.imageUrl ? <img loading="lazy" src={impression.variant.imageUrl} alt="" /> : <div className="placeholder">{impression.variant.number}</div>}
        <div><strong>{impression.variant.name}</strong><span>{impression.setName} · #{impression.variant.number}</span><b>{currency(impression.variant.pricing === "dual" ? impression.variant.normal[priceMode] : impression.variant.price[priceMode])}</b></div>
        <div className="manage"><button onClick={() => setOwned(impression)}>{getCollectionStatus(collection, impression.impressionId) === "owned" ? "Retirer" : "Possédée"}</button>{impression.variant.pricing === "dual" && getCollectionStatus(collection, impression.impressionId) === "owned" ? <button onClick={() => toggleFoil(impression)} className={isCollectionFoil(collection, impression) ? "active" : ""}>Foil</button> : null}</div>
      </article>)}</section>
    </>}
  </main>;
}
