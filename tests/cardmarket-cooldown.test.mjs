import assert from "node:assert/strict";
import test from "node:test";

import {
  getRefreshAvailableAt,
  isRefreshCooldownActive,
  PRICE_REFRESH_COOLDOWN_MS,
} from "../lib/cardmarket-cooldown.ts";

test("starts a one-hour cooldown from the last successful refresh", () => {
  const lastSuccessfulAt = "2026-08-21T01:12:00.000Z";
  const refreshAvailableAt = getRefreshAvailableAt(lastSuccessfulAt);

  assert.equal(PRICE_REFRESH_COOLDOWN_MS, 60 * 60 * 1000);
  assert.equal(refreshAvailableAt, "2026-08-21T02:12:00.000Z");
  assert.equal(
    isRefreshCooldownActive(
      refreshAvailableAt,
      Date.parse("2026-08-21T02:11:59.999Z"),
    ),
    true,
  );
  assert.equal(
    isRefreshCooldownActive(
      refreshAvailableAt,
      Date.parse("2026-08-21T02:12:00.000Z"),
    ),
    false,
  );
});

test("does not invent a cooldown without a successful timestamp", () => {
  assert.equal(getRefreshAvailableAt(null), null);
  assert.equal(getRefreshAvailableAt("invalid"), null);
  assert.equal(isRefreshCooldownActive(null), false);
});
