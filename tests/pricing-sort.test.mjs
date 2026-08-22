import assert from "node:assert/strict";
import test from "node:test";

import {
  compareByEffectivePrice,
  getActivePrice,
  getEffectiveSortPrice,
  getPrimaryVariantPrice,
  getVariantFoilPrice,
  getVariantNormalPrice,
} from "../lib/pricing.ts";

const emptyPrice = { low: null, trend: null, avg30: null };

function row(name, sortOrder, prices, foilPrices = prices) {
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

test("collector rows sort with the effective price of their displayed impression", () => {
  const jinx = {
    ...row("Jinx", 1, emptyPrice),
    variants: [
      {
        kind: "signature",
        number: "301*",
        pricing: "single",
        price: { low: 400, trend: 564.01, avg30: 510 },
      },
    ],
    associatedVariants: [
      {
        kind: "signature",
        number: "301*",
        pricing: "single",
        price: { low: 400, trend: 564.01, avg30: 510 },
      },
    ],
  };
  const yasuo = {
    ...row("Yasuo", 2, emptyPrice),
    variants: [
      {
        kind: "signature",
        number: "305*",
        pricing: "single",
        price: { low: 350, trend: 875.35, avg30: 620 },
      },
    ],
    associatedVariants: [
      {
        kind: "signature",
        number: "305*",
        pricing: "single",
        price: { low: 350, trend: 875.35, avg30: 620 },
      },
    ],
  };

  assert.equal(getEffectiveSortPrice(jinx, jinx.variants[0], "trend"), 564.01);
  assert.deepEqual(
    [jinx, yasuo]
      .map((item) => ({ row: item, displayedVariant: item.variants[0] }))
      .sort((a, b) => compareByEffectivePrice(a, b, "trend"))
      .map((item) => item.row.name),
    ["Yasuo", "Jinx"],
  );
});

test("Irelia Epic uses only its foil while her Outnumbered uses the linked Signature", () => {
  const base = {
    kind: "base",
    number: "057",
    rarity: "Epic",
    pricing: "single",
    price: { low: 9.5, trend: 10, avg30: 9.75 },
  };
  const alternate = {
    kind: "alternate",
    number: "057a",
    rarity: "Showcase",
    pricing: "single",
    price: { low: 13, trend: 14, avg30: 13.5 },
  };
  const overnumbered = {
    kind: "overnumbered",
    number: "225",
    rarity: "Showcase",
    pricing: "single",
    price: { low: 111.99, trend: 120, avg30: 115 },
  };
  const signature = {
    kind: "signature",
    number: "225*",
    rarity: "Showcase",
    pricing: "single",
    price: { low: 837, trend: 850, avg30: 840 },
  };
  const family = [base, alternate, overnumbered, signature];
  const epicRow = {
    id: "irelia-057",
    name: "Irelia — Fervent",
    sortOrder: 57,
    variants: [base, alternate],
    associatedVariants: family,
  };
  const premiumRow = {
    id: "irelia-225",
    name: "Irelia — Fervent",
    sortOrder: 225,
    variants: [overnumbered, signature],
    associatedVariants: family,
  };

  assert.equal(getEffectiveSortPrice(epicRow, base, "low"), 9.5);
  assert.equal(getEffectiveSortPrice(epicRow, alternate, "low"), 13);
  assert.equal(getEffectiveSortPrice(premiumRow, overnumbered, "low"), 837);
  assert.equal(getEffectiveSortPrice(premiumRow, signature, "low"), 837);

  const ordered = [
    { row: epicRow, displayedVariant: base },
    { row: premiumRow, displayedVariant: overnumbered },
  ].sort((a, b) => compareByEffectivePrice(a, b, "low"));
  assert.deepEqual(ordered.map((item) => item.row.id), [
    "irelia-225",
    "irelia-057",
  ]);
});

test("Outnumbered falls back to its own price when no linked Signature exists", () => {
  const overnumbered = {
    kind: "overnumbered",
    number: "238",
    pricing: "single",
    price: { low: 1500, trend: 1550, avg30: 1525 },
  };
  const nashor = {
    id: "nashor-238",
    name: "Baron Nashor",
    sortOrder: 238,
    variants: [overnumbered],
    associatedVariants: [overnumbered],
  };

  assert.equal(getEffectiveSortPrice(nashor, overnumbered, "low"), 1500);
});

test("Outnumbered uses its own active-mode price when the linked Signature has none", () => {
  const overnumbered = {
    kind: "overnumbered",
    number: "225",
    pricing: "single",
    price: { low: 111.99, trend: 120, avg30: 115 },
  };
  const signature = {
    kind: "signature",
    number: "225*",
    pricing: "single",
    price: { low: 837, trend: null, avg30: 840 },
  };
  const premiumRow = {
    id: "irelia-225",
    name: "Irelia — Fervent",
    sortOrder: 225,
    variants: [overnumbered, signature],
    associatedVariants: [overnumbered, signature],
  };

  assert.equal(
    getEffectiveSortPrice(premiumRow, overnumbered, "trend"),
    120,
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
  assert.equal(
    getEffectiveSortPrice(
      {
        id: "common-001",
        name: "Commune",
        sortOrder: 1,
        variants: [common],
        associatedVariants: [common],
      },
      common,
      "low",
    ),
    0.08,
  );
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
        .map((item) => ({
          row: item,
          displayedVariant: item.associatedVariants[0],
        }))
        .sort((a, b) => compareByEffectivePrice(a, b, priceMode))
        .map((item) => item.row.name);
      assert.deepEqual(ordered, expected[priceMode], `${tab} — ${priceMode}`);
    }
  }
});
