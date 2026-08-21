export const PRICE_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

export function getRefreshAvailableAt(lastSuccessfulAt: string | null) {
  if (!lastSuccessfulAt) return null;
  const lastSuccessfulTime = Date.parse(lastSuccessfulAt);
  if (!Number.isFinite(lastSuccessfulTime)) return null;
  return new Date(lastSuccessfulTime + PRICE_REFRESH_COOLDOWN_MS).toISOString();
}

export function isRefreshCooldownActive(
  refreshAvailableAt: string | null,
  now = Date.now(),
) {
  if (!refreshAvailableAt) return false;
  const availableTime = Date.parse(refreshAvailableAt);
  return Number.isFinite(availableTime) && now < availableTime;
}
