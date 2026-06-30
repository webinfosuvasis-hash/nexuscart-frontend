/**
 * absoluteUrl — resolves a path (or already-absolute URL) against the current
 * origin. Canonical tags, Open Graph URLs, and JSON-LD `item`/`url` fields
 * are required to be absolute per spec — a bare path like "/products/123"
 * is invalid for og:url and is ambiguous as a BreadcrumbList item id.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}
