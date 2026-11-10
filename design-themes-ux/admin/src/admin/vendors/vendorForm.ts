import type { VendorStatus } from '@/types';

export interface VendorFormState {
  name: string;
  email: string;
  status: VendorStatus;
  notifyOnOrder: boolean;
}

export type VendorFormErrors = Partial<Record<'name' | 'email', string>>;

// Mirrors the backend DTO (trimmed, non-empty name ≤ 200; email ≤ 320). The
// server stays the authority — this only saves a round trip for obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateVendor(form: VendorFormState): VendorFormErrors {
  const errors: VendorFormErrors = {};
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length > 200) errors.name = 'Name must be 200 characters or fewer';
  if (!email) errors.email = 'Email is required';
  else if (email.length > 320 || !EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  return errors;
}

export function toVendorPayload(form: VendorFormState) {
  return {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    status: form.status,
    notifyOnOrder: form.notifyOnOrder,
  };
}

/**
 * The api client rejects with the backend body: `{ statusCode, message }`, where
 * a ValidationPipe failure's `message` is a string[]; network errors carry only
 * `message`.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const message = (err as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === 'string').join('. ') || fallback;
  return typeof message === 'string' && message ? message : fallback;
}

/** Routes a server validation message to the field it is about, if any. */
export function fieldForServerError(message: string): keyof VendorFormErrors | null {
  if (/email/i.test(message)) return 'email';
  if (/name/i.test(message)) return 'name';
  return null;
}
