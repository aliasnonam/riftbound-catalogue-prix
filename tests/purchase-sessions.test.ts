import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePriceDifference,
  calculatePriceDifferencePercent,
  calculateSessionTotals,
  getPurchasePriceTone,
  normaliseSellerPrice,
} from "@/lib/purchase-sessions";

test("calculates purchase price differences and tones", () => {
  assert.equal(calculatePriceDifference(30, 40), -10);
  assert.equal(calculatePriceDifferencePercent(30, 40), -25);
  assert.equal(getPurchasePriceTone(-25), "excellent");
  assert.equal(getPurchasePriceTone(12), "high");
  assert.equal(calculatePriceDifference(null, 40), null);
});

test("normalises seller prices", () => {
  assert.equal(normaliseSellerPrice("30"), 30);
  assert.equal(normaliseSellerPrice("30,5"), 30.5);
  assert.equal(normaliseSellerPrice("30.50"), 30.5);
  assert.equal(normaliseSellerPrice("bad"), null);
});

test("summarises only comparable purchase prices for the difference", () => {
  const totals = calculateSessionTotals([
    { cardmarketPrice: 40, sellerPrice: 30 },
    { cardmarketPrice: 20, sellerPrice: null },
  ] as never);
  assert.equal(totals.count, 2);
  assert.equal(totals.cardmarketTotal, 60);
  assert.equal(totals.sellerTotal, 30);
  assert.equal(totals.difference, -10);
  assert.equal(totals.differencePercent, -25);
  assert.equal(totals.withoutSellerPrice, 1);
});
