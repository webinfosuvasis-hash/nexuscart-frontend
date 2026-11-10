import { describe, it, expect } from 'vitest';
import { apiErrorMessage, fieldForServerError, toVendorPayload, validateVendor } from './vendorForm';

const base = { name: 'Suta Boutique', email: 'orders@suta.example', status: 'ACTIVE' as const, notifyOnOrder: true };

describe('validateVendor', () => {
  it('accepts a valid vendor', () => {
    expect(validateVendor(base)).toEqual({});
  });

  it.each([
    [{ name: '   ' }, 'name', 'Name is required'],
    [{ name: 'x'.repeat(201) }, 'name', 'Name must be 200 characters or fewer'],
    [{ email: '' }, 'email', 'Email is required'],
    [{ email: 'not-an-email' }, 'email', 'Enter a valid email address'],
    [{ email: 'a b@c.co' }, 'email', 'Enter a valid email address'],
    [{ email: 'a@b' }, 'email', 'Enter a valid email address'],
  ])('rejects %o', (patch, field, message) => {
    expect(validateVendor({ ...base, ...patch })).toEqual({ [field]: message });
  });
});

describe('toVendorPayload', () => {
  it('trims the name and normalises the email', () => {
    expect(toVendorPayload({ ...base, name: '  Suta  ', email: ' Orders@Suta.Example ' }))
      .toEqual({ name: 'Suta', email: 'orders@suta.example', status: 'ACTIVE', notifyOnOrder: true });
  });
});

describe('apiErrorMessage', () => {
  it('joins ValidationPipe message arrays', () => {
    expect(apiErrorMessage({ statusCode: 400, message: ['email must be an email', 'name should not be empty'] }))
      .toBe('email must be an email. name should not be empty');
  });
  it('passes through a single message (e.g. duplicate name → 409)', () => {
    expect(apiErrorMessage({ statusCode: 409, message: 'A vendor with this name already exists in this store' }))
      .toBe('A vendor with this name already exists in this store');
  });
  it('falls back when there is nothing usable', () => {
    expect(apiErrorMessage(undefined, 'Failed')).toBe('Failed');
    expect(apiErrorMessage({ message: [] }, 'Failed')).toBe('Failed');
  });
});

describe('fieldForServerError', () => {
  it('routes messages to the field they mention', () => {
    expect(fieldForServerError('email must be an email')).toBe('email');
    expect(fieldForServerError('A vendor with this name already exists in this store')).toBe('name');
    expect(fieldForServerError('Internal server error')).toBeNull();
  });
});
