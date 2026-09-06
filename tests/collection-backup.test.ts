import assert from "node:assert/strict";
import test from "node:test";

import { createCollectionBackup, getCollectionProgress, getCollectionQuantity, incrementCollectionQuantity, parseCollectionBackup, withCollectionStatus } from "@/lib/collection";

test("an exported collection is accepted by the importer", () => {
  const backup = createCollectionBackup({
    "SFD:sfd-227-221": { status: "owned" },
    "OGN:ogn-001-298": { status: "owned", foil: true },
    "UNL:missing-card": { status: "missing" },
  }, "2026-09-04T12:00:00.000Z");
  const parsed = parseCollectionBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.backup.collection, {
    "SFD:sfd-227-221": { status: "owned" },
    "OGN:ogn-001-298": { status: "owned", foil: true },
  });
});

test("invalid import data is rejected", () => {
  assert.deepEqual(parseCollectionBackup("not json"), { ok: false, reason: "invalid" });
  assert.deepEqual(parseCollectionBackup(JSON.stringify({ version: 99, exportedAt: "2026-09-04", collection: {} })), { ok: false, reason: "unsupported-version" });
});

test("an added card keeps its timestamp in a backup", () => {
  const owned = withCollectionStatus({}, "SFD:sfd-227-221", "owned");
  assert.equal(owned["SFD:sfd-227-221"]?.status, "owned");
  assert.ok(owned["SFD:sfd-227-221"]?.addedAt);

  const parsed = parseCollectionBackup(JSON.stringify(createCollectionBackup(owned)));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.backup.collection["SFD:sfd-227-221"]?.addedAt, owned["SFD:sfd-227-221"]?.addedAt);
});

test("extra copies are persisted without counting twice toward completion", () => {
  const state = incrementCollectionQuantity({ "SFD:sfd-227-221": { status: "owned" } }, "SFD:sfd-227-221");
  assert.equal(getCollectionQuantity(state, "SFD:sfd-227-221"), 2);
  const backup = createCollectionBackup(state);
  const parsed = parseCollectionBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.backup.collection["SFD:sfd-227-221"]?.quantity, 2);
  assert.deepEqual(getCollectionProgress([
    { impressionId: "SFD:sfd-227-221" },
    { impressionId: "SFD:sfd-228-221" },
  ] as never, state), { owned: 1, total: 2, percentage: 50 });
});
