import { describe, it, expect } from 'vitest';
import { addressLines, parseAddress } from './address';

// Shape of the checkout snapshot the backend stores on Order.shippingAddress.
const SNAPSHOT = JSON.stringify({
  firstName: 'Smith', lastName: 'Doe', line1: '1, kolkata', line2: null, city: 'kolkata',
  state: 'WB', postalCode: '700001', country: 'IN', phone: '8989696522', email: 'smith@yopmail.com',
});

describe('order address display', () => {
  it('parses the stored JSON string instead of rendering it character by character', () => {
    expect(addressLines(parseAddress(SNAPSHOT)!)).toEqual([
      'Smith Doe',
      '1, kolkata',
      'kolkata, WB 700001',
      'IN',
      'Phone: 8989696522',
      'Email: smith@yopmail.com',
    ]);
  });

  it('accepts an address that is already an object', () => {
    const a = parseAddress({ line1: '12 MG Road', city: 'Bengaluru', state: 'KA', postalCode: '560001', country: 'IN' });
    expect(addressLines(a!)).toEqual(['12 MG Road', 'Bengaluru, KA 560001', 'IN']);
  });

  it('returns null for unusable values', () => {
    expect(parseAddress('not json')).toBeNull();
    expect(parseAddress('"just a string"')).toBeNull();
    expect(parseAddress('[1,2]')).toBeNull();
    expect(parseAddress(null)).toBeNull();
  });
});
