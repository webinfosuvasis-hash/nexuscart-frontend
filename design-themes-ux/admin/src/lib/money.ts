/**
 * Money display for admin screens, in the store's own currency
 * (StoreSettings.currency — INR for this store). Amounts are rupees (or the
 * store currency's major unit), as the API returns them.
 */

const localeFor = (currency: string) => (currency === 'INR' ? 'en-IN' : 'en-US');

export function formatMoney(amount: number | string | null | undefined, currency = 'INR', decimals = 2): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${currency} ${n.toFixed(decimals)}`;
  }
}

/** Short form for KPI tiles and chart axes — ₹12.5L, ₹3.2Cr in INR. */
export function formatMoneyCompact(amount: number | null | undefined, currency = 'INR'): string {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: 'currency', currency, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}
