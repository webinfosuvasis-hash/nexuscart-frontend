import { describe, it, expect } from 'vitest';
import { formatMoney, formatMoneyCompact } from './money';

describe('admin money display', () => {
  it('formats in rupees with Indian grouping by default', () => {
    expect(formatMoney(10028.82)).toBe('₹10,028.82');
    expect(formatMoney('8499')).toBe('₹8,499.00');
    expect(formatMoney(1234567.5)).toBe('₹12,34,567.50');
  });

  it('honours the store currency and requested precision', () => {
    expect(formatMoney(19.5, 'USD')).toBe('$19.50');
    expect(formatMoney(8499, 'INR', 0)).toBe('₹8,499');
  });

  it('never prints NaN for missing or bad values', () => {
    expect(formatMoney(null)).toBe('₹0.00');
    expect(formatMoney('abc')).toBe('₹0.00');
  });

  it('compacts large amounts the Indian way', () => {
    expect(formatMoneyCompact(1250000)).toBe('₹12.5L');
    expect(formatMoneyCompact(950)).toBe('₹950');
  });
});
