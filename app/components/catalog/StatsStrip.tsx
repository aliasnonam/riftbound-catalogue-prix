import type { CatalogPayload } from "@/lib/catalog";
import { useSiteLanguage } from "@/app/lib/site-language";

type CatalogStats = CatalogPayload["stats"];

export function StatsStrip({ stats }: { stats: CatalogStats }) {
  const { language } = useSiteLanguage();
  const en = language === "en";
  return (
    <div className="stat-strip" aria-label={en ? "Set summary" : "Résumé du set"}>
      <div>
        <div className="stat-main">
          <span>{en ? "Cards" : "Cartes"}</span>
          <strong>{stats.cards}</strong>
        </div>
      </div>
      <div className="stat-total-cell">
        <div className="stat-main">
          <span>{en ? "Collection total" : "Total collection"}</span>
          <strong>{stats.products}</strong>
        </div>
        <small>
          ({stats.cards} + {stats.alternatives} a + {stats.signatures} *)
        </small>
      </div>
      <div>
        <div className="stat-main">
          <span>{en ? "Alternates" : "Alternatives"}</span>
          <strong>{stats.alternatives}</strong>
        </div>
      </div>
      <div>
        <div className="stat-main">
          <span>Outnumbered</span>
          <strong>{stats.overnumbered}</strong>
        </div>
      </div>
      <div>
        <div className="stat-main">
          <span>{en ? "Signed" : "Signées"}</span>
          <strong>{stats.signatures}</strong>
        </div>
      </div>
    </div>
  );
}
