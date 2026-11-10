import { describe, it, expect } from 'vitest';
import { hashWithoutQuery, passwordProblem, resolveStoreId, tokenFromHash } from './lib';

describe('passwordProblem (mirrors the backend rule)', () => {
  it.each([
    ['Correct-Horse-9', null],
    ['short1A', 'Use 8–128 characters.'],
    ['alllowercase1', 'Add at least one uppercase letter.'],
    ['ALLUPPERCASE1', 'Add at least one lowercase letter.'],
    ['NoDigitsHere', 'Add at least one number.'],
    ['A1' + 'a'.repeat(127), 'Use 8–128 characters.'],
  ])('%s → %s', (pw, expected) => {
    expect(passwordProblem(pw)).toBe(expected);
  });
});

describe('invitation / reset link tokens', () => {
  it('reads the token from the hash route and strips it for the address bar', () => {
    const hash = '#/accept-invite?token=abc_DEF-123';
    expect(tokenFromHash(hash)).toBe('abc_DEF-123');
    expect(hashWithoutQuery(hash)).toBe('#/accept-invite');
  });
  it('returns null when there is no token or it is implausibly long', () => {
    expect(tokenFromHash('#/accept-invite')).toBeNull();
    expect(tokenFromHash(`#/reset-password?token=${'x'.repeat(201)}`)).toBeNull();
  });
});

describe('resolveStoreId', () => {
  it('prefers build config, then a well-formed ?store=', () => {
    expect(resolveStoreId('cfgStore123', '?store=other12345')).toBe('cfgStore123');
    expect(resolveStoreId(undefined, '?store=cmqpfhdsf0003bhb9df1jq8j2')).toBe('cmqpfhdsf0003bhb9df1jq8j2');
    expect(resolveStoreId(undefined, '?store=<script>')).toBeNull();
    expect(resolveStoreId(undefined, '')).toBeNull();
  });
});
