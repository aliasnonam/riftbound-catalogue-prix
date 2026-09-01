import { useEffect, useMemo, useState } from "react";
import rawCards from "@/data/card-catalog.json";
import priceSnapshot from "@/data/cardmarket-prices.json";
import productSnapshot from "@/data/cardmarket-products.json";
import { buildCatalog, type CatalogPayload, type CatalogRow, type PriceGuide, type RawCard } from "@/lib/catalog";
import { type CollectionState, withCollectionStatus } from "@/lib/collection";
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
  const rows = useMemo(() => payload.rows.filter((row) => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return !needle || `${row.name} ${row.number} ${row.rarity} ${row.domains.join(" ")}`.toLocaleLowerCase("fr").includes(needle);
  }), [payload.rows, query]);

  const setOwned = (row: CatalogRow) => {
    const next = withCollectionStatus(collection, row.id, collection[row.id]?.status === "owned" ? "missing" : "owned");
    setCollection(next);
    void androidStorage.saveCollection(next);
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

  return <main>
    <header><p>RIFTBOUND</p><h1>Catalogue</h1><small>{payload.set.name} · prix au {new Date(payload.pricesUpdatedAt).toLocaleDateString("fr-FR")}</small></header>
    <nav aria-label="Sets">{SETS.map((set) => <button className={set.code === setCode ? "active" : ""} key={set.code} onClick={() => setSetCode(set.code)}>{set.code}</button>)}</nav>
    <section className="actions">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une carte…" type="search" />
      <button onClick={() => void syncPrices()} disabled={syncing}>{syncing ? "Synchronisation…" : "Actualiser les prix"}</button>
    </section>
    <p className="notice">{message}</p>
    <p className="count">{rows.length} cartes · touche une carte pour l’ajouter ou la retirer de ta collection</p>
    <section className="cards">{rows.map((row) => <article className={collection[row.id]?.status === "owned" ? "owned" : ""} key={row.id} onClick={() => setOwned(row)}>
      {row.imageUrl ? <img loading="lazy" src={row.imageUrl} alt="" /> : <div className="placeholder">{row.number}</div>}
      <div><strong>{row.name}</strong><span>#{row.number} · {row.rarity}</span><b>{currency(rowPrice(row))}</b></div>
      <em>{collection[row.id]?.status === "owned" ? "Possédée" : "À ajouter"}</em>
    </article>)}</section>
  </main>;
}
