const CARDMARKET_SYNC_DATE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function formatCardmarketSyncDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? CARDMARKET_SYNC_DATE.format(date)
    : "Date indisponible";
}
