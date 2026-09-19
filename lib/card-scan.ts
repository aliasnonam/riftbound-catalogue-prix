import type { CollectionImpression } from "@/lib/collection";
import type { SetCode } from "@/lib/sets";

const SET_CODES = ["OGN", "SFD", "UNL", "VEN"] as const satisfies readonly SetCode[];

export type ParsedCardScan = {
  setCode: SetCode;
  collectorNumber: number;
  marker: "" | "*" | "a";
  printedSetTotal: number | null;
  confidence: "exact" | "probable";
};

export type ScanParseResult =
  | { ok: true; value: ParsedCardScan }
  | { ok: false; reason: "not-found" | "ambiguous" };

export type ResolvedCardScan =
  | { kind: "match"; impression: CollectionImpression; confidence: "high" | "medium" }
  | { kind: "ambiguous"; candidates: CollectionImpression[] }
  | { kind: "not-found" };

function normalizeDetectedName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordDistance(left: string, right: string) {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 1) return 2;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column];
  }
  return previous[right.length];
}

function nameMatchScore(text: string, candidate: string) {
  if (candidate.length < 4) return 0;
  if (text.includes(candidate) || candidate.includes(text)) return 1;
  const candidateWords = candidate.split(" ").filter((word) => word.length >= 3);
  const detectedWords = text.split(" ").filter((word) => word.length >= 3);
  if (candidateWords.length < 2 || detectedWords.length === 0) return 0;
  const matched = candidateWords.filter((word) => detectedWords.some((detected) => wordDistance(word, detected) <= (word.length >= 7 ? 2 : 1))).length;
  return matched / candidateWords.length;
}

function normalizeOcrText(value: string) {
  return value
    .toUpperCase()
    .replace(/[•·—–_]/g, " ")
    .replace(/[|]/g, "I")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSetCode(value: string): { setCode: SetCode; confidence: "exact" | "probable" } | null {
  if ((SET_CODES as readonly string[]).includes(value)) return { setCode: value as SetCode, confidence: "exact" };
  // OCR can easily confuse O/G, D/O and L/I on the small collector line.
  const likely: Record<string, SetCode> = { O6N: "OGN", SFO: "SFD", SFE: "SFD", VFN: "VEN", UHL: "UNL" };
  const setCode = likely[value];
  return setCode ? { setCode, confidence: "probable" } : null;
}

function normalizeNumber(value: string) {
  return value.replace(/[IL]/g, "1").replace(/T/g, "7").replace(/[OQD]/g, "0").replace(/Z/g, "2").replace(/S/g, "5");
}

/** Extracts the printed line, for example: SFD • 227* / 221. */
export function parseCardScanText(rawText: string): ScanParseResult {
  const text = normalizeOcrText(rawText);
  const matches = [...text.matchAll(/\b([A-Z0-9]{3})\s*[- ]*\s*([0-9ITLOQDSZ]{1,3})\s*([*A]?)\s*\/\s*([0-9ITLOQDSZ]{1,3})\b/g)];
  const parsed = matches.flatMap((match) => {
    const set = normalizeSetCode(match[1]);
    if (!set) return [];
    const rawNumber = match[2];
    const suffix = match[3];
    const rawTotal = match[4];
    const number = Number.parseInt(normalizeNumber(rawNumber), 10);
    const total = Number.parseInt(normalizeNumber(rawTotal), 10);
    if (!Number.isInteger(number) || number <= 0 || !Number.isInteger(total) || total <= 0) return [];
    return [{
      setCode: set.setCode,
      collectorNumber: number,
      marker: suffix === "*" ? "*" : suffix === "A" ? "a" : "",
      printedSetTotal: total,
      confidence: set.confidence === "exact" && /^\d+$/.test(rawNumber) && /^\d+$/.test(rawTotal) ? "exact" : "probable",
    } satisfies ParsedCardScan];
  });
  const distinct = new Map(parsed.map((value) => [`${value.setCode}:${value.collectorNumber}${value.marker}:${value.printedSetTotal}`, value]));
  if (distinct.size === 1) return { ok: true, value: [...distinct.values()][0] };
  return { ok: false, reason: distinct.size > 1 ? "ambiguous" : "not-found" };
}

function parsedNumber(value: string) {
  const match = value.trim().match(/^(\d+)(a|\*)?$/i);
  return match ? { number: Number.parseInt(match[1], 10), marker: (match[2] ?? "").toLowerCase() } : null;
}

/** Resolves the OCR result only against the existing catalogue data. */
export function findCardFromScan(scan: ParsedCardScan, impressions: CollectionImpression[], detectedName = ""): ResolvedCardScan {
  const sameSet = impressions.filter((impression) => impression.setCode === scan.setCode);
  const exact = sameSet.filter((impression) => {
    const number = parsedNumber(impression.variant.number);
    return number?.number === scan.collectorNumber && number.marker === scan.marker;
  });
  const numbered = exact.length ? exact : sameSet.filter((impression) => parsedNumber(impression.variant.number)?.number === scan.collectorNumber);
  const unique = [...new Map(numbered.map((impression) => [impression.impressionId, impression])).values()];
  if (unique.length === 0) return { kind: "not-found" };
  if (unique.length > 1) {
    const normalizedName = normalizeDetectedName(detectedName);
    const named = normalizedName
      ? unique.filter((impression) => (impression.row.scanNames ?? [impression.row.name]).some((name) => nameMatchScore(normalizedName, normalizeDetectedName(name)) >= 0.8))
      : [];
    if (named.length === 1) return { kind: "match", impression: named[0], confidence: "high" };
    return { kind: "ambiguous", candidates: unique };
  }
  return { kind: "match", impression: unique[0], confidence: scan.confidence === "exact" && exact.length === 1 ? "high" : "medium" };
}

/**
 * Fallback for cards whose collector line is too small or reflective for OCR.
 * It only accepts a complete, unambiguous name already present in the local
 * catalogue; it never sends text or an image to a remote recognition service.
 */
export function findCardFromDetectedText(detectedText: string, impressions: CollectionImpression[]): ResolvedCardScan {
  const text = normalizeDetectedName(detectedText);
  if (!text) return { kind: "not-found" };
  const scored = impressions.map((impression) => ({
    impression,
    score: Math.max(...(impression.row.scanNames ?? [impression.row.name]).map((name) => nameMatchScore(text, normalizeDetectedName(name)))),
  })).filter(({ score }) => score >= 0.8);
  if (scored.length === 0) return { kind: "not-found" };
  const bestScore = Math.max(...scored.map(({ score }) => score));
  const matches = scored.filter(({ score }) => score === bestScore).map(({ impression }) => impression);
  const byCard = new Map<string, CollectionImpression[]>();
  for (const impression of matches) {
    const current = byCard.get(impression.row.id) ?? [];
    current.push(impression);
    byCard.set(impression.row.id, current);
  }
  if (byCard.size > 1) return { kind: "ambiguous", candidates: [...byCard.values()].flat() };
  const candidates = [...byCard.values()][0];
  // Names identify the card but not necessarily a premium printing. The base
  // printing is the safe V1 choice; a collector number remains authoritative.
  return { kind: "match", impression: candidates.find((candidate) => candidate.variant.kind === "base") ?? candidates[0], confidence: "medium" };
}
