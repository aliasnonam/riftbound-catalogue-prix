import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collection = readFileSync(new URL("../lib/collection.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/use-collection.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/components/collection-page.tsx", import.meta.url), "utf8");

test("keeps Foil as a secondary owned-only property", () => {
  assert.match(collection, /isCollectionOwned\(state, impression\.impressionId\)/);
  assert.match(collection, /candidate\.foil === true/);
  assert.match(collection, /entry\.status !== "owned"/);
  assert.match(collection, /withCollectionFoil/);
  assert.match(hook, /impression\.variant\.pricing === "dual"/);
  assert.match(page, /status === "owned" && impression\.variant\.pricing === "dual"/);
});

test("clears Foil when an owned impression becomes missing", () => {
  assert.match(collection, /if \(status === "missing"\) \{/);
  assert.match(collection, /delete next\[impressionId\]/);
  assert.match(collection, /next\[impressionId\] = \{ status: "owned" \}/);
  assert.doesNotMatch(collection, /status: "missing", foil/);
});

test("uses the exact Normal or Foil price selected by the collection state", () => {
  assert.match(collection, /getCollectionFinancialPrice/);
  assert.match(collection, /const useFoil = status === "owned" && isFoil/);
  assert.match(collection, /getActivePrice\(useFoil \? variant\.foil : variant\.normal, priceMode\)/);
  assert.doesNotMatch(collection.slice(collection.indexOf("getCollectionFinancialPrice"), collection.indexOf("export type CollectionProgress")), /unknown/);
  assert.doesNotMatch(collection.slice(collection.indexOf("getCollectionFinancialPrice"), collection.indexOf("export type CollectionProgress")), /Math\.max/);
});

test("derives numbered and master progress plus financial summaries from catalogue data", () => {
  assert.match(collection, /getCollectionProgress/);
  assert.match(collection, /getCollectionFinancialSummary/);
  assert.match(page, /impression\.row\.isNumbered/);
  assert.match(page, /Set numéroté/);
  assert.match(page, /Master set/);
  assert.match(page, /Valeur possédée/);
  assert.match(page, /Restant pour le Set numéroté/);
  assert.match(page, /Restant pour le Master hors Signées/);
  assert.match(page, /Restant pour le Master set/);
  assert.match(page, /Valeur utilisée/);
  assert.match(page, /dashboardPriceMode/);
});
