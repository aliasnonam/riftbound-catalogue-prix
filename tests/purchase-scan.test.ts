import assert from "node:assert/strict";
import test from "node:test";
import { getPurchaseCodeCrop, PURCHASE_CODE_REGION, resolvePurchaseCode } from "@/lib/purchase-scan";
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
