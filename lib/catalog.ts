import type { SetDefinition } from "@/lib/sets";

export type RawCard = {
  id: string;
  name: string;
  riftbound_id: string;
  collector_number: number;
  attributes: {
    energy: number | null;
    might: number | null;
    power: number | null;
  };
  classification: {
    type: string;
    supertype: string | null;
    rarity: string;
    domain: string[];
  };
  set: { set_id: string; label: string };
  media: { image_url: string | null; artist: string | null };
  tags: string[];
  orientation: string;
  metadata: {
    clean_name?: string;
    updated_on?: string;
    alternate_art?: boolean;
    overnumbered?: boolean;
    signature?: boolean;
  };
};

export type MarketProduct = {
  idProduct: number;
  name: string;
  idCategory: number;
  categoryName: string;
  idExpansion: number;
  idMetacard: number;
  dateAdded: string;
};

export type PriceGuide = {
  idProduct: number;
  idCategory: number;
  avg: number | null;
  low: number | null;
  trend: number | null;
  avg1: number | null;
  avg7: number | null;
  avg30: number | null;
  "avg-foil": number | null;
  "low-foil": number | null;
  "trend-foil": number | null;
  "avg1-foil": number | null;
  "avg7-foil": number | null;
  "avg30-foil": number | null;
};

export type VariantKind =
  | "base"
  | "alternate"
  | "overnumbered"
  | "signature"
  | "other";

export type PriceSeries = {
  low: number | null;
  trend: number | null;
  avg30: number | null;
};

export type CatalogVariant = {
  id: string;
  name: string;
  number: string;
  kind: VariantKind;
  label: string;
  imageUrl: string | null;
  artist: string | null;
  productId: number | null;
  standard: PriceSeries;
  foil: PriceSeries;
};

export type CatalogRow = {
  id: string;
  number: string;
  collectorNumber: number;
  name: string;
  type: string;
  rarity: string;
  domains: string[];
  imageUrl: string | null;
  artist: string | null;
  cardmarketUrl: string;
  isExtra: boolean;
  variants: CatalogVariant[];
};

export type CatalogPayload = {
  set: Pick<
    SetDefinition,
    "code" | "name" | "number" | "baseSize" | "release"
  >;
  pricesUpdatedAt: string;
  productsUpdatedAt: string;
  sourceStatus: "live" | "snapshot";
  rows: CatalogRow[];
  stats: {
    cards: number;
    products: number;
    alternatives: number;
    overnumbered: number;
    signatures: number;
    extras: number;
  };
};

const EMPTY_PRICE: PriceSeries = { low: null, trend: null, avg30: null };

const NAME_ALIASES: Record<string, string> = {
  "recruit 271 buff": "recruit",
  "recruit 272 buff": "recruit",
  "recruit 273 buff": "recruit",
  "sprite 274 buff": "sprite",
  "gold buff": "gold",
  iascylla: "lascylla",
  "baron nashor ultimate": "baron nashor",
  "yordle kennen heart of the tempest": "kennen heart of the tempest",
  "defender of tomorrow": "jayce defender of tomorrow",
  "shadowblade lurker": "shadowcloaked lurker",
};

const TOKEN_NAMES = new Set([
  "buff",
  "recruit",
  "sprite",
  "mech",
  "sand soldier",
  "gold",
  "bird",
  "brush",
  "reflection",
  "xp tracker",
  "baron pit",
  "empowered",
  "shadow clone",
  "tentacle",
  "shadow clone tentacle",
]);

function normalizeName(value: string) {
  const normalized = value
    .replace(/\((alternate art|overnumbered|signature)\)/gi, " ")
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return NAME_ALIASES[normalized] ?? normalized;
}

function collectorCode(card: RawCard, set: SetDefinition) {
  const id = card.riftbound_id.toUpperCase();
  const withoutSet = id.startsWith(`${set.code}-`)
    ? id.slice(set.code.length + 1)
    : id;
  return withoutSet.replace(/-\d+$/, "");
}

