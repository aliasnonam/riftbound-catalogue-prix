import assert from "node:assert/strict";
import test from "node:test";
import { getPurchaseCodeCrop, PURCHASE_CODE_REGION, PURCHASE_CARD_REGION, resolvePurchaseCode, resolveAutomaticPurchaseScan } from "@/lib/purchase-scan";
import type { CollectionImpression } from "@/lib/collection";

const impressions = [
  { impressionId: "OGN:010", setCode: "OGN", variant: { number: "010", kind: "base" }, row: { id: "010", name: "Légionnaire d’arrière-garde" } },
  { impressionId: "OGN:092", setCode: "OGN", variant: { number: "092", kind: "base" }, row: { id: "092", name: "Grand méchant Rex" } },
] as CollectionImpression[];

test("purchase scan requires the collector line and never guesses from a nearby name", () => {
  assert.deepEqual(resolvePurchaseCode("Grand méchant Rex", impressions), { kind: "not-found" });
  const result = resolvePurchaseCode("OGN · 010/298 · FR", impressions);
  assert.equal(result.kind, "match");
  if (result.kind === "match") assert.equal(result.impression.impressionId, "OGN:010");
  assert.equal(resolvePurchaseCode("OGN 010/298 OGN 092/298", impressions).kind, "ambiguous");
});

test("purchase scan refuses ambiguous printings even if a name is present", () => {
  const alternate = { ...impressions[0], impressionId: "OGN:010-promo" };
  assert.equal(resolvePurchaseCode("OGN 010/298 Légionnaire d’arrière-garde", [...impressions, alternate]).kind, "ambiguous");
});

test("automatic scanning reads names while manual recovery requires the code", () => {
  const automatic = resolveAutomaticPurchaseScan("Grand méchant Rex", impressions);
  assert.equal(automatic.kind, "match");
  if (automatic.kind === "match") {
    assert.equal(automatic.impression.impressionId, "OGN:092");
    assert.equal(automatic.confidence, "medium");
  }
  assert.equal(resolvePurchaseCode("Grand méchant Rex", impressions).kind, "not-found");
  assert.equal(resolveAutomaticPurchaseScan("OGN 010/298 OGN 092/298 Grand méchant Rex", impressions).kind, "ambiguous");
});

test("automatic crop covers the card guide while manual crop stays on the bottom-left code", () => {
  const full = getPurchaseCodeCrop(630, 880, 63 / 88, false);
  const code = getPurchaseCodeCrop(630, 880);
  assert.equal(full.y, 880 * PURCHASE_CARD_REGION.y);
  assert.equal(full.width, 630 * PURCHASE_CARD_REGION.width);
  assert.ok(code.y > full.y + full.height * 0.8);
  assert.ok(code.width < full.width && code.height < full.height * 0.2);
});

test("code crop matches the small visible frame with portrait, landscape and square camera streams", () => {
  for (const [width, height] of [[1080, 1920], [1920, 1080], [1088, 1088], [2880, 2992]]) {
    const ratio = 63 / 88;
    const crop = getPurchaseCodeCrop(width, height, ratio);
    const scale = Math.max(630 / width, 880 / height);
    const offsetX = (630 - width * scale) / 2;
    const offsetY = (880 - height * scale) / 2;
    assert.ok(Math.abs(crop.x * scale + offsetX - 630 * PURCHASE_CODE_REGION.x) < 0.001);
    assert.ok(Math.abs(crop.y * scale + offsetY - 880 * PURCHASE_CODE_REGION.y) < 0.001);
    assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= width && crop.y + crop.height <= height);
    assert.ok(crop.width * crop.height < width * height * 0.06);
  }
});
