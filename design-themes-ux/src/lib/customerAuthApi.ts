/**
 * customerAuthApi.ts — Customer Authentication API client for the Aurus storefront.
 *
 * Uses native fetch (no axios dependency in the storefront bundle — matches
 * cartApi.ts / storefrontApi.ts).
 *
 * Talks to the FI-2 CustomerAuthController (`/customer/auth/*`). Token
 * storage strategy:
 *   - access token:  in-memory only (never persisted) — smaller XSS exposure
 *                    window than localStorage.
 *   - refresh token: localStorage — the backend issues tokens in the JSON
 *                    body (no Set-Cookie), so something has to persist it
 *                    across reloads/tabs for a silent session restore.
 *
 * `authRequest` is the interceptor-equivalent: it attaches the in-memory
 * access token, and on a 401 performs exactly one refresh (deduped across
 * concurrent callers via `refreshPromise`) before retrying the original
 * request once.
 */

import { API_BASE_URL, STORE_ID as CONFIGURED_STORE_ID } from './env';

const BASE_URL = API_BASE_URL;
const STORE_ID = CONFIGURED_STORE_ID || 'default';
const AUTH_BASE = `${BASE_URL}/customer/auth`;

const REFRESH_TOKEN_STORAGE_KEY = 'aurus_customer_refresh_token';

// ─── Types (match CustomerAuthController's DTOs/response shapes) ────────────

export interface AuthenticatedCustomer {
  id: string;
  storeId: string;
  email: string;
  name: string;
  isActive: boolean;
}

export interface CustomerTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface MessageResponse {
  message: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────

export class CustomerAuthApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'CustomerAuthApiError';
  }
}

/** Thrown when a 401 couldn't be resolved by a refresh — the session is truly over. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has expired. Please log in again.');
    this.name = 'SessionExpiredError';
  }
}

// ─── Token storage ────────────────────────────────────────────────────────

let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, disabled storage) — the
    // session simply won't survive a reload; nothing else to do here.
  }
}

/** Persists a freshly issued token pair from register/login/refresh. */
export function applyTokenPair(pair: CustomerTokenPair): void {
  setAccessToken(pair.accessToken);
  setStoredRefreshToken(pair.refreshToken);
}

/** Clears both tokens — called on logout, logout-all, or an unrecoverable 401. */
export function clearTokens(): void {
  setAccessToken(null);
  setStoredRefreshToken(null);
}

// ─── Core fetch ───────────────────────────────────────────────────────────

interface NestResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json() as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      // non-JSON error body — fall back to statusText
    }
    throw new CustomerAuthApiError(res.status, message);
  }
  const body = await res.json() as NestResponse<T>;
  return body.data;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Store-Id': STORE_ID,
    ...extra,
  };
}

/** Unauthenticated call — register/login/refresh/forgot-password/reset-password/verify-email. */
async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options?.headers as Record<string, string>),
  });
  return parseResponse<T>(res);
}

// Ensures concurrent 401s trigger exactly one /refresh call, not one per caller.
let refreshPromise: Promise<void> | null = null;

async function performRefresh(): Promise<void> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new SessionExpiredError();

  try {
    const pair = await publicRequest<CustomerTokenPair>('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    applyTokenPair(pair);
  } catch {
    clearTokens();
    throw new SessionExpiredError();
  }
}

function refreshOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/**
 * Authenticated call to an arbitrary absolute URL — attaches the access
 * token; on 401, refreshes once (deduped) and retries. This is the
 * interceptor-equivalent logic itself; `authRequest` and the exported
 * `authenticatedFetch` are both thin wrappers around it so every other
 * customer-scoped API client (profile, address book, orders, ...) reuses
 * this exact token-refresh dance instead of reimplementing it.
 */
async function authRequestUrl<T>(url: string, options?: RequestInit): Promise<T> {
  const doFetch = () => fetch(url, {
    ...options,
    headers: buildHeaders({
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers as Record<string, string>),
    }),
  });

  let res = await doFetch();
  if (res.status === 401) {
    await refreshOnce(); // throws SessionExpiredError if the refresh token is also invalid/expired
    res = await doFetch();
  }
  return parseResponse<T>(res);
}

/** Authenticated call under `/customer/auth/*` — used only by this module's own endpoints below. */
async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return authRequestUrl<T>(`${AUTH_BASE}${path}`, options);
}

/**
 * Authenticated call for any other customer-scoped endpoint (e.g.
 * `/customer/profile`). Exported so other API client modules get the same
 * access-token-attach + refresh-and-retry behavior without duplicating it.
 */
export async function authenticatedFetch<T>(path: string, options?: RequestInit): Promise<T> {
  return authRequestUrl<T>(`${BASE_URL}${path}`, options);
}

/**
 * Same access-token-attach + refresh-and-retry dance as authRequestUrl, for
 * endpoints that return a raw binary body (e.g. invoice PDFs) instead of the
 * usual `{ success, data, timestamp }` JSON envelope — those bypass
 * TransformInterceptor server-side, so there's no `.data` to unwrap here either.
 */
export async function authenticatedFetchBlob(path: string, options?: RequestInit): Promise<Blob> {
  const url = `${BASE_URL}${path}`;
  const doFetch = () => fetch(url, {
    ...options,
    headers: buildHeaders({
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers as Record<string, string>),
    }),
  });

  let res = await doFetch();
  if (res.status === 401) {
    await refreshOnce();
    res = await doFetch();
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json() as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      // non-JSON error body — fall back to statusText
    }
    throw new CustomerAuthApiError(res.status, message);
  }
  return res.blob();
}

// ─── Endpoints ────────────────────────────────────────────────────────────

export const register = (input: RegisterInput): Promise<CustomerTokenPair> =>
  publicRequest<CustomerTokenPair>('/register', { method: 'POST', body: JSON.stringify(input) });

export const login = (input: LoginInput): Promise<CustomerTokenPair> =>
  publicRequest<CustomerTokenPair>('/login', { method: 'POST', body: JSON.stringify(input) });

export const forgotPassword = (email: string): Promise<MessageResponse> =>
  publicRequest<MessageResponse>('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });

export const resetPassword = (token: string, newPassword: string): Promise<MessageResponse> =>
  publicRequest<MessageResponse>('/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });

export const verifyEmail = (token: string): Promise<MessageResponse> =>
  publicRequest<MessageResponse>('/verify-email', { method: 'POST', body: JSON.stringify({ token }) });

export const getMe = (): Promise<AuthenticatedCustomer> =>
  authRequest<AuthenticatedCustomer>('/me', { method: 'GET' });

export const logout = (): Promise<MessageResponse> => authRequest<MessageResponse>('/logout', {
  method: 'POST',
  // Read fresh from storage, not a closed-over value — a prior refresh may
  // have rotated the token since this module last touched it.
  body: JSON.stringify({ refreshToken: getStoredRefreshToken() ?? '' }),
});

export const logoutAll = (): Promise<MessageResponse> =>
  authRequest<MessageResponse>('/logout-all', { method: 'POST' });

/**
 * Attempts a silent session restore from the persisted refresh token. Called
 * once on app boot by CustomerAuthProvider. Never throws — resolves `null`
 * on any failure (no refresh token, expired, revoked, network error).
 */
export async function bootstrapSession(): Promise<AuthenticatedCustomer | null> {
  if (!getStoredRefreshToken()) return null;
  try {
    await refreshOnce();
    return await getMe();
  } catch {
    clearTokens();
    return null;
  }
}
