import type { CollectionImpression } from "@/lib/collection";
import { getPrimaryVariantPrice, type PriceMode } from "@/lib/pricing";

export const PURCHASE_SESSIONS_STORAGE_KEY = "riftbound-purchase-sessions-v1";
export const PURCHASE_SESSIONS_CHANGE_EVENT = "riftbound-purchase-sessions-change";
export const PURCHASE_SESSIONS_VERSION = 1;

export type PurchaseSessionItem = {
  id: string;
  impressionId: string;
  name: string;
  setCode: string;
  setName: string;
  number: string;
  variant: string;
  rarity: string;
  imageUrl: string | null;
  cardmarketUrl: string | null;
  collectionStatus: "owned" | "missing";
  cardmarketPrice: number | null;
  priceMode: PriceMode;
  sellerPrice: number | null;
  addedAt: string;
};

export type PurchaseSession = {
  id: string;
  name: string;
  createdAt: string;
  items: PurchaseSessionItem[];
};

export type PurchaseSessionsState = {
  version: typeof PURCHASE_SESSIONS_VERSION;
  sessions: PurchaseSession[];
};

export type PurchaseTotals = {
  count: number;
  cardmarketTotal: number;
  sellerTotal: number;
  difference: number | null;
  differencePercent: number | null;
  withoutSellerPrice: number;
  withoutCardmarketPrice: number;
};

export const PURCHASE_PRICE_THRESHOLDS = {
  excellent: -20,
  good: -5,
  close: 5,
  high: 20,
} as const;

export type PurchasePriceTone = "excellent" | "good" | "neutral" | "high" | "very-high";

export function calculatePriceDifference(sellerPrice: number | null, cardmarketPrice: number | null) {
  return sellerPrice === null || cardmarketPrice === null ? null : sellerPrice - cardmarketPrice;
}

export function calculatePriceDifferencePercent(sellerPrice: number | null, cardmarketPrice: number | null) {
  if (sellerPrice === null || cardmarketPrice === null || cardmarketPrice <= 0) return null;
  return ((sellerPrice - cardmarketPrice) / cardmarketPrice) * 100;
}

export function getPurchasePriceTone(differencePercent: number | null): PurchasePriceTone {
  if (differencePercent === null) return "neutral";
  if (differencePercent <= PURCHASE_PRICE_THRESHOLDS.excellent) return "excellent";
  if (differencePercent < PURCHASE_PRICE_THRESHOLDS.good) return "good";
  if (differencePercent <= PURCHASE_PRICE_THRESHOLDS.close) return "neutral";
  if (differencePercent <= PURCHASE_PRICE_THRESHOLDS.high) return "high";
  return "very-high";
}

export function normaliseSellerPrice(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

export function calculateSessionTotals(items: readonly PurchaseSessionItem[]): PurchaseTotals {
  const cardmarketItems = items.filter((item) => item.cardmarketPrice !== null);
  const sellerItems = items.filter((item) => item.sellerPrice !== null);
  const comparable = items.filter((item) => item.cardmarketPrice !== null && item.sellerPrice !== null);
  const cardmarketTotal = cardmarketItems.reduce((sum, item) => sum + (item.cardmarketPrice ?? 0), 0);
  const sellerTotal = sellerItems.reduce((sum, item) => sum + (item.sellerPrice ?? 0), 0);
  const comparableCardmarket = comparable.reduce((sum, item) => sum + (item.cardmarketPrice ?? 0), 0);
  const comparableSeller = comparable.reduce((sum, item) => sum + (item.sellerPrice ?? 0), 0);
  return {
    count: items.length,
    cardmarketTotal,
    sellerTotal,
    difference: comparable.length ? comparableSeller - comparableCardmarket : null,
    differencePercent: comparableCardmarket > 0 ? ((comparableSeller - comparableCardmarket) / comparableCardmarket) * 100 : null,
    withoutSellerPrice: items.length - sellerItems.length,
    withoutCardmarketPrice: items.length - cardmarketItems.length,
  };
}

export function createPurchaseSession(name: string, now = new Date()): PurchaseSession {
  const createdAt = now.toISOString();
  const fallback = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(now);
  return {
    id: `purchase-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `Achat potentiel - ${fallback}`,
    createdAt,
    items: [],
  };
}

export function createPurchaseSessionItem(
  impression: CollectionImpression,
  collectionStatus: "owned" | "missing",
  priceMode: PriceMode,
  sellerPrice: number | null,
  now = new Date(),
): PurchaseSessionItem {
  return {
    id: `purchase-card-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    impressionId: impression.impressionId,
    name: impression.row.name,
    setCode: impression.setCode,
    setName: impression.setName,
    number: impression.variant.number,
    variant: impression.variant.kind,
    rarity: impression.variant.rarity,
    imageUrl: impression.variant.imageUrl,
    cardmarketUrl: impression.row.cardmarketUrl,
    collectionStatus,
    cardmarketPrice: getPrimaryVariantPrice(impression.variant, priceMode),
    priceMode,
    sellerPrice,
    addedAt: now.toISOString(),
  };
}

export function addPurchaseSessionItem(session: PurchaseSession, item: PurchaseSessionItem): PurchaseSession {
  // A printing is listed once per session. The camera may recognise the same
  // card for several seconds; retaining the original entry prevents duplicates.
  if (session.items.some((existing) => existing.impressionId === item.impressionId)) return session;
  return { ...session, items: [...session.items, item] };
}

export function updatePurchaseSessionItemPrice(session: PurchaseSession, itemId: string, sellerPrice: number | null): PurchaseSession {
  return { ...session, items: session.items.map((item) => item.id === itemId ? { ...item, sellerPrice } : item) };
}

export function readPurchaseSessions(raw: string | null): PurchaseSessionsState {
  if (!raw) return { version: PURCHASE_SESSIONS_VERSION, sessions: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<PurchaseSessionsState>;
    if (parsed.version !== PURCHASE_SESSIONS_VERSION || !Array.isArray(parsed.sessions)) throw new Error("invalid");
    return {
      version: PURCHASE_SESSIONS_VERSION,
      sessions: parsed.sessions.filter(isPurchaseSession),
    };
  } catch {
    return { version: PURCHASE_SESSIONS_VERSION, sessions: [] };
  }
}

function isPurchaseSession(value: unknown): value is PurchaseSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const session = value as Partial<PurchaseSession>;
  return typeof session.id === "string"
    && typeof session.name === "string"
    && typeof session.createdAt === "string"
    && Array.isArray(session.items)
    && session.items.every((item) => item && typeof item === "object" && typeof (item as PurchaseSessionItem).id === "string" && typeof (item as PurchaseSessionItem).impressionId === "string" && typeof (item as PurchaseSessionItem).name === "string");
}
