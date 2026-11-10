/**
 * env.ts — single source of truth for build-time environment configuration.
 *
 * Vite only loads `.env.development` in dev mode and `.env` / `.env.production`
 * in a production build (`vite build`, default mode). To change the backend
 * URL for a future deployment, edit `.env.production` only — nothing in
 * `src/` should ever hardcode an environment-specific URL.
 */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!rawBaseUrl && import.meta.env.PROD) {
  // Fail loudly in a production build rather than silently falling back to
  // localhost — that's exactly the bug this file exists to prevent.
  throw new Error(
    'VITE_API_BASE_URL is not set. Add it to .env.production before building.',
  );
}

/** Backend API base URL, e.g. "https://api.example.com/api/v1" (no trailing slash). */
export const API_BASE_URL = rawBaseUrl ?? 'http://localhost:3000/api/v1';

/** Store ID sent as the X-Store-Id header on every storefront request. */
export const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';
