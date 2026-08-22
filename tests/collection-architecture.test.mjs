import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const collection = readFileSync(new URL("../lib/collection.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/use-collection.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/components/collection-page.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../app/components/site-header.tsx", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../app/components/catalog-page.tsx", import.meta.url), "utf8");
const catalogRow = readFileSync(new URL("../app/components/catalog/CatalogRow.tsx", import.meta.url), "utf8");
const variantDetails = readFileSync(new URL("../app/components/catalog/VariantDetails.tsx", import.meta.url), "utf8");

test("stores only a per-impression collection status in localStorage", () => {
  assert.match(collection, /CollectionStatus = "owned" \| "missing"/);
  assert.match(collection, /COLLECTION_STORAGE_KEY = "riftbound-collection-v1"/);
  assert.match(collection, /getCollectionImpressionId\(setCode: SetCode, variantId: string\)/);
  assert.match(collection, /row\.variants/);
  assert.match(hook, /window\.localStorage\.setItem\(COLLECTION_STORAGE_KEY, JSON\.stringify\(next\)\)/);
  assert.match(hook, /setOwned/);
  assert.match(hook, /setMissing/);
  assert.match(hook, /clearStatus/);
});

test("adds the global collection routes and uses the shared catalogue data", () => {
  assert.match(header, /href="\/collection"/);
  assert.match(page, /fetch\(`\/api\/catalog\?set=\$\{set\.code\}`/);
  assert.match(page, /href="\/collection\/missing"/);
  assert.match(page, /href="\/collection\/owned"/);
  assert.match(page, /Prix minimum/);
  assert.match(page, /Tendance Cardmarket/);
  assert.match(page, /Moyenne 30 jours/);
});

test("keeps the actions on individual impressions and reuses them from set details", () => {
  assert.match(page, /collection\.setOwned\(impression\.impressionId\)/);
  assert.match(page, /collection\.setMissing\(impression\.impressionId\)/);
  assert.match(page, /collection\.clearStatus\(impression\.impressionId\)/);
  assert.match(catalog, /<CatalogRow/);
  assert.match(catalogRow, /<VariantDetails row=\{row\} mode=\{priceMode\} setCode=\{setCode\} \/>/);
  assert.match(variantDetails, /variant-collection-status/);
  assert.match(variantDetails, /getCollectionImpressionId\(setCode, variant\.id\)/);
});
