import assert from "node:assert/strict";
import test from "node:test";

import { formatCardmarketSyncDate } from "../lib/cardmarket-date.ts";

test("formats the persisted synchronization timestamp in Europe/Paris", () => {
  assert.equal(
    formatCardmarketSyncDate("2026-08-21T01:12:00.000Z"),
    "21 août 2026 à 03:12",
  );
});
