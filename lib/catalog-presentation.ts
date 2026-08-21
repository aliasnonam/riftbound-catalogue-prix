import type {
  CatalogRow,
  SpecialCategory,
} from "@/lib/catalog";
import type { SetCode } from "@/lib/sets";

export type FilterKind =
  | "all"
  | "numbered"
  | "alternate"
  | "overnumbered"
  | "signature"
  | "extras"
  | SpecialCategory;

export type FilterDefinition = { id: FilterKind; label: string };

export const VENDETTA_RIVAL_NUMBERS = new Set([
  167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177,
  178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188,
]);

export const FILTERS_BY_SET: Record<SetCode, FilterDefinition[]> = {
  OGN: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
  SFD: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
  UNL: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "sfd-reprint", label: "SFD Reprint" },
    { id: "nashor", label: "Nashor" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
  VEN: [
    { id: "all", label: "Toutes" },
    { id: "numbered", label: "Set numéroté" },
    { id: "alternate", label: "Alternatives" },
    { id: "overnumbered", label: "Outnumbered" },
    { id: "ogn-reprint", label: "OGN Reprint" },
    { id: "sfd-reprint", label: "SFD Reprint" },
    { id: "unl-reprint", label: "UNL Reprint" },
    { id: "crystal-rose", label: "Crystal Rose" },
    { id: "signature", label: "Signées" },
    { id: "extras", label: "Runes & tokens" },
  ],
};

export function isSpecialFilter(
  filter: FilterKind,
): filter is SpecialCategory {
  return (
    filter === "ogn-reprint" ||
    filter === "sfd-reprint" ||
    filter === "unl-reprint" ||
    filter === "nashor" ||
    filter === "crystal-rose"
  );
}

export function matchesSpecialFilter(
  row: CatalogRow,
  filter: SpecialCategory,
) {
  if (filter === "ogn-reprint") return row.originSet === "OGN";
  if (filter === "sfd-reprint") return row.originSet === "SFD";
  if (filter === "unl-reprint") return row.originSet === "UNL";
  return row.specialEdition === filter;
}

export function getDescriptiveBadges(
  row: Pick<CatalogRow, "originSet" | "specialEdition"> &
    Partial<Pick<CatalogRow, "collectorNumber">>,
  setCode?: SetCode,
) {
  const badges: Array<{ id: string; label: string }> = [];

  if (row.originSet) {
    badges.push({
      id: `${row.originSet.toLowerCase()}-reprint`,
      label: `${row.originSet} Reprint`,
    });
  }

  if (row.specialEdition === "nashor") {
    badges.push({ id: "nashor", label: "Nashor" });
  } else if (row.specialEdition === "crystal-rose") {
    badges.push({ id: "crystal-rose", label: "Crystal Rose" });
  }

  if (
    setCode === "VEN" &&
    typeof row.collectorNumber === "number" &&
    VENDETTA_RIVAL_NUMBERS.has(row.collectorNumber)
  ) {
    badges.push({ id: "rival", label: "Rival" });
  }

  return badges;
}
