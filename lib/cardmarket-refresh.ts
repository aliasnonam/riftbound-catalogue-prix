import type { MarketProduct, PriceGuide } from "./catalog";

export type PriceExport = {
  version: number;
  createdAt: string;
  priceGuides: PriceGuide[];
};

const PRICE_FIELDS = [
  "avg",
  "low",
  "trend",
  "avg1",
  "avg7",
  "avg30",
  "avg-foil",
  "low-foil",
  "trend-foil",
  "avg1-foil",
  "avg7-foil",
  "avg30-foil",
] as const satisfies ReadonlyArray<keyof PriceGuide>;

const ACTIVE_PRICE_FIELDS = [
  "low",
  "trend",
  "avg30",
  "low-foil",
  "trend-foil",
  "avg30-foil",
] as const satisfies ReadonlyArray<keyof PriceGuide>;

function validPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function parsePriceExport(value: unknown): PriceExport {
  if (!value || typeof value !== "object") {
    throw new Error("Le Price Guide Cardmarket est illisible.");
  }

  const candidate = value as Partial<PriceExport>;
  if (
    !Number.isInteger(candidate.version) ||
    !validDate(candidate.createdAt) ||
    !Array.isArray(candidate.priceGuides)
  ) {
    throw new Error("Le Price Guide Cardmarket est incomplet.");
  }

  return candidate as PriceExport;
}

export function isStoredPriceGuideList(value: unknown): value is PriceGuide[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        Number.isInteger((item as PriceGuide).idProduct),
    )
  );
}

function emptyPriceGuide(product: MarketProduct): PriceGuide {
  return {
    idProduct: product.idProduct,
    idCategory: product.idCategory,
    avg: null,
    low: null,
    trend: null,
    avg1: null,
    avg7: null,
    avg30: null,
    "avg-foil": null,
    "low-foil": null,
    "trend-foil": null,
    "avg1-foil": null,
    "avg7-foil": null,
    "avg30-foil": null,
  };
}

function hasActivePrice(guide: PriceGuide) {
  return ACTIVE_PRICE_FIELDS.some((field) => validPrice(guide[field]));
}

function guideChanged(previous: PriceGuide, next: PriceGuide) {
  return PRICE_FIELDS.some((field) => previous[field] !== next[field]);
}

export function mergeKnownPriceGuides(args: {
  products: MarketProduct[];
  currentPrices: PriceGuide[];
  incomingPrices: PriceGuide[];
}) {
  const productsById = new Map(
    args.products.map((product) => [product.idProduct, product]),
  );
  const currentById = new Map(
    args.currentPrices
      .filter((guide) => productsById.has(guide.idProduct))
      .map((guide) => [guide.idProduct, guide]),
  );
  const incomingById = new Map(
    args.incomingPrices
      .filter(
        (guide) =>
          guide &&
          Number.isInteger(guide.idProduct) &&
          productsById.has(guide.idProduct),
      )
      .map((guide) => [guide.idProduct, guide]),
  );

  let matchedProducts = 0;
  let changedProducts = 0;
  const prices = [...productsById.values()].map((product) => {
    const previous = currentById.get(product.idProduct) ?? emptyPriceGuide(product);
    const incoming = incomingById.get(product.idProduct);
    if (!incoming || !hasActivePrice(incoming)) return previous;

    matchedProducts += 1;
    const next: PriceGuide = { ...previous };
    for (const field of PRICE_FIELDS) {
      const value = incoming[field];
      if (validPrice(value)) next[field] = value;
    }
    if (guideChanged(previous, next)) changedProducts += 1;
    return next;
  });

  const minimumCoverage = Math.max(1, Math.floor(productsById.size * 0.8));
  if (matchedProducts < minimumCoverage) {
    throw new Error("Le Price Guide Cardmarket reçu est trop incomplet.");
  }

  return { prices, matchedProducts, changedProducts };
}
