import { notFound } from "next/navigation";

import { CollectionPage } from "@/app/components/collection-page";
import { getSetBySlug } from "@/lib/sets";

const COLLECTION_VIEWS = ["missing", "owned", "manage"] as const;

export function generateStaticParams() {
  return ["origins", "spiritforged", "unleashed", "vendetta"].flatMap((set) => COLLECTION_VIEWS.map((view) => ({ set, view })));
}

export default async function FocusedCollectionPage({
  params,
}: {
  params: Promise<{ set: string; view: string }>;
}) {
  const { set: slug, view } = await params;
  const set = getSetBySlug(slug);
  if (!set || !COLLECTION_VIEWS.includes(view as (typeof COLLECTION_VIEWS)[number])) notFound();

  return <CollectionPage view={view as (typeof COLLECTION_VIEWS)[number]} focusSetCode={set.code} />;
}
