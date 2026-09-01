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

test("stores a per-impression status with an optional Foil property in localStorage", () => {
  assert.match(collection, /CollectionStatus = "owned" \| "missing"/);
  assert.match(collection, /CollectionEntry/);
  assert.match(collection, /foil\?: true/);
  assert.match(collection, /COLLECTION_STORAGE_KEY = "riftbound-collection-v1"/);
  assert.match(collection, /getCollectionImpressionId\(setCode: SetCode, variantId: string\)/);
  assert.match(collection, /row\.variants/);
  assert.match(hook, /window\.localStorage\.setItem\(COLLECTION_STORAGE_KEY, JSON\.stringify\(next\)\)/);
  assert.match(hook, /setOwned/);
  assert.match(hook, /setMissing/);
  assert.match(hook, /isOwned/);
  assert.match(hook, /setFoil/);
  assert.match(hook, /const restore/);
  assert.match(hook, /persist\(next\)/);
});

test("exports and restores a versioned, validated local collection backup", () => {
  assert.match(collection, /COLLECTION_BACKUP_VERSION = 2/);
  assert.match(collection, /createCollectionBackup/);
  assert.match(collection, /parseCollectionBackup/);
  assert.match(collection, /version !== 1 && version !== COLLECTION_BACKUP_VERSION/);
  assert.match(collection, /collectionBackupFilename/);
  assert.match(collection, /if \(candidate\.status !== "owned"\) return \[\]/);
  assert.match(page, /Exporter ma collection/);
  assert.match(page, /Importer ma collection/);
  assert.match(page, /accept="\.json,application\/json"/);
  assert.match(page, /knownImpressionIds\.has\(impressionId\)/);
  assert.match(page, /Restaurer cette sauvegarde \?/);
  assert.match(page, /collection\.restore\(next\.collection\)/);
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
  assert.doesNotMatch(page, /Retirer le statut/);
  assert.doesNotMatch(page, /Non renseignée/);
  assert.match(page, /☆ Foil/);
  assert.match(page, /✦ Foil/);
  assert.match(catalog, /<CatalogRow/);
  assert.match(catalogRow, /<VariantDetails row=\{row\} mode=\{priceMode\} setCode=\{setCode\} \/>/);
  assert.match(variantDetails, /variant-collection-status/);
  assert.match(variantDetails, /getCollectionImpressionId\(setCode, variant\.id\)/);
});
