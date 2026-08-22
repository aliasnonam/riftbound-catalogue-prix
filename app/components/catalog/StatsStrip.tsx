import type { CatalogPayload } from "@/lib/catalog";

type CatalogStats = CatalogPayload["stats"];

export function StatsStrip({ stats }: { stats: CatalogStats }) {
  return (
    <div className="stat-strip" aria-label="Résumé du set">
      <div>
        <div className="stat-main">
          <span>Cartes</span>
          <strong>{stats.cards}</strong>
        </div>
      </div>
      <div className="stat-total-cell">
        <div className="stat-main">
          <span>Total collection</span>
          <strong>{stats.products}</strong>
        </div>
        <small>
          ({stats.cards} + {stats.alternatives} a + {stats.signatures} *)
        </small>
      </div>
      <div>
        <div className="stat-main">
          <span>Alternatives</span>
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
          <span>Signées</span>
          <strong>{stats.signatures}</strong>
        </div>
      </div>
    </div>
  );
}
