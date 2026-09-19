import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePriceDifference,
  calculatePriceDifferencePercent,
  calculateSessionTotals,
  getPurchasePriceTone,
  normaliseSellerPrice,
  createPurchaseSession,
  createPurchaseSessionItem,
  withPurchaseFinish,
  readPurchaseSessions,
  PURCHASE_SESSIONS_VERSION,
} from "@/lib/purchase-sessions";
import { addPurchasedCollectionCopy, getCollectionQuantity, isCollectionFoil, type CollectionImpression } from "@/lib/collection";

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
  assert.equal(totals.missingCount, 0);
  assert.equal(totals.ownedCount, 0);
});

test("keeps missing cards and owned duplicates distinct in a session", () => {
  const totals = calculateSessionTotals([
    { cardmarketPrice: 4, sellerPrice: 2, collectionStatus: "missing" },
    { cardmarketPrice: 4, sellerPrice: 1, collectionStatus: "owned", ownedQuantity: 2 },
  ] as never);
  assert.equal(totals.missingCount, 1);
  assert.equal(totals.ownedCount, 1);
});

const dual = {
  impressionId: "OGN:008", setCode: "OGN", setName: "Origins",
  row: { name: "Enthousiasme !", cardmarketUrl: "https://www.cardmarket.com/" },
  variant: { number: "008", kind: "base", rarity: "Common", imageUrl: null, pricing: "dual", normal: { low: 0.02, trend: 0.04, avg30: 0.06 }, foil: { low: 2, trend: 4, avg30: 6 } },
} as CollectionImpression;

test("selecting foil updates reference prices, deal and session totals, and survives reload", () => {
  const item = createPurchaseSessionItem(dual, "owned", 1, "low", 1);
  assert.equal(item.finish, "normal");
  assert.equal(item.cardmarketPrice, 0.02);
  const foil = withPurchaseFinish(item, "foil");
  assert.equal(foil.cardmarketPrice, 2);
  assert.equal(calculatePriceDifferencePercent(foil.sellerPrice, foil.cardmarketPrice), -50);
  assert.equal(calculateSessionTotals([foil]).cardmarketTotal, 2);
  const session = { ...createPurchaseSession("Test"), items: [foil] };
  const restored = readPurchaseSessions(JSON.stringify({ version: PURCHASE_SESSIONS_VERSION, sessions: [session] }));
  assert.deepEqual(restored.sessions[0].items[0], foil);
  assert.equal(withPurchaseFinish(foil, "normal").cardmarketPrice, 0.02);
});

test("legacy sessions gain both finish prices in their original price mode", () => {
  const { finish, finishPrices, ...legacy } = createPurchaseSessionItem(dual, "missing", 0, "avg30", 1);
  assert.equal(finish, "normal");
  assert.ok(finishPrices);
  const updated = withPurchaseFinish(legacy, "foil", dual);
  assert.equal(updated.cardmarketPrice, 6);
  assert.equal(withPurchaseFinish(updated, "normal").cardmarketPrice, 0.06);
  const session = { ...createPurchaseSession("Legacy"), items: [legacy] };
  assert.equal(readPurchaseSessions(JSON.stringify({ version: 1, sessions: [session] })).sessions.length, 1);
});

test("missing selected finish price never falls back to the other finish", () => {
  const item = createPurchaseSessionItem(dual, "missing", 0, "low", 1);
  const foil = withPurchaseFinish({ ...item, finishPrices: { normal: 0.02, foil: null } }, "foil");
  assert.equal(foil.cardmarketPrice, null);
  assert.equal(calculateSessionTotals([foil]).difference, null);
});

test("rare and premium printings do not offer a normal/foil switch", () => {
  const item = createPurchaseSessionItem(dual, "missing", 0, "low", 1);
  for (const variant of [{ ...item, rarity: "Rare" }, { ...item, variant: "overnumbered" }]) {
    assert.equal(withPurchaseFinish(variant, "foil", dual), variant);
  }
});

test("confirmed foil purchases retain foil ownership when buying a normal copy later", () => {
  for (const rarity of ["Common", "Uncommon"]) {
    const impression = { ...dual, variant: { ...dual.variant, rarity } };
    const normal = addPurchasedCollectionCopy({}, impression, false);
    assert.equal(isCollectionFoil(normal, impression), false);
    const foil = addPurchasedCollectionCopy(normal, impression, true);
    assert.equal(isCollectionFoil(foil, impression), true);
    assert.equal(getCollectionQuantity(foil, impression.impressionId), 2);
    const anotherNormal = addPurchasedCollectionCopy(foil, impression, false);
    assert.equal(isCollectionFoil(anotherNormal, impression), true);
    assert.equal(getCollectionQuantity(anotherNormal, impression.impressionId), 3);
  }
});
