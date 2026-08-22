export type HeroPreviewCard = {
  number?: string;
  name: string;
  imageUrl: string;
  crop?: "left" | "right";
};

export type RivalCardDefinition = {
  number: number;
  name: string;
};

export type RivalDiptych = {
  imageUrl: string;
  cards: readonly [RivalCardDefinition, RivalCardDefinition];
};
