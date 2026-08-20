import {
  SET_BY_CODE,
  type SetCode,
  type SetDefinition,
} from "@/lib/sets";

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

export type SpecialCategory =
  | "ogn-reprint"
  | "sfd-reprint"
  | "unl-reprint"
  | "nashor"
  | "crystal-rose";

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
  rarity: string;
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
  isNumbered: boolean;
  specialCategory: SpecialCategory | null;
  sortOrder: number;
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

type SpecialCardDefinition = {
  number: string;
  name?: string;
  type?: string;
  rarity?: string;
  kind?: VariantKind;
  category?: SpecialCategory;
  includeWithoutProduct?: boolean;
};

const RUNE_DEFINITIONS: Record<string, SpecialCardDefinition> = {
  "fury rune": { number: "R01", type: "Rune" },
  "calm rune": { number: "R02", type: "Rune" },
  "mind rune": { number: "R03", type: "Rune" },
  "body rune": { number: "R04", type: "Rune" },
  "chaos rune": { number: "R05", type: "Rune" },
  "order rune": { number: "R06", type: "Rune" },
};

const SPECIAL_CARD_DEFINITIONS: Partial<
  Record<SetCode, Record<string, SpecialCardDefinition>>
> = {
  SFD: {
    buff: {
      number: "T00",
      name: "Buff",
      type: "Token",
      rarity: "Common",
      includeWithoutProduct: true,
    },
    mech: { number: "T01", name: "Mech", type: "Token", rarity: "Common" },
    "sand soldier": {
      number: "T02",
      name: "Sand Soldier",
      type: "Token",
      rarity: "Common",
    },
    gold: { number: "T03", name: "Gold", type: "Token", rarity: "Common" },
  },
  VEN: {
    "kaisa survivor": {
      number: "SP1",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
    "sona harmonious": {
      number: "SP2",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
    "ahri inquisitive": {
      number: "SP3",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
    "sett brawler": {
      number: "SP4",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
    "ezreal prodigy": {
      number: "SP5",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
    "lux crownguard": {
      number: "SP6",
      rarity: "Showcase",
      kind: "alternate",
      category: "crystal-rose",
    },
  },
};

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

function specialCardDefinition(set: SetDefinition, key: string) {
  const setSpecific = SPECIAL_CARD_DEFINITIONS[set.code]?.[key];
  if (setSpecific) return setSpecific;
  if (set.code !== "OGN") return RUNE_DEFINITIONS[key];
  return undefined;
}

function isOriginsNumberedToken(card: RawCard | null, set: SetDefinition) {
  return (
    set.code === "OGN" &&
    card !== null &&
    card.collector_number >= 271 &&
    card.collector_number <= 274
  );
}

function cleanOriginsTokenName(name: string) {
  return displayName(name)
    .replace(/\s*\(\d+\)\s*\/\/\s*Buff\s*$/i, "")
    .trim();
}

function isNumberedCode(code: string, set: SetDefinition) {
  const normalized = code.replace(/\*$/, "");
  return /^\d+$/.test(normalized) && Number(normalized) <= set.baseSize;
}

function collectorSortOrder(code: string, fallback: number) {
  const normalized = code.toUpperCase().replace(/\*$/, "");
  if (/^\d+$/.test(normalized)) return Number(normalized);

  const special = /^(SP|R|T)(\d+)$/.exec(normalized);
  if (special) {
    const prefixRank = special[1] === "SP" ? 10_000 : special[1] === "R" ? 20_000 : 30_000;
    return prefixRank + Number(special[2]);
  }

  return 40_000 + fallback;
}

const REPRINT_SOURCES: Partial<Record<SetCode, SetCode[]>> = {
  SFD: ["OGN"],
  UNL: ["OGN", "SFD"],
  VEN: ["OGN", "SFD", "UNL"],
};

const REPRINT_CATEGORY: Partial<Record<SetCode, SpecialCategory>> = {
  OGN: "ogn-reprint",
  SFD: "sfd-reprint",
  UNL: "unl-reprint",
};

function specialCategoryForRow(args: {
  set: SetDefinition;
  key: string;
  definition: SpecialCardDefinition | undefined;
  variants: CatalogVariant[];
  baseNamesBySet: Partial<Record<SetCode, Set<string>>>;
}) {
  const { set, key, definition, variants, baseNamesBySet } = args;
  if (definition?.category) return definition.category;
  if (
    set.code === "UNL" &&
    variants.some((variant) => variant.number.replace(/\*$/, "") === "238")
  ) {
    return "nashor";
  }

  const hasPremiumPrint = variants.some(
    (variant) =>
      variant.kind === "overnumbered" || variant.kind === "signature",
  );
  const hasBasePrint = variants.some((variant) => variant.kind === "base");
  if (!hasPremiumPrint || hasBasePrint) return null;

  for (const source of REPRINT_SOURCES[set.code] ?? []) {
    if (baseNamesBySet[source]?.has(key)) {
      return REPRINT_CATEGORY[source] ?? null;
    }
  }

  return null;
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
  const baseNamesBySet: Partial<Record<SetCode, Set<string>>> = {};
  for (const code of ["OGN", "SFD", "UNL"] satisfies SetCode[]) {
    baseNamesBySet[code] = new Set(
      args.cards
        .filter(
          (card) =>
            card.set.set_id === code &&
            card.collector_number <= SET_BY_CODE[code].baseSize,
        )
        .map((card) => normalizeName(card.name)),
    );
  }
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
  for (const [key, definition] of Object.entries(
    SPECIAL_CARD_DEFINITIONS[set.code] ?? {},
  )) {
    if (definition.includeWithoutProduct) keys.add(key);
  }
  const rows: CatalogRow[] = [];

  for (const key of keys) {
    if (set.code === "OGN" && key === "buff") continue;

    const groupedCards = cardsByName.get(key) ?? [];
    const groupedProducts = productsByName.get(key) ?? [];
    const definition = specialCardDefinition(set, key);
    let drafts = completeDrafts(
      groupedCards.map((card) => ({ card, kind: inferKind(card, set) })),
      groupedProducts.length,
      key,
    );

    if (drafts.length === 0 && definition?.includeWithoutProduct) {
      drafts = [{ card: null, kind: definition.kind ?? "base" }];
    } else if (definition?.kind) {
      drafts = drafts.map((draft) => ({ ...draft, kind: definition.kind! }));
    }

    if (drafts.length === 0) continue;

    const productsForVariants = [...groupedProducts].sort(
      (a, b) => a.idProduct - b.idProduct,
    );
    const fallbackCard =
      drafts.find((draft) => draft.kind === "base" && draft.card)?.card ??
      drafts.find((draft) => draft.card)?.card ??
      null;
    const fallbackProduct = productsForVariants[0] ?? null;
    const fallbackName =
      fallbackCard?.name ?? fallbackProduct?.name ?? "Carte sans nom";
    const rowName =
      definition?.name ??
      (isOriginsNumberedToken(fallbackCard, set)
        ? cleanOriginsTokenName(fallbackName)
        : displayName(fallbackName));
    const rowType =
      definition?.type ??
      (isOriginsNumberedToken(fallbackCard, set)
        ? "Token"
        : fallbackCard?.classification.type ?? syntheticCardType(key));
    const variants: CatalogVariant[] = drafts.map((draft, index) => {
      const product = productsForVariants[index] ?? null;
      const price = product ? priceByProduct.get(product.idProduct) : undefined;
      const rawVariantName = draft.card?.name ?? product?.name ?? rowName;
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
        name:
          definition?.name ??
          (isOriginsNumberedToken(draft.card, set)
            ? cleanOriginsTokenName(rawVariantName)
            : displayName(rawVariantName)),
        number:
          definition?.number ??
          (draft.card ? collectorCode(draft.card, set) : "—"),
        kind: draft.kind,
        rarity:
          draft.kind === "alternate" ||
          draft.kind === "overnumbered" ||
          draft.kind === "signature"
            ? "Showcase"
            : draft.card?.classification.rarity ??
              definition?.rarity ??
              fallbackCard?.classification.rarity ??
              (rowType === "Rune" || rowType === "Token" ? "Special" : "—"),
        label: variantLabel(draft.kind, index),
        imageUrl: inheritedImage,
        artist: draft.card?.media.artist ?? fallbackCard?.media.artist ?? null,
        productId: product?.idProduct ?? null,
        standard: standardSeries(price),
        foil: foilSeries(price),
      };
    });

    const baseVariant = variants.find((variant) => variant.kind === "base");
    const fallbackCode =
      definition?.number ??
      (fallbackCard ? collectorCode(fallbackCard, set) : "");
    const isExtra =
      rowType === "Rune" ||
      rowType === "Token" ||
      /^[RT]\d/i.test(fallbackCode);

    const shouldSplitBasePrints =
      drafts.length > 1 &&
      drafts.every((draft) => draft.kind === "base" && draft.card !== null) &&
      groupedProducts.length === drafts.length;

    if (shouldSplitBasePrints) {
      drafts.forEach((draft, index) => {
        const card = draft.card as RawCard;
        const variant = variants[index];
        const originsToken = isOriginsNumberedToken(card, set);
        const splitName = originsToken
          ? cleanOriginsTokenName(card.name)
          : displayName(card.name).replace(/\s+\d+\s+\(Buff\)$/i, "");
        const splitType = originsToken ? "Token" : card.classification.type;
        const code = collectorCode(card, set);
        rows.push({
          id: `${set.code}-${code}-${key.replace(/\s+/g, "-")}`,
          number: code,
          collectorNumber: card.collector_number,
          name: splitName,
          type: splitType,
          rarity: card.classification.rarity,
          domains: card.classification.domain,
          imageUrl: variant.imageUrl,
          artist: card.media.artist,
          cardmarketUrl: `https://www.cardmarket.com/en/Riftbound/Cards/${cardmarketSlug(fallbackProduct?.name ?? splitName)}/Versions`,
          isExtra:
            splitType === "Rune" ||
            splitType === "Token" ||
            /^[RT]\d/i.test(code),
          isNumbered: isNumberedCode(code, set),
          specialCategory: null,
          sortOrder: collectorSortOrder(code, card.collector_number),
          variants: [variant],
        });
      });
      continue;
    }

    const number = fallbackCode || "—";
    const collectorNumber = fallbackCard?.collector_number ?? 9999;
    const specialCategory = specialCategoryForRow({
      set,
      key,
      definition,
      variants,
      baseNamesBySet,
    });

    rows.push({
      id: `${set.code}-${key.replace(/\s+/g, "-")}`,
      number,
      collectorNumber,
      name: rowName,
      type: rowType,
      rarity:
        definition?.rarity ??
        fallbackCard?.classification.rarity ??
        (isExtra ? "Special" : "—"),
      domains: fallbackCard?.classification.domain ?? [],
      imageUrl: baseVariant?.imageUrl ?? variants[0]?.imageUrl ?? null,
      artist: fallbackCard?.media.artist ?? null,
      cardmarketUrl: `https://www.cardmarket.com/en/Riftbound/Cards/${cardmarketSlug(rowName)}/Versions`,
      isExtra,
      isNumbered: variants.some(
        (variant) =>
          variant.kind === "base" && isNumberedCode(variant.number, set),
      ),
      specialCategory,
      sortOrder: collectorSortOrder(number, collectorNumber),
      variants,
    });
  }

  rows.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
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
