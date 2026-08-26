import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collection = readFileSync(new URL("../lib/collection.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/components/collection-page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("separates numbered, unsigned master, and absolute master missing costs", () => {
  assert.match(collection, /getCollectionFinancialTotals/);
  assert.match(collection, /numberedMissingCost/);
  assert.match(collection, /unsignedMasterMissingCost/);
  assert.match(collection, /masterMissingCost/);
  assert.match(collection, /\(impression\) => impression\.row\.isNumbered/);
  assert.match(collection, /\(impression\) => impression\.variant\.kind !== "signature"/);
  assert.match(collection, /ownedValue: getCollectionFinancialSummary\(impressions, state, "owned", priceMode\)/);
  assert.match(collection, /getCollectionFinancialSummary\(impressions, state, "missing", priceMode\)/);
  assert.match(collection, /const useFoil = status === "owned" && isFoil/);
  assert.match(collection, /Toute autre impression est implicitement manquante/);
});

test("renders the three completion costs in the dashboard and each set summary", () => {
  assert.match(page, /Valeur possédée/);
  assert.match(page, /Coût Set numéroté/);
  assert.match(page, /Coût Master hors Signées/);
  assert.match(page, /Coût Master set/);
  assert.match(page, /setFinancials\.numberedMissingCost/);
  assert.match(page, /setFinancials\.unsignedMasterMissingCost/);
  assert.match(page, /setFinancials\.masterMissingCost/);
});

test("uses progressive DOM rendering with a direct, deterministic jump", () => {
  assert.match(page, /COLLECTION_BATCH_SIZE = 36/);
  assert.match(page, /filtered\.slice\(0, visibleCount\)/);
  assert.match(page, /new IntersectionObserver/);
  assert.match(page, /rootMargin: "1000px 0px"/);
  assert.match(page, /Math\.ceil\(parsedJump \/ COLLECTION_BATCH_SIZE\) \* COLLECTION_BATCH_SIZE/);
  assert.match(page, /window\.requestAnimationFrame/);
  assert.match(page, /scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/);
  assert.match(page, /data-collection-position/);
  assert.match(page, /Aller à/);
  assert.match(page, /collection-back-to-top/);
  assert.match(page, /window\.scrollTo\(\{ top: 0, behavior: "smooth" \}\)/);
  assert.match(css, /collection-infinite-sentinel/);
  assert.match(css, /collection-back-to-top/);
});