function inferKind(card: RawCard, set: SetDefinition): VariantKind {
  if (card.metadata.signature) return "signature";
  if (card.metadata.overnumbered) return "overnumbered";
  if (card.metadata.alternate_art || /alternate art/i.test(card.name)) {
    return "alternate";
  }

  const code = collectorCode(card, set);
  if (/^\d+$/.test(code) && Number(code) > set.baseSize) {
    return "overnumbered";
  }

  return "base";
}

const KIND_RANK: Record<VariantKind, number> = {
  base: 0,
  alternate: 1,
  overnumbered: 2,
  signature: 3,
  other: 4,
};

function variantLabel(kind: VariantKind, index: number) {
  if (kind === "base") return "Version normale";
  if (kind === "alternate") return "Alternative";
  if (kind === "overnumbered") return "Outnumbered";
  if (kind === "signature") return "Signée";
  return `Variante ${index + 1}`;
}

function cardmarketSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function displayName(name: string) {
  return name
    .replace(/\s*\((Alternate Art|Overnumbered|Signature)\)\s*/gi, "")
    .trim();
}

function standardSeries(price: PriceGuide | undefined): PriceSeries {
  if (!price) return EMPTY_PRICE;
  return {
    low: price.low,
    trend: price.trend,
    avg30: price.avg30,
  };
}

function foilSeries(price: PriceGuide | undefined): PriceSeries {
  if (!price) return EMPTY_PRICE;
  return {
    low: price["low-foil"],
    trend: price["trend-foil"],
    avg30: price["avg30-foil"],
  };
}

type VariantDraft = {
  card: RawCard | null;
  kind: VariantKind;
};

function syntheticCardType(key: string) {
  if (key.endsWith(" rune")) return "Rune";
  if (TOKEN_NAMES.has(key)) return "Token";
  return "Carte";
}

function completeDrafts(
  initial: VariantDraft[],
  productCount: number,
  key: string,
) {
  const drafts = [...initial];

  if (drafts.length === 0 && productCount > 0) {
    drafts.push({ card: null, kind: "base" });
  }

  while (drafts.length < productCount) {
    const kinds = new Set(drafts.map((draft) => draft.kind));
    let kind: VariantKind = "other";

    if (key.endsWith(" rune") && !kinds.has("alternate")) {
      kind = "alternate";
    } else if (kinds.has("overnumbered") && !kinds.has("signature")) {
      kind = "signature";
    }

    drafts.push({ card: null, kind });
  }

  return drafts.sort((a, b) => {
    const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rank !== 0) return rank;
    return (a.card?.collector_number ?? 9999) - (b.card?.collector_number ?? 9999);
  });
}

