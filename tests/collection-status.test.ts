import assert from "node:assert/strict";
import test from "node:test";

import {
  createCollectionBackup,
  getCollectionFinancialPrice,
  getCollectionFinancialTotals,
  getCollectionProgress,
  getCollectionStatus,
  isCollectionFoil,
  isCollectionOwned,
  parseCollectionBackup,
  readCollectionState,
  withCollectionStatus,
  type CollectionImpression,
  type CollectionState,
} from "../lib/collection";

const prices = (low: number | null, trend = low, avg30 = low) => ({ low, trend, avg30 });

function impression(
  id: string,
  options: {
    numbered?: boolean;
    kind?: "base" | "alternate" | "crystal-rose" | "overnumbered" | "signature" | "other";
    pricing?: "single" | "dual";
    low?: number | null;
    foilLow?: number | null;
  } = {},
) {
  const {
    numbered = true,
    kind = "base",
    pricing = "single",
    low = 1,
    foilLow = 10,
  } = options;

  const variant = pricing === "dual"
    ? { id, kind, pricing, normal: prices(low), foil: prices(foilLow) }
    : { id, kind, pricing, price: prices(low) };

  return {
    impressionId: id,
    row: { isNumbered: numbered },
    variant,
  } as unknown as CollectionImpression;
}

test("treats every non-owned impression as missing, including an empty collection", () => {
  const catalogue = Array.from({ length: 10 }, (_, index) => impression(`card-${index + 1}`));
  const state: CollectionState = {};

  assert.equal(getCollectionStatus(state, "card-1"), "missing");
  assert.equal(isCollectionOwned(state, "card-1"), false);
  assert.deepEqual(getCollectionProgress(catalogue, state), {
    owned: 0,
    total: 10,
    percentage: 0,
  });
});

test("keeps legacy owned entries and turns legacy missing or unknown entries into implicit missing", () => {
  const restored = readCollectionState(JSON.stringify({
    ownedObject: { status: "owned", foil: true },
    ownedString: "owned",
    oldMissing: { status: "missing" },
    oldUnknown: { status: "unknown" },
    unknownString: "unknown",
  }));

  assert.deepEqual(restored, {
    ownedObject: { status: "owned", foil: true },
    ownedString: { status: "owned" },
  });
  assert.equal(getCollectionStatus(restored, "oldMissing"), "missing");
  assert.equal(getCollectionStatus(restored, "oldUnknown"), "missing");
});

test("handles owned and Foil transitions without allowing missing Foils", () => {
  const dual = impression("dual", { pricing: "dual", low: 4, foilLow: 40 });
  const ownedFoil: CollectionState = { dual: { status: "owned", foil: true } };
  const missing = withCollectionStatus(ownedFoil, "dual", "missing");
  const ownedNormal = withCollectionStatus(missing, "dual", "owned");

  assert.deepEqual(missing, {});
  assert.equal(isCollectionFoil(missing, dual), false);
  assert.deepEqual(ownedNormal, { dual: { status: "owned" } });
  assert.equal(isCollectionFoil(ownedNormal, dual), false);
});

test("derives progress and every missing cost from all non-owned impressions", () => {
  const catalogue = [
    impression("owned-foil", { pricing: "dual", low: 1, foilLow: 10 }),
    impression("owned-normal", { low: 2 }),
    impression("owned-alt", { kind: "alternate", numbered: false, low: 3 }),
    impression("missing-dual", { pricing: "dual", low: 4, foilLow: 40 }),
    impression("missing-numbered", { low: 5 }),
    impression("missing-signature", { kind: "signature", numbered: false, low: 6 }),
    impression("missing-alt", { kind: "alternate", numbered: false, low: 7 }),
    impression("missing-crystal", { kind: "crystal-rose", numbered: false, low: 8 }),
    impression("missing-no-price", { kind: "overnumbered", numbered: false, low: null }),
    impression("missing-overnumbered", { kind: "overnumbered", numbered: false, low: 10 }),
  ];
  const state: CollectionState = {
    "owned-foil": { status: "owned", foil: true },
    "owned-normal": { status: "owned" },
    "owned-alt": { status: "owned" },
  };

  const progress = getCollectionProgress(catalogue, state);
  const totals = getCollectionFinancialTotals(catalogue, state, "low");

  assert.deepEqual(progress, { owned: 3, total: 10, percentage: 30 });
  assert.equal(progress.total - progress.owned, 7);
  assert.deepEqual(totals.ownedValue, { total: 15, withoutPrice: 0 });
  assert.deepEqual(totals.numberedMissingCost, { total: 9, withoutPrice: 0 });
  assert.deepEqual(totals.unsignedMasterMissingCost, { total: 34, withoutPrice: 1 });
  assert.deepEqual(totals.masterMissingCost, { total: 40, withoutPrice: 1 });
});

test("uses the Normal price for missing dual impressions without a price-mode fallback", () => {
  const trendOnlyFoil = {
    impressionId: "trend-dual",
    row: { isNumbered: true },
    variant: {
      id: "trend-dual",
      kind: "base",
      pricing: "dual",
      normal: prices(4, null, 4),
      foil: prices(40, 50, 40),
    },
  } as unknown as CollectionImpression;
  const missingTrend = getCollectionFinancialPrice(
    trendOnlyFoil,
    "missing",
    false,
    "trend",
  );

  assert.equal(missingTrend, null);
});

test("exports a compact owned-only backup and imports legacy backups", () => {
  const backup = createCollectionBackup({
    owned: { status: "owned", foil: true },
    legacyMissing: { status: "missing" },
  }, "2026-08-26T10:00:00.000Z");
  const legacy = parseCollectionBackup(JSON.stringify({
    version: 1,
    exportedAt: "2026-08-20T10:00:00.000Z",
    collection: {
      kept: { status: "owned", foil: true },
      implicit: { status: "missing" },
      oldUnknown: { status: "unknown" },
    },
  }));

  assert.deepEqual(backup.collection, { owned: { status: "owned", foil: true } });
  assert.deepEqual(legacy, {
    ok: true,
    backup: {
      version: 2,
      exportedAt: "2026-08-20T10:00:00.000Z",
      collection: { kept: { status: "owned", foil: true } },
    },
  });
});
