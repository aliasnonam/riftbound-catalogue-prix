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
  | "crystal-rose"
  | "overnumbered"
  | "signature"
  | "other";

export type ReprintCategory =
  | "ogn-reprint"
  | "sfd-reprint"
  | "unl-reprint";

export type SpecialEdition = "nashor" | "crystal-rose";

export type SpecialCategory = ReprintCategory | SpecialEdition;

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
  originSet: SetCode | null;
  specialEdition: SpecialEdition | null;
  sortOrder: number;
  variants: CatalogVariant[];
  associatedVariants: CatalogVariant[];
};

export type CatalogPayload = {
  set: Pick<
    SetDefinition,
    "code" | "name" | "number" | "baseSize" | "release"
  >;
  pricesUpdatedAt: string;
  productsUpdatedAt: string;
  refreshAvailableAt: string | null;
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
  edition?: SpecialEdition;
  includeWithoutProduct?: boolean;
  imageUrl?: string;
  artist?: string;
};

const RUNE_DEFINITIONS: Record<string, SpecialCardDefinition> = {
  "fury rune": { number: "R01", type: "Rune", rarity: "Common" },
  "calm rune": { number: "R02", type: "Rune", rarity: "Common" },
  "mind rune": { number: "R03", type: "Rune", rarity: "Common" },
  "body rune": { number: "R04", type: "Rune", rarity: "Common" },
  "chaos rune": { number: "R05", type: "Rune", rarity: "Common" },
  "order rune": { number: "R06", type: "Rune", rarity: "Common" },
};

type VariantVisual = {
  imageUrl: string;
  artist: string | null;
};

const ORIGINS_RUNE_VISUALS: Record<
  string,
  { base: VariantVisual; alternate: VariantVisual }
