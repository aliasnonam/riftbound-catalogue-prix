import type { CatalogPayload, CatalogRow, CatalogVariant } from "@/lib/catalog";
import type { PriceMode } from "@/lib/pricing";
import { getActivePrice, getVariantActivePrices } from "@/lib/pricing";
import type { SetCode } from "@/lib/sets";

export type CollectionStatus = "owned" | "missing";
export type CollectionEntry = {
  status: CollectionStatus;
  foil?: true;
};
export type CollectionState = Record<string, CollectionEntry>;

export const COLLECTION_BACKUP_VERSION = 2;

export type CollectionBackup = {
  version: typeof COLLECTION_BACKUP_VERSION;
  exportedAt: string;
  collection: CollectionState;
};

export type CollectionBackupParseResult =
  | { ok: true; backup: CollectionBackup }
  | { ok: false; reason: "invalid" | "unsupported-version" };

export const COLLECTION_STORAGE_KEY = "riftbound-collection-v1";
export const COLLECTION_CHANGE_EVENT = "riftbound-collection-change";

export type CollectionImpression = {
  impressionId: string;
  setCode: SetCode;
  setName: string;
  row: CatalogRow;
  variant: CatalogVariant;
};

export function getCollectionImpressionId(setCode: SetCode, variantId: string) {
  return `${setCode}:${variantId}`;
}

export function flattenCatalogPayload(payload: CatalogPayload): CollectionImpression[] {
  const seen = new Set<string>();
  return payload.rows.flatMap((row) =>
    row.variants.flatMap((variant) => {
      const impressionId = getCollectionImpressionId(payload.set.code, variant.id);
      if (seen.has(impressionId)) return [];
      seen.add(impressionId);
      return [{ impressionId, setCode: payload.set.code, setName: payload.set.name, row, variant }];
    }),
  );
}

export function getCollectionPrice(
  impression: CollectionImpression,
  priceMode: PriceMode,
) {
  const prices = getVariantActivePrices(impression.variant, priceMode);
  return prices.length ? Math.max(...prices) : null;
}

export function getCollectionStatus(
  state: CollectionState,
  impressionId: string,
): CollectionStatus {
  return state[impressionId]?.status === "owned" ? "owned" : "missing";
}

/**
 * Source de vérité de Ma collection : seules les impressions explicitement
 * possédées sont owned. Toute autre impression est implicitement manquante.
 */
export function isCollectionOwned(
  state: CollectionState,
  impressionId: string,
) {
  return getCollectionStatus(state, impressionId) === "owned";
}

export function isCollectionFoil(
  state: CollectionState,
  impression: CollectionImpression,
) {
  return impression.variant.pricing === "dual"
    && isCollectionOwned(state, impression.impressionId)
    && state[impression.impressionId]?.foil === true;
}

/**
 * Prix strict d'une impression suivie dans la collection.
 * Aucun fallback n'est effectué entre Normal/Foil ni entre les modes de prix.
 */
export function getCollectionFinancialPrice(
  impression: CollectionImpression,
  status: CollectionStatus,
  isFoil: boolean,
  priceMode: PriceMode,
) {
  const { variant } = impression;

  if (variant.pricing === "single") {
    return getActivePrice(variant.price, priceMode);
  }

  const useFoil = status === "owned" && isFoil;
  return getActivePrice(useFoil ? variant.foil : variant.normal, priceMode);
}

export type CollectionProgress = {
  owned: number;
  total: number;
  percentage: number;
};

export type CollectionFinancialSummary = {
  total: number;
  withoutPrice: number;
};

export type CollectionFinancialTotals = {
  ownedValue: CollectionFinancialSummary;
  numberedMissingCost: CollectionFinancialSummary;
  unsignedMasterMissingCost: CollectionFinancialSummary;
  masterMissingCost: CollectionFinancialSummary;
};

export function getCollectionProgress(
  impressions: CollectionImpression[],
  state: CollectionState,
  predicate: (impression: CollectionImpression) => boolean = () => true,
): CollectionProgress {
  const scoped = impressions.filter(predicate);
  const owned = scoped.filter(
    (impression) => isCollectionOwned(state, impression.impressionId),
  ).length;
  return {
    owned,
    total: scoped.length,
    percentage: scoped.length ? (owned / scoped.length) * 100 : 0,
  };
}

