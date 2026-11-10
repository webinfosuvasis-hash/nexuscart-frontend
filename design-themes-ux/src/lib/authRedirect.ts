/**
 * authRedirect.ts — the `?redirect=` contract shared by /login, /register and
 * the route guards, so "sign in, then come back here" works from anywhere.
 */

export const CHECKOUT_PATH = '/checkout';

/**
 * Only same-origin, absolute paths are honoured. Anything else (`https://…`,
 * protocol-relative `//evil.com`, `/\evil.com`, or control characters such
 * as `/\t/evil.com`, which URL parsing strips back into `//evil.com`) falls
 * back, so a crafted login link can never bounce a customer off-site after
 * they authenticate.
 */
export function safeRedirect(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\\]/.test(raw)) return fallback;
  return raw;
}

/** `/login` or `/register`, carrying the post-auth destination along. */
export function authPath(page: '/login' | '/register', redirect: string | null | undefined): string {
  const target = safeRedirect(redirect, '/');
  return target !== '/' ? `${page}?redirect=${encodeURIComponent(target)}` : page;
}
