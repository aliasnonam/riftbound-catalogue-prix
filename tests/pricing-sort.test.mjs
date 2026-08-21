import assert from "node:assert/strict";
import test from "node:test";

import {
  compareByHighestActivePrice,
  getActivePrice,
  getPrimaryVariantPrice,
  getSortValue,
  getVariantFoilPrice,
  getVariantNormalPrice,
} from "../lib/pricing.ts";

const emptyPrice = { low: null, trend: null, avg30: null };

function row(name, sortOrder, prices, foilPrices = {}) {
  return {
    id: name,
    name,
    sortOrder,
    associatedVariants: [
      {
        kind: "base",
        pricing: "dual",
        normal: { ...emptyPrice, ...prices },
        foil: { ...emptyPrice, ...foilPrices },
      },
    ],
  };
}

const rows = [
  row("Jinx", 1, { low: 900, trend: 564.01, avg30: 520 }),
  row("Yasuo", 2, { low: 700, trend: 875.35, avg30: 680 }),
  row("Sett", 3, { low: 600, trend: 700.37, avg30: 750 }),
  row("Sans valeur", 4, { low: null, trend: null, avg30: null }),
];

test("getActivePrice never falls back to another price mode", () => {
  const impression = { low: 12, trend: null, avg30: 18 };
  assert.equal(getActivePrice(impression, "trend"), null);
  assert.equal(getActivePrice(impression, "low"), 12);
  assert.equal(getActivePrice(impression, "avg30"), 18);
});

test("getSortValue uses the maximum active price across associated impressions", () => {
  const family = {
    ...row("Ahri", 1, { low: 0.05, trend: 0.87, avg30: 0.5 }),
    associatedVariants: [
      {
        kind: "base",
        pricing: "dual",
        normal: { low: 0.05, trend: 0.87, avg30: 0.5 },
        foil: { low: 0.05, trend: 1.01, avg30: 0.8 },
      },
      {
        kind: "overnumbered",
        pricing: "single",
        price: { low: 140, trend: 144, avg30: 142 },
      },
      {
        kind: "signature",
        pricing: "single",
        price: { low: 1100, trend: 2596.66, avg30: 2200 },
      },
    ],
  };

  assert.equal(getSortValue(family, "low"), 1100);
  assert.equal(getSortValue(family, "trend"), 2596.66);
  assert.equal(getSortValue(family, "avg30"), 2200);
});

test("collector rows sort with the same primary value shown in their column", () => {
  const jinx = {
    ...row("Jinx", 1, emptyPrice),
    associatedVariants: [
      {
        kind: "signature",
        pricing: "single",
        price: { low: 400, trend: 564.01, avg30: 510 },
      },
    ],
  };
  const yasuo = {
    ...row("Yasuo", 2, emptyPrice),
    associatedVariants: [
      {
        kind: "signature",
        pricing: "single",
        price: { low: 350, trend: 875.35, avg30: 620 },
      },
    ],
  };

  assert.equal(getSortValue(jinx, "trend"), 564.01);
  assert.deepEqual(
    [jinx, yasuo]
      .sort((a, b) => compareByHighestActivePrice(a, b, "trend"))
      .map((item) => item.name),
    ["Yasuo", "Jinx"],
  );
});

test("single-print rarities never expose a Normal price", () => {
  const rare = {
    kind: "base",
    pricing: "single",
    price: { low: 0.02, trend: 0.17, avg30: 0.27 },
  };

  assert.equal(getVariantNormalPrice(rare, "low"), null);
  assert.equal(getVariantFoilPrice(rare, "low"), 0.02);
  assert.equal(getPrimaryVariantPrice(rare, "trend"), 0.17);
});

test("Common and Uncommon base cards keep distinct Normal and Foil prices", () => {
  const common = {
    kind: "base",
    pricing: "dual",
    normal: { low: 0.02, trend: 0.04, avg30: 0.03 },
    foil: { low: 0.08, trend: 0.12, avg30: 0.1 },
  };

  assert.equal(getVariantNormalPrice(common, "low"), 0.02);
  assert.equal(getVariantFoilPrice(common, "low"), 0.08);
});

test("changing price mode rebuilds a descending order and keeps missing values last", () => {
  const tabs = [
    "Toutes",
    "Set numéroté",
    "Alternatives",
    "Outnumbered",
    "Signées",
  ];
  const expected = {
    low: ["Jinx", "Yasuo", "Sett", "Sans valeur"],
    trend: ["Yasuo", "Sett", "Jinx", "Sans valeur"],
    avg30: ["Sett", "Yasuo", "Jinx", "Sans valeur"],
  };

  for (const tab of tabs) {
    for (const priceMode of ["low", "trend", "avg30"]) {
      const ordered = [...rows]
        .sort((a, b) => compareByHighestActivePrice(a, b, priceMode))
        .map((item) => item.name);
      assert.deepEqual(ordered, expected[priceMode], `${tab} — ${priceMode}`);
    }
  }
});
