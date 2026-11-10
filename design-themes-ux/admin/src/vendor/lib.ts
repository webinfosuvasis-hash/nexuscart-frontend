// Pure helpers for the vendor portal (unit-tested in lib.spec.ts).

/** Same rule the backend enforces (vendor-auth.types.ts PASSWORD_RULE). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8 || password.length > 128) return 'Use 8–128 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  return null;
}

/**
 * Reads `token` from the query part of a hash route (`#/accept-invite?token=…`).
 * Tokens live in the fragment so they are never sent to a server or leaked via Referer.
 */
export function tokenFromHash(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q < 0) return null;
  const token = new URLSearchParams(hash.slice(q + 1)).get('token');
  return token && token.length <= 200 ? token : null;
}

/** The hash with its query (and so the token) removed, for history.replaceState. */
export function hashWithoutQuery(hash: string): string {
  const q = hash.indexOf('?');
  return q < 0 ? hash : hash.slice(0, q);
}

/** Store the portal signs in to: build-time config, else ?store= on the page URL. */
export function resolveStoreId(envStoreId: string | undefined, search: string): string | null {
  if (envStoreId) return envStoreId;
  const fromQuery = new URLSearchParams(search).get('store');
  return fromQuery && /^[a-z0-9]{10,40}$/i.test(fromQuery) ? fromQuery : null;
}
