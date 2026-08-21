import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeKnownPriceGuides,
  parsePriceExport,
  preparePriceRefresh,
} from "../lib/cardmarket-refresh.ts";

function product(idProduct) {
  return {
    idProduct,
    idCategory: 1655,
    name: `Carte ${idProduct}`,
    categoryName: "Riftbound Single",
    idExpansion: 1,
    idMetacard: idProduct,
    dateAdded: "2026-01-01 00:00:00",
  };
}

function guide(idProduct, values = {}) {
  return {
    idProduct,
    idCategory: 1655,
    avg: 1,
    low: 1,
    trend: 1,
    avg1: 1,
    avg7: 1,
    avg30: 1,
    "avg-foil": 1,
    "low-foil": 1,
    "trend-foil": 1,
    "avg1-foil": 1,
    "avg7-foil": 1,
    "avg30-foil": 1,
    ...values,
  };
}

test("updates only known products and ignores unknown identifiers", () => {
  const result = mergeKnownPriceGuides({
    products: [product(1)],
    currentPrices: [guide(1, { low: 2 })],
    incomingPrices: [guide(1, { low: 3 }), guide(999, { low: 500 })],
  });

  assert.equal(result.prices.length, 1);
  assert.equal(result.prices[0].idProduct, 1);
  assert.equal(result.prices[0].low, 3);
});

test("keeps every previous value when the replacement is invalid", () => {
  const result = mergeKnownPriceGuides({
    products: [product(1)],
    currentPrices: [guide(1, { low: 2, trend: 4, avg30: 6 })],
    incomingPrices: [guide(1, { low: null, trend: 0, avg30: Number.NaN })],
  });

  assert.equal(result.prices[0].low, 2);
  assert.equal(result.prices[0].trend, 4);
  assert.equal(result.prices[0].avg30, 6);
});

test("rejects a partial export before it can replace the cache", () => {
  const products = Array.from({ length: 10 }, (_, index) => product(index + 1));
  assert.throws(
    () =>
      mergeKnownPriceGuides({
        products,
        currentPrices: products.map((item) => guide(item.idProduct)),
        incomingPrices: [guide(1, { low: 9 })],
      }),
    /trop incomplet/,
  );
});

test("validates the Cardmarket export metadata", () => {
  const parsed = parsePriceExport({
    version: 1,
    createdAt: "2026-08-21T01:15:00+0200",
    priceGuides: [guide(1)],
  });
  assert.equal(parsed.priceGuides.length, 1);
  assert.throws(
    () => parsePriceExport({ version: 1, createdAt: "invalid", priceGuides: [] }),
    /incomplet/,
  );
});

test("records the completion time after a successful unchanged refresh", () => {
  const current = guide(1, { low: 3, trend: 4, avg30: 5 });
  const completedAt = "2026-08-21T01:12:00.000Z";
  let clockReads = 0;
  const result = preparePriceRefresh({
    products: [product(1)],
    currentPrices: [current],
    currentSourceCreatedAt: "2026-08-20T00:49:00.000Z",
    incoming: {
      version: 1,
      createdAt: "2026-08-20T00:49:00.000Z",
      priceGuides: [current],
    },
    now: () => {
      clockReads += 1;
      return new Date(completedAt);
    },
  });

  assert.equal(result.refreshStatus, "unchanged");
  assert.equal(result.updatedProducts, 0);
  assert.equal(result.syncedAt, completedAt);
  assert.equal(clockReads, 1);
});

test("does not read a new timestamp when processing fails", () => {
  let clockReads = 0;

  assert.throws(
    () =>
      preparePriceRefresh({
        products: [product(1)],
        currentPrices: [guide(1)],
        currentSourceCreatedAt: "2026-08-21T00:00:00.000Z",
        incoming: {
          version: 1,
          createdAt: "2026-08-20T00:00:00.000Z",
          priceGuides: [guide(1)],
        },
        now: () => {
          clockReads += 1;
          return new Date();
        },
      }),
    /plus ancien/,
  );
  assert.equal(clockReads, 0);
});
