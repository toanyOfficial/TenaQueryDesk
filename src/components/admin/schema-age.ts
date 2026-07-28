export const SCHEMA_REFRESH_RECOMMENDED_DAYS = 7;
export const SCHEMA_STALE_DAYS = 30;

export function getSchemaAgeLabel(generatedAt: string | null, now = Date.now()): string | null {
  if (!generatedAt) return null;
  const timestamp = Date.parse(generatedAt);
  if (!Number.isFinite(timestamp)) return null;
  const days = Math.floor(Math.max(0, now - timestamp) / 86_400_000);
  if (days >= SCHEMA_STALE_DAYS) return "오래된 스키마";
  if (days >= SCHEMA_REFRESH_RECOMMENDED_DAYS) return "갱신 권장";
  return null;
}
