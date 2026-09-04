import frenchNames from "@/data/card-name-translations.fr.json";

import type { RawCard } from "@/lib/catalog";

const translations = frenchNames as Record<string, string>;

/** Adds display-only French card names while retaining canonical English data for matching and Cardmarket links. */
export function withFrenchCardNames(cards: RawCard[]): RawCard[] {
  return cards.map((card) => ({
    ...card,
    localized_name: translations[card.riftbound_id] ?? card.name,
  }));
}