export function getCollectionFinancialSummary(
  impressions: CollectionImpression[],
  state: CollectionState,
  targetStatus: CollectionStatus,
  priceMode: PriceMode,
  predicate: (impression: CollectionImpression) => boolean = () => true,
): CollectionFinancialSummary {
  return impressions.reduce<CollectionFinancialSummary>((summary, impression) => {
    if (!predicate(impression)) return summary;
    const status = getCollectionStatus(state, impression.impressionId);
    if (status !== targetStatus) return summary;
    const price = getCollectionFinancialPrice(
      impression,
      status,
      isCollectionFoil(state, impression),
      priceMode,
    );
    if (price === null) return { ...summary, withoutPrice: summary.withoutPrice + 1 };
    return { ...summary, total: summary.total + price };
  }, { total: 0, withoutPrice: 0 });
}

/**
 * Les objectifs financiers de la collection sont calculés à partir des
 * impressions physiques et de leurs propriétés structurelles. Chaque
 * impression non possédée est manquante par défaut. La valeur possédée,
 * elle, conserve uniquement les impressions explicitement owned.
 */
export function getCollectionFinancialTotals(
  impressions: CollectionImpression[],
  state: CollectionState,
  priceMode: PriceMode,
): CollectionFinancialTotals {
  return {
    ownedValue: getCollectionFinancialSummary(impressions, state, "owned", priceMode),
    numberedMissingCost: getCollectionFinancialSummary(
      impressions,
      state,
      "missing",
      priceMode,
      (impression) => impression.row.isNumbered,
    ),
    unsignedMasterMissingCost: getCollectionFinancialSummary(
      impressions,
      state,
      "missing",
      priceMode,
      (impression) => impression.variant.kind !== "signature",
    ),
    masterMissingCost: getCollectionFinancialSummary(impressions, state, "missing", priceMode),
  };
}

export function withCollectionStatus(
  state: CollectionState,
  impressionId: string,
  status: CollectionStatus,
): CollectionState {
  const next = { ...state };
  if (status === "missing") {
    delete next[impressionId];
    return next;
  }
  next[impressionId] = { status: "owned" };
  return next;
}

export function withCollectionFoil(
  state: CollectionState,
  impression: CollectionImpression,
  foil: boolean,
): CollectionState {
  const entry = state[impression.impressionId];
  if (!entry || entry.status !== "owned" || impression.variant.pricing !== "dual") return state;
  return {
    ...state,
    [impression.impressionId]: foil ? { status: "owned", foil: true } : { status: "owned" },
  };
}

export function readCollectionState(raw: string | null): CollectionState {
  if (!raw) return {};
  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};
    return normalizeCollectionState(candidate);
  } catch {
    return {};
  }
}

function isCollectionState(value: unknown): value is CollectionState {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(
    ([impressionId, entry]) => typeof impressionId === "string"
      && impressionId.length > 0
      && Boolean(entry)
      && typeof entry === "object"
      && !Array.isArray(entry)
      && ((entry as CollectionEntry).status === "owned" || (entry as CollectionEntry).status === "missing")
      && ((entry as CollectionEntry).foil === undefined || (entry as CollectionEntry).foil === true),
  );
}

function normalizeCollectionState(value: unknown): CollectionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([impressionId, entry]) => {
      if (!impressionId) return [];
      if (entry === "owned") return [[impressionId, { status: "owned" } satisfies CollectionEntry]];
      if (entry === "missing" || entry === "unknown") return [];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const candidate = entry as Partial<CollectionEntry> & { status?: unknown };
      if (candidate.status !== "owned") return [];
      return [[impressionId, candidate.foil === true
        ? { status: "owned", foil: true }
        : { status: "owned" }]];
    }),
  );
}

export function createCollectionBackup(state: CollectionState, exportedAt = new Date().toISOString()): CollectionBackup {
  return {
    version: COLLECTION_BACKUP_VERSION,
    exportedAt,
    // Les sauvegardes récentes restent compactes : seules les cartes owned
    // sont nécessaires, toutes les autres étant manquantes par défaut.
    collection: normalizeCollectionState(state),
  };
}

export function parseCollectionBackup(raw: string): CollectionBackupParseResult {
  try {
    const candidate = JSON.parse(raw) as unknown;
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { ok: false, reason: "invalid" };
    const { version, exportedAt, collection } = candidate as Record<string, unknown>;
    if (version !== 1 && version !== COLLECTION_BACKUP_VERSION) return { ok: false, reason: "unsupported-version" };
    const normalized = normalizeCollectionState(collection);
    if (typeof exportedAt !== "string" || !isCollectionState(normalized)) return { ok: false, reason: "invalid" };
    return { ok: true, backup: { version: COLLECTION_BACKUP_VERSION, exportedAt, collection: normalized } };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function collectionBackupFilename(date = new Date()) {
  const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  return `riftbound-collection-backup-${day}.json`;
}
