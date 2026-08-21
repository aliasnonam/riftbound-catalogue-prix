import assert from "node:assert/strict";
import test from "node:test";

import {
  FILTERS_BY_SET,
  getDescriptiveBadges,
  matchesSpecialFilter,
  VENDETTA_RIVAL_NUMBERS,
} from "../lib/catalog-presentation.ts";

const labelsFor = (setCode) =>
  FILTERS_BY_SET[setCode].map((filter) => filter.label);

test("keeps the requested navigation order for every set with reprints", () => {
  assert.deepEqual(labelsFor("SFD"), [
    "Toutes",
    "Set numéroté",
    "Alternatives",
    "Outnumbered",
    "OGN Reprint",
    "Signées",
    "Runes & tokens",
  ]);
  assert.deepEqual(labelsFor("UNL"), [
    "Toutes",
    "Set numéroté",
    "Alternatives",
    "Outnumbered",
    "OGN Reprint",
    "SFD Reprint",
    "Nashor",
    "Signées",
    "Runes & tokens",
  ]);
  assert.deepEqual(labelsFor("VEN"), [
    "Toutes",
    "Set numéroté",
    "Alternatives",
    "Outnumbered",
    "OGN Reprint",
    "SFD Reprint",
    "UNL Reprint",
    "Crystal Rose",
    "Signées",
    "Runes & tokens",
  ]);
});

test("derives descriptive badges from the card properties, not the active tab", () => {
  const row = { originSet: "OGN", specialEdition: null };

  assert.deepEqual(getDescriptiveBadges(row), [
    { id: "ogn-reprint", label: "OGN Reprint" },
  ]);
  assert.equal(matchesSpecialFilter(row, "ogn-reprint"), true);
});

test("preserves several simultaneous descriptive properties", () => {
  assert.deepEqual(
    getDescriptiveBadges({ originSet: "SFD", specialEdition: "nashor" }),
    [
      { id: "sfd-reprint", label: "SFD Reprint" },
      { id: "nashor", label: "Nashor" },
    ],
  );
});

test("marks exactly the 22 Vendetta Rival Overnumbered cards", () => {
  assert.equal(VENDETTA_RIVAL_NUMBERS.size, 22);

  for (let collectorNumber = 167; collectorNumber <= 188; collectorNumber += 1) {
    assert.equal(
      getDescriptiveBadges(
        { originSet: null, specialEdition: null, collectorNumber },
        "VEN",
      ).some((badge) => badge.id === "rival"),
      true,
    );
  }

  for (const collectorNumber of [166, 189]) {
    assert.equal(
      getDescriptiveBadges(
        { originSet: null, specialEdition: null, collectorNumber },
        "VEN",
      ).some((badge) => badge.id === "rival"),
      false,
    );
  }

  assert.equal(
    getDescriptiveBadges(
      { originSet: null, specialEdition: null, collectorNumber: 167 },
      "UNL",
    ).some((badge) => badge.id === "rival"),
    false,
  );
});

test("keeps a reprint badge alongside the Vendetta Rival badge", () => {
  assert.deepEqual(
    getDescriptiveBadges(
      { originSet: "OGN", specialEdition: null, collectorNumber: 167 },
      "VEN",
    ),
    [
      { id: "ogn-reprint", label: "OGN Reprint" },
      { id: "rival", label: "Rival" },
    ],
  );
});
