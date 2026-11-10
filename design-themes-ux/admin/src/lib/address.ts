import type { Address } from '@/types';

/**
 * Order addresses are stored as a JSON snapshot string (Order.shippingAddress
 * is a text column), but older/other records may already be objects. Returns
 * null for anything unusable rather than rendering raw JSON.
 */
export function parseAddress(value: unknown): Address | null {
  let v = value;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Address) : null;
}

/** Display lines: name, street, city/state/postcode, country, then contact. */
export function addressLines(a: Address): string[] {
  const join = (parts: (string | undefined | null)[], sep: string) =>
    parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(sep);
  return [
    join([a.firstName, a.lastName], ' '),
    join([a.line1, a.line2], ', '),
    join([a.city, join([a.state, a.postalCode], ' ')], ', '),
    a.country ?? '',
    a.phone ? `Phone: ${a.phone}` : '',
    a.email ? `Email: ${a.email}` : '',
  ].filter(Boolean);
}
