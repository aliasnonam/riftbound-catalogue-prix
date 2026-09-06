import assert from "node:assert/strict";
import test from "node:test";

import { findCardFromDetectedText, parseCardScanText } from "@/lib/card-scan";
import type { CollectionImpression } from "@/lib/collection";

function expectScan(input: string, expected: { setCode: string; collectorNumber: number; marker: string; printedSetTotal: number; confidence: "exact" | "probable" }) {
  const result = parseCardScanText(input);
  assert.equal(result.ok, true, input);
  if (!result.ok) return;
  assert.deepEqual(result.value, expected);
}

test("parses printed collector lines", () => {
  expectScan("SFD • 227* / 221", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "exact" });
  expectScan("SFD 227*/221", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "exact" });
  expectScan("SFD - 227 * / 221", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "exact" });
  expectScan("OGN • 247 / 298", { setCode: "OGN", collectorNumber: 247, marker: "", printedSetTotal: 298, confidence: "exact" });
  expectScan("VEN 184/215", { setCode: "VEN", collectorNumber: 184, marker: "", printedSetTotal: 215, confidence: "exact" });
});

test("marks OCR corrections as probable", () => {
  expectScan("SFO 227*/221", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "probable" });
  expectScan("SFD 22T*/221", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "probable" });
  expectScan("SFD 227*/22I", { setCode: "SFD", collectorNumber: 227, marker: "*", printedSetTotal: 221, confidence: "probable" });
});

test("does not accept absent or competing collector lines", () => {
  assert.deepEqual(parseCardScanText("SFD 227"), { ok: false, reason: "not-found" });
  assert.deepEqual(parseCardScanText("SFD 227/221 OGN 247/298"), { ok: false, reason: "ambiguous" });
});

test("uses an unambiguous detected card name as a local fallback", () => {
  const impressions = [{
    impressionId: "SFD:ahri", setCode: "SFD", setName: "Spiritforged",
    row: { id: "ahri", name: "Ahri Inquisitive" },
    variant: { kind: "base" },
  }] as CollectionImpression[];
  const resolved = findCardFromDetectedText("AHRI INQUISITIVE\nWhen I attack", impressions);
  assert.equal(resolved.kind, "match");
  if (resolved.kind !== "match") return;
  assert.equal(resolved.impression.impressionId, "SFD:ahri");
});
