export function formatCardmarketSyncDate(value: string, language: "fr" | "en" = "fr") {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    }).format(date)
    : language === "en" ? "Date unavailable" : "Date indisponible";
}
