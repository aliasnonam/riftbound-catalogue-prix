import type { CatalogPayload, PriceGuide } from "@/lib/catalog";
import type { CollectionState } from "@/lib/collection";

const DATABASE = "riftbound-catalogue";
const VERSION = 1;
const STATE_KEY = "collection-state";
const PRICE_CACHE_KEY = "site-price-guide";

export type MobilePriceCache = {
  updatedAt: string;
  sourceStatus: "live" | "snapshot";
  priceGuides: PriceGuide[];
};

type CacheRecord = { key: string; value: unknown; updatedAt: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("cache")) {
        request.result.createObjectStore("cache", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string): Promise<T | null> {
  const database = await openDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const request = database.transaction("cache", "readonly").objectStore("cache").get(key);
    request.onsuccess = () => resolve(((request.result as CacheRecord | undefined)?.value as T) ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

async function write(key: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction("cache", "readwrite").objectStore("cache").put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies CacheRecord);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

export const androidStorage = {
  readCollection: () => read<CollectionState>(STATE_KEY),
  saveCollection: (state: CollectionState) => write(STATE_KEY, state),
  readCatalog: (setCode: string) => read<CatalogPayload>(`catalog:${setCode}`),
  saveCatalog: (payload: CatalogPayload) => write(`catalog:${payload.set.code}`, payload),
  readPriceCache: () => read<MobilePriceCache>(PRICE_CACHE_KEY),
  savePriceCache: (cache: MobilePriceCache) => write(PRICE_CACHE_KEY, cache),
};