export function buildCatalog(args: {
  set: SetDefinition;
  cards: RawCard[];
  products: MarketProduct[];
  prices: PriceGuide[];
  pricesUpdatedAt: string;
  productsUpdatedAt: string;
  sourceStatus: "live" | "snapshot";
}): CatalogPayload {
  const { set } = args;
  const cards = args.cards.filter((card) => card.set.set_id === set.code);
  const products = args.products
    .filter((product) => product.idExpansion === set.expansionId)
    .sort((a, b) => a.idProduct - b.idProduct);
  const priceByProduct = new Map(
    args.prices.map((price) => [price.idProduct, price]),
  );

  const cardsByName = new Map<string, RawCard[]>();
  for (const card of cards) {
    const key = normalizeName(card.name);
    const current = cardsByName.get(key) ?? [];
    current.push(card);
    cardsByName.set(key, current);
  }

  const productsByName = new Map<string, MarketProduct[]>();
  for (const product of products) {
    const key = normalizeName(product.name);
    const current = productsByName.get(key) ?? [];
    current.push(product);
    productsByName.set(key, current);
  }

  const keys = new Set([...cardsByName.keys(), ...productsByName.keys()]);
  const rows: CatalogRow[] = [];

  for (const key of keys) {
    const groupedCards = cardsByName.get(key) ?? [];
    const groupedProducts = productsByName.get(key) ?? [];
    const drafts = completeDrafts(
      groupedCards.map((card) => ({ card, kind: inferKind(card, set) })),
      groupedProducts.length,
      key,
    );

    if (drafts.length === 0) continue;

    const productsForVariants = [...groupedProducts].sort(
      (a, b) => a.idProduct - b.idProduct,
    );
    const fallbackCard =
      drafts.find((draft) => draft.kind === "base" && draft.card)?.card ??
      drafts.find((draft) => draft.card)?.card ??
      null;
    const fallbackProduct = productsForVariants[0] ?? null;
    const rowName = displayName(
      fallbackCard?.name ?? fallbackProduct?.name ?? "Carte sans nom",
    );
    const rowType = fallbackCard?.classification.type ?? syntheticCardType(key);
    const variants: CatalogVariant[] = drafts.map((draft, index) => {
      const product = productsForVariants[index] ?? null;
      const price = product ? priceByProduct.get(product.idProduct) : undefined;
      const inheritedImage =
        draft.card?.media.image_url ??
        (draft.kind === "signature"
          ? drafts.find((item) => item.kind === "overnumbered")?.card?.media
              .image_url
          : null) ??
        fallbackCard?.media.image_url ??
        null;

      return {
        id:
          draft.card?.id ??
          `${set.code}-${product?.idProduct ?? `${key}-${index}`}`,
        name: displayName(draft.card?.name ?? product?.name ?? rowName),
        number: draft.card ? collectorCode(draft.card, set) : "—",
        kind: draft.kind,
        label: variantLabel(draft.kind, index),
        imageUrl: inheritedImage,
        artist: draft.card?.media.artist ?? fallbackCard?.media.artist ?? null,
        productId: product?.idProduct ?? null,
        standard: standardSeries(price),
        foil: foilSeries(price),
      };
    });

    const baseVariant = variants.find((variant) => variant.kind === "base");
    const isExtra = rowType === "Rune" || rowType === "Token";

    rows.push({
      id: `${set.code}-${key.replace(/\s+/g, "-")}`,
      number: fallbackCard ? collectorCode(fallbackCard, set) : "—",
      collectorNumber: fallbackCard?.collector_number ?? 9999,
      name: rowName,
      type: rowType,
      rarity: fallbackCard?.classification.rarity ?? (isExtra ? "Special" : "—"),
      domains: fallbackCard?.classification.domain ?? [],
      imageUrl: baseVariant?.imageUrl ?? variants[0]?.imageUrl ?? null,
      artist: fallbackCard?.media.artist ?? null,
      cardmarketUrl: `https://www.cardmarket.com/en/Riftbound/Cards/${cardmarketSlug(rowName)}/Versions`,
      isExtra,
      variants,
    });
  }

  rows.sort((a, b) => {
    if (a.collectorNumber !== b.collectorNumber) {
      return a.collectorNumber - b.collectorNumber;
    }
    return a.name.localeCompare(b.name, "fr");
  });

  const variants = rows.flatMap((row) => row.variants);
  return {
    set: {
      code: set.code,
      name: set.name,
      number: set.number,
      baseSize: set.baseSize,
      release: set.release,
    },
    pricesUpdatedAt: args.pricesUpdatedAt,
    productsUpdatedAt: args.productsUpdatedAt,
    sourceStatus: args.sourceStatus,
    rows,
    stats: {
      cards: rows.length,
      products: variants.filter((variant) => variant.productId !== null).length,
      alternatives: variants.filter((variant) => variant.kind === "alternate")
        .length,
      overnumbered: variants.filter(
        (variant) => variant.kind === "overnumbered",
      ).length,
      signatures: variants.filter((variant) => variant.kind === "signature")
        .length,
      extras: rows.filter((row) => row.isExtra).length,
    },
  };
}
