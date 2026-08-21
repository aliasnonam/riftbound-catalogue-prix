import assert from "node:assert/strict";
import test from "node:test";

import {
  FILTERS_BY_SET,
  getDescriptiveBadges,
  matchesSpecialFilter,
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
