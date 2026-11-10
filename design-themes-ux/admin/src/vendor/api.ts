import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { resolveStoreId } from './lib';

// ---------------------------------------------------------------------------
// Vendor portal API client — separate from the admin client (lib/api.ts):
// nothing is read from or written to localStorage.
//   • access token: in memory only (gone on reload; restored via refresh)
//   • refresh token: httpOnly cookie set by the API, sent only to /vendor/auth/*
//   • X-Store-Id: only on login / forgot-password; afterwards the API derives
//     the store from the token and ignores the header.
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
export const STORE_ID = resolveStoreId(import.meta.env.VITE_VENDOR_STORE_ID, window.location.search);

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => { accessToken = t; };

export const vendorApi = axios.create({ baseURL: BASE_URL, withCredentials: true, timeout: 30_000, headers: { 'Content-Type': 'application/json' } });

vendorApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

export interface VendorProfile {
  id: string; name: string; email: string;
  vendor: { id: string; name: string };
  store:  { id: string; name: string };
}
interface SessionResponse { accessToken: string; expiresIn: string; vendor: VendorProfile }
const unwrap = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

/** One refresh at a time: concurrent 401s wait for the same rotation. */
let refreshing: Promise<SessionResponse> | null = null;
export function refreshSession(): Promise<SessionResponse> {
  refreshing ??= unwrap<SessionResponse>(vendorApi.post('/vendor/auth/refresh'))
    .then((s) => { setAccessToken(s.accessToken); return s; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

let onSignedOut: () => void = () => undefined;
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

vendorApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthCall = original?.url?.startsWith('/vendor/auth/');
  if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
    original._retried = true;
    try {
      await refreshSession();
      return vendorApi(original);
    } catch {
      setAccessToken(null);
      onSignedOut();
    }
  }
  return Promise.reject(error.response?.data ?? { message: error.message });
});

const withStore = () => (STORE_ID ? { headers: { 'X-Store-Id': STORE_ID } } : {});

export const vendorAuth = {
  login: (email: string, password: string) =>
    unwrap<SessionResponse>(vendorApi.post('/vendor/auth/login', { email, password }, withStore())),
  acceptInvite: (token: string, password: string) =>
    unwrap<SessionResponse>(vendorApi.post('/vendor/auth/accept-invite', { token, password })),
  forgotPassword: (email: string) =>
    unwrap<{ message: string }>(vendorApi.post('/vendor/auth/forgot-password', { email }, withStore())),
  resetPassword: (token: string, password: string) =>
    unwrap<{ message: string }>(vendorApi.post('/vendor/auth/reset-password', { token, password })),
  logout: () => vendorApi.post('/vendor/auth/logout').catch(() => undefined),
  me: () => unwrap<VendorProfile>(vendorApi.get('/vendor/me')),
  updateName: (name: string) => unwrap<VendorProfile>(vendorApi.patch('/vendor/me', { name })),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap<SessionResponse>(vendorApi.post('/vendor/me/password', { currentPassword, newPassword })),
};
