import { describe, it, expect } from 'vitest';
import { authPath, safeRedirect } from './authRedirect';

describe('safeRedirect', () => {
  it('keeps same-origin paths, including query strings', () => {
    expect(safeRedirect('/checkout')).toBe('/checkout');
    expect(safeRedirect('/account/orders?page=2')).toBe('/account/orders?page=2');
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['absolute URL', 'https://evil.example/checkout'],
    ['protocol-relative', '//evil.example'],
    ['backslash trick', String.raw`/\evil.example`],
    ['tab-smuggled protocol-relative', '/\t/evil.example'],
    ['newline-smuggled protocol-relative', '/\n/evil.example'],
    ['mid-path backslash', String.raw`/foo/..\..\evil.example`],
    ['relative path', 'checkout'],
  ])('falls back for a %s redirect', (_label, raw) => {
    expect(safeRedirect(raw)).toBe('/');
    expect(safeRedirect(raw, '/home')).toBe('/home');
  });
});

describe('authPath', () => {
  it('carries a meaningful destination across login/register', () => {
    expect(authPath('/register', '/checkout')).toBe('/register?redirect=%2Fcheckout');
    expect(authPath('/login', '/checkout')).toBe('/login?redirect=%2Fcheckout');
  });

  it('omits the param for home or an unsafe destination', () => {
    expect(authPath('/register', '/')).toBe('/register');
    expect(authPath('/login', null)).toBe('/login');
    expect(authPath('/login', '//evil.example')).toBe('/login');
  });
});