> = {
  "fury rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/12bcd0cde5d9ff4640e82945001e9fef863530f1-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/09da06c69d07d4e72dde703737ef167472c715af-1488x2078.png",
      artist: "Fairfoul",
    },
  },
  "calm rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/0a0e8c3d16c2595e2f8efcc2b1466226539b506c-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/88187b586b9b3cc2f48fd20c806dd5fc5e1bfc71-1488x2078.png",
      artist: "Zhongqi Li",
    },
  },
  "mind rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/f99aa4874baaebd2e81798c8a3aa01c5900f6d30-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/ecf8c8632c728520b51cd4bc79036677e96ebdfd-1488x2078.png",
      artist: "Fairfoul",
    },
  },
  "body rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/3b3c3c07626d6180457c849047e0228dc0d19539-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/011081f82cab36f8ec0d6874492512fd7859f59e-1488x2078.png",
      artist: "Fairfoul",
    },
  },
  "chaos rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/daf23b0deaa5e1a5a5d310b59e9ad25d1bd70363-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/fbcde2f71fcc06fb8afc83855e24447a393f8943-1488x2078.png",
      artist: "Fairfoul",
    },
  },
  "order rune": {
    base: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/35ec6fdd2124324bb7052cba31c8c44f2e98f3ae-744x1039.png",
      artist: "Greg Ghielmetti & Leah Chen",
    },
    alternate: {
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/0e4904221c3bbbfcfde1734bc414dbe97c67e295-1488x2078.png",
      artist: "Fairfoul",
    },
  },
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
      imageUrl: "https://static.dotgg.gg/riftbound/cards/SFD-T01.2.webp",
      artist: "League Splash Team",
    },
    mech: {
      number: "T01",
      name: "Mech",
      type: "Token",
      rarity: "Common",
      imageUrl: "https://static.dotgg.gg/riftbound/cards/SFD-T01.webp",
      artist: "Dao Trong Le",
    },
    "sand soldier": {
      number: "T02",
      name: "Sand Soldier",
      type: "Token",
      rarity: "Common",
      imageUrl: "https://static.dotgg.gg/riftbound/cards/SFD-T02.webp",
      artist: "Kudos Productions",
    },
    gold: {
      number: "T03",
      name: "Gold",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e878c39b562a4e870e93b819c6d85cdf3fdc5238-744x1039.png",
      artist: "Kudos Productions",
    },
  },
  UNL: {
    "baron pit": {
      number: "T01",
      name: "Baron Pit",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e44f173629322a4e0c32d3f8902c294d4482ef42-1039x744.png",
      artist: "Fish Art Studio",
    },
    bird: {
      number: "T02",
      name: "Bird",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/949a2e43263a9fe0d957595325c7e2ebe06bf85f-744x1039.png",
      artist: "Six More Vodka",
    },
    brush: {
      number: "T03",
      name: "Brush",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/fad09d6bd9bf38e376f430ecb0b400762420d061-1039x744.png",
      artist: "Kudos Productions",
    },
    buff: {
      number: "T04",
      name: "Buff",
      type: "Token",
      rarity: "Common",
      includeWithoutProduct: true,
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/64b9df938587aa93a3d0769a349d9b0cc6942dc2-744x1039.png",
      artist: "League Splash Team",
    },
    gold: {
      number: "T05",
      name: "Gold",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e566605fa989e12e91cd3d3e0b7985f7a8be8e74-744x1039.png",
      artist: "Kudos Productions",
    },
    reflection: {
      number: "T06",
      name: "Reflection",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/80327b196c59841a67a65327974a93223a3c541a-744x1039.png",
      artist: "Kudos Productions & Dark Glow",
    },
    sprite: {
      number: "T07",
      name: "Sprite",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/1a90578f055e01515ebfb069dc3dbdba08d24da0-744x1039.png",
      artist: "Envar Studio",
    },
    "xp tracker": {
      number: "T08",
      name: "XP Tracker",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/715d5bb52fc8ce0886b28f1c15fe89457e504fc9-744x1039.png",
      artist: "Rafael Zanchetin",
    },
  },
  VEN: {
    empowered: {
      number: "T01",
      name: "Empowered",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://static0.srcdn.com/wordpress/wp-content/uploads/2026/07/ven-t01-empowered-t.jpg",
      artist: "Six More Vodka",
    },
    gold: {
      number: "T02",
      name: "Gold",
      type: "Token",
      rarity: "Common",
      includeWithoutProduct: true,
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e566605fa989e12e91cd3d3e0b7985f7a8be8e74-744x1039.png",
      artist: "Kudos Productions",
    },
    mech: {
      number: "T03",
      name: "Mech",
      type: "Token",
      rarity: "Common",
      imageUrl: "https://static.dotgg.gg/riftbound/cards/SFD-T01.webp",
      artist: "Dao Trong Le",
    },
    recruit: {
      number: "T04",
      name: "Recruit",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/08b9ccf225fc2ae9eb9b5668e5361b09789210ee-744x1039.png",
      artist: "Six More Vodka",
    },
    "shadow clone": {
      number: "T05",
      name: "Shadow Clone",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://static0.srcdn.com/wordpress/wp-content/uploads/2026/07/ven-t05-shadow-clone-t.jpg",
      artist: "Six More Vodka",
    },
    tentacle: {
      number: "T06",
      name: "Tentacle",
      type: "Token",
      rarity: "Common",
      imageUrl:
        "https://static0.srcdn.com/wordpress/wp-content/uploads/2026/07/ven-t06-tentacle-t.jpg",
      artist: "Michal Ivan",
    },
    "kaisa survivor": {
      number: "SP1",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
    },
    "sona harmonious": {
      number: "SP2",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
    },
    "ahri inquisitive": {
      number: "SP3",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
    },
    "sett brawler": {
      number: "SP4",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
    },
    "ezreal prodigy": {
      number: "SP5",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
    },
    "lux crownguard": {
      number: "SP6",
      rarity: "Showcase",
      kind: "crystal-rose",
      edition: "crystal-rose",
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

function runeVariantVisual(
  set: SetDefinition,
  key: string,
  kind: VariantKind,
): VariantVisual | undefined {
  const rune = RUNE_DEFINITIONS[key];
  const originsVisual = ORIGINS_RUNE_VISUALS[key];
  if (!rune || !originsVisual) return undefined;

  if (kind === "base" && (set.code === "SFD" || set.code === "UNL")) {
    return originsVisual.base;
  }

  if (kind !== "alternate") return undefined;
  if (set.code === "SFD") return originsVisual.alternate;
  if (set.code === "UNL" || set.code === "VEN") {
    return {
      imageUrl: `https://static.dotgg.gg/riftbound/cards/${set.code}-${rune.number}a.webp`,
      artist: null,
    };
  }

  return undefined;
}

function specialVariantVisual(args: {
  set: SetDefinition;
  key: string;
  kind: VariantKind;
  definition: SpecialCardDefinition | undefined;
}) {
  const { set, key, kind, definition } = args;
  if (kind === "base" && definition?.imageUrl) {
    return {
      imageUrl: definition.imageUrl,
      artist: definition.artist ?? null,
    } satisfies VariantVisual;
  }

  return runeVariantVisual(set, key, kind);
}

function definedVariantNumber(
  definition: SpecialCardDefinition | undefined,
  key: string,
  kind: VariantKind,
) {
  if (!definition) return undefined;
  if (key in RUNE_DEFINITIONS && kind === "alternate") {
    return `${definition.number}a`;
  }
  return definition.number;
}

function orderedProductsForVariants(
  set: SetDefinition,
  key: string,
  products: MarketProduct[],
) {
  const ordered = [...products].sort((a, b) => a.idProduct - b.idProduct);

  // Cardmarket a créé les produits Showcase avant les produits Common pour
  // Spiritforged et Unleashed. Leur ordre d'identifiant est donc inversé par
  // rapport aux variantes affichées (normale, puis alternative).
  if (
    key in RUNE_DEFINITIONS &&
    ordered.length === 2 &&
    (set.code === "SFD" || set.code === "UNL")
  ) {
    ordered.reverse();
  }

  return ordered;
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

const EXPLICIT_REPRINT_ORIGINS: Partial<
  Record<SetCode, Record<string, SetCode>>
> = {
  UNL: {
    "220": "OGN",
    "221": "SFD",
    "222": "SFD",
    "223": "SFD",
    "224": "OGN",
    "225": "OGN",
  },
  VEN: {
    "167": "OGN",
    "168": "OGN",
    "172": "OGN",
    "174": "SFD",
    "175": "SFD",
    "176": "OGN",
    "179": "UNL",
    "180": "UNL",
    "183": "UNL",
    "184": "OGN",
  },
};

function originSetForPremiumRow(args: {
  set: SetDefinition;
  key: string;
  number: string;
  hasCurrentBase: boolean;
  baseNamesBySet: Partial<Record<SetCode, Set<string>>>;
}) {
  const { set, key, number, hasCurrentBase, baseNamesBySet } = args;
  if (hasCurrentBase) return null;

  const explicit = EXPLICIT_REPRINT_ORIGINS[set.code]?.[number];
  if (explicit) return explicit;

  for (const source of REPRINT_SOURCES[set.code] ?? []) {
    if (baseNamesBySet[source]?.has(key)) {
      return source;
    }
  }

  return null;
}

function specialEditionForRow(
  set: SetDefinition,
  number: string,
  definition: SpecialCardDefinition | undefined,
) {
  if (definition?.edition) return definition.edition;
  if (set.code === "UNL" && number.replace(/\*$/, "") === "238") {
    return "nashor";
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
  const code = collectorCode(card, set);
  if (
    card.metadata.alternate_art ||
    /alternate art/i.test(card.name) ||
    /^\d+[A-Z]$/i.test(code)
  ) {
    return "alternate";
  }

  if (/^\d+$/.test(code) && Number(code) > set.baseSize) {
    return "overnumbered";
  }

  return "base";
}

const KIND_RANK: Record<VariantKind, number> = {
  base: 0,
  alternate: 1,
  "crystal-rose": 2,
  overnumbered: 3,
  signature: 4,
  other: 5,
};

function variantLabel(kind: VariantKind, index: number) {
  if (kind === "base") return "Version normale";
  if (kind === "alternate") return "Alternative";
  if (kind === "crystal-rose") return "Crystal Rose";
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
    .replace(
      /\s*\((Alternate Art|Overnumbered|Signature|Ultimate)\)\s*/gi,
      "",
    )
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
  refreshAvailableAt: string | null;
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

    const productsForVariants = orderedProductsForVariants(
      set,
      key,
      groupedProducts,
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
    const overnumberedCode = drafts
      .find((draft) => draft.kind === "overnumbered" && draft.card)
      ?.card;
    const inferredSignatureNumber = overnumberedCode
      ? `${collectorCode(overnumberedCode, set).replace(/\*$/, "")}*`
      : undefined;
    const variants: CatalogVariant[] = drafts.map((draft, index) => {
      const product = productsForVariants[index] ?? null;
      const price = product ? priceByProduct.get(product.idProduct) : undefined;
      const rawVariantName = draft.card?.name ?? product?.name ?? rowName;
      const variantVisual = specialVariantVisual({
        set,
        key,
        kind: draft.kind,
        definition,
      });
      const inheritedImage =
        variantVisual?.imageUrl ??
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
          definedVariantNumber(definition, key, draft.kind) ??
          (draft.card
            ? collectorCode(draft.card, set)
            : draft.kind === "signature"
              ? inferredSignatureNumber ?? "—"
              : "—"),
        kind: draft.kind,
        rarity:
          draft.kind === "alternate" ||
          draft.kind === "crystal-rose" ||
          draft.kind === "overnumbered" ||
          draft.kind === "signature"
            ? "Showcase"
            : draft.card?.classification.rarity ??
              definition?.rarity ??
              fallbackCard?.classification.rarity ??
              (rowType === "Rune" || rowType === "Token" ? "Special" : "—"),
        label: variantLabel(draft.kind, index),
        imageUrl: inheritedImage,
        artist:
          variantVisual?.artist ??
          draft.card?.media.artist ??
          fallbackCard?.media.artist ??
          null,
        productId: product?.idProduct ?? null,
        standard: standardSeries(price),
        foil: foilSeries(price),
      };
    });

    const fallbackCode =
      definition?.number ??
      (fallbackCard ? collectorCode(fallbackCard, set) : "");

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
          originSet: null,
          specialEdition: null,
          sortOrder: collectorSortOrder(code, card.collector_number),
          variants: [variant],
          associatedVariants: [variant],
        });
      });
      continue;
    }

    const entries = variants.map((variant, index) => ({
      variant,
      draft: drafts[index],
    }));
    const regularEntries = entries.filter(
      ({ variant }) =>
        variant.kind !== "overnumbered" && variant.kind !== "signature",
    );
    const premiumEntries = entries.filter(
      ({ variant }) =>
        variant.kind === "overnumbered" || variant.kind === "signature",
    );
    const premiumGroups = new Map<string, typeof premiumEntries>();
    const fallbackPremiumNumber = premiumEntries
      .find(({ variant }) => variant.kind === "overnumbered")
      ?.variant.number.replace(/\*$/, "");

    for (const entry of premiumEntries) {
      const rawNumber = entry.variant.number.replace(/\*$/, "");
      const premiumNumber =
        rawNumber && rawNumber !== "—"
          ? rawNumber
          : fallbackPremiumNumber ?? "—";
      const current = premiumGroups.get(premiumNumber) ?? [];
      current.push(entry);
      premiumGroups.set(premiumNumber, current);
    }

    const hasCurrentBase = regularEntries.some(
      ({ variant }) => variant.kind === "base",
    );
    const rowSlug = key.replace(/\s+/g, "-");

    function pushCatalogRow(
      lineEntries: typeof entries,
      line: "regular" | "premium",
      premiumNumber?: string,
    ) {
      if (lineEntries.length === 0) return;

      const representative =
        lineEntries.find(({ variant }) =>
          line === "premium"
            ? variant.kind === "overnumbered"
            : variant.kind === "base",
        ) ?? lineEntries[0];
      const representativeCard = representative.draft.card;
      const lineVariants = lineEntries.map(({ variant }) => variant);
      const number =
        line === "premium"
          ? premiumNumber ?? representative.variant.number.replace(/\*$/, "")
          : definition?.number ??
            lineVariants.find((variant) => variant.kind === "base")?.number ??
            representative.variant.number ??
            fallbackCode ??
            "—";
      const collectorNumber =
        representativeCard?.collector_number ??
        (number !== "—" && /^\d+$/.test(number) ? Number(number) : 9999);
      const lineName = representative.variant.name || rowName;
      const lineType =
        definition?.type ??
        (isOriginsNumberedToken(representativeCard, set)
          ? "Token"
          : representativeCard?.classification.type ?? rowType);
      const lineIsExtra =
        lineType === "Rune" ||
        lineType === "Token" ||
        /^[RT]\d/i.test(number);
      const originSet =
        line === "premium"
          ? originSetForPremiumRow({
              set,
              key,
              number,
              hasCurrentBase,
              baseNamesBySet,
            })
          : null;

      rows.push({
        id:
          line === "premium"
            ? `${set.code}-${number}-${rowSlug}`
            : `${set.code}-${rowSlug}`,
        number,
        collectorNumber,
        name: lineName,
        type: lineType,
        rarity:
          representative.variant.rarity ??
          definition?.rarity ??
          representativeCard?.classification.rarity ??
          (lineIsExtra ? "Special" : "—"),
        domains:
          representativeCard?.classification.domain ??
          fallbackCard?.classification.domain ??
          [],
        imageUrl: representative.variant.imageUrl,
        artist:
          representative.variant.artist ??
          representativeCard?.media.artist ??
          null,
        cardmarketUrl: `https://www.cardmarket.com/en/Riftbound/Cards/${cardmarketSlug(lineName)}/Versions`,
        isExtra: lineIsExtra,
        isNumbered:
          line === "regular" &&
          lineVariants.some(
            (variant) =>
              variant.kind === "base" && isNumberedCode(variant.number, set),
          ),
        originSet,
        specialEdition: specialEditionForRow(set, number, definition),
        sortOrder: collectorSortOrder(number, collectorNumber),
        variants: lineVariants,
        associatedVariants: variants,
      });
    }

    pushCatalogRow(regularEntries, "regular");
    for (const [number, lineEntries] of premiumGroups) {
      pushCatalogRow(lineEntries, "premium", number);
    }
  }

  rows.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return a.name.localeCompare(b.name, "fr");
  });

  const variants = rows.flatMap((row) => row.variants);
  const alternativeCount = variants.filter(
    (variant) => variant.kind === "alternate",
  ).length;
  const signatureCount = variants.filter(
    (variant) => variant.kind === "signature",
  ).length;
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
    refreshAvailableAt: args.refreshAvailableAt,
    sourceStatus: args.sourceStatus,
    rows,
    stats: {
      cards: rows.length,
      products: rows.length + alternativeCount + signatureCount,
      alternatives: alternativeCount,
      overnumbered: variants.filter(
        (variant) => variant.kind === "overnumbered",
      ).length,
      signatures: signatureCount,
      extras: rows.filter((row) => row.isExtra).length,
    },
  };
}
