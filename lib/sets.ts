export type SetCode = "OGN" | "SFD" | "UNL" | "VEN";

export type SetDefinition = {
  code: SetCode;
  slug: string;
  number: number;
  name: string;
  subtitle: string;
  release: string;
  baseSize: number;
  expansionId: number;
  accent: string;
  accentSoft: string;
};

export const SETS: SetDefinition[] = [
  {
    code: "OGN",
    slug: "origins",
    number: 1,
    name: "Origins",
    subtitle: "Le point de départ de la collection Riftbound.",
    release: "31 octobre 2025",
    baseSize: 298,
    expansionId: 6286,
    accent: "#e7b85c",
    accentSoft: "rgba(231, 184, 92, 0.16)",
  },
  {
    code: "SFD",
    slug: "spiritforged",
    number: 2,
    name: "Spiritforged",
    subtitle:
      "La collection s’étend avec 12 nouvelles légendes, de nouveaux objets, des réimpressions d’Origins ainsi que des runes et tokens hors set numéroté.",
    release: "13 février 2026",
    baseSize: 221,
    expansionId: 6399,
    accent: "#f07b62",
    accentSoft: "rgba(240, 123, 98, 0.16)",
  },
  {
    code: "UNL",
    slug: "unleashed",
    number: 3,
    name: "Unleashed",
    subtitle:
      "Le troisième set introduit 12 nouvelles légendes, des réimpressions d’anciens sets et la rareté Ultime avec Baron Nashor.",
    release: "8 mai 2026",
    baseSize: 219,
    expansionId: 6491,
    accent: "#52cbb7",
    accentSoft: "rgba(82, 203, 183, 0.16)",
  },
  {
    code: "VEN",
    slug: "vendetta",
    number: 4,
    name: "Vendetta",
    subtitle:
      "Le quatrième set ajoute 9 nouvelles légendes, des réimpressions des trois sets précédents, 22 Rival Overnumbered en 11 diptyques et les Crystal Rose.",
    release: "31 juillet 2026",
    baseSize: 166,
    expansionId: 6587,
    accent: "#aa83ff",
    accentSoft: "rgba(170, 131, 255, 0.16)",
  },
];

export const SET_BY_CODE = Object.fromEntries(
  SETS.map((set) => [set.code, set]),
) as Record<SetCode, SetDefinition>;

export function getSetBySlug(slug: string) {
  return SETS.find((set) => set.slug === slug);
}

export function getSetHref(code: SetCode) {
  const set = SET_BY_CODE[code];
  return code === "OGN" ? "/" : `/sets/${set.slug}`;
}
