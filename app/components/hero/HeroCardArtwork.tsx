import type { HeroPreviewCard } from "./types";

export function HeroCardArtwork({ card }: { card: HeroPreviewCard }) {
  if (!card.crop) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.imageUrl} alt={`Carte ${card.name}`} />
    );
  }

  return (
    <span className={`hero-card-crop hero-card-crop--${card.crop}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.imageUrl} alt={`Carte ${card.name}`} />
    </span>
  );
}
