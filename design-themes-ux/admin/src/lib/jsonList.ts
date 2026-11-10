/**
 * Product list fields (tags, images, badges) come from LongText columns holding
 * a JSON array string. Accepts an array, a JSON array string, or a legacy
 * comma-separated string, and always returns an array — so an edit form never
 * shows (and then saves) an empty list for data that exists.
 */
export function parseJsonList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch { /* not JSON — fall through */ }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
