import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogPage } from "@/app/components/catalog-page";
import { getSetBySlug, SETS } from "@/lib/sets";

export function generateStaticParams() {
  return SETS.filter((set) => set.code !== "OGN").map((set) => ({
    slug: set.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const set = getSetBySlug(slug);
  if (!set) return {};

  const title = `${set.name} — cartes & prix Cardmarket`;
  const description = `Toutes les cartes Riftbound ${set.name} avec prix normal, foil, alternatives, outnumbered et signatures.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [] },
    twitter: { title, description, images: [] },
  };
}

export default async function SetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const set = getSetBySlug(slug);
  if (!set || set.code === "OGN") notFound();

  return <CatalogPage setCode={set.code} />;
}
