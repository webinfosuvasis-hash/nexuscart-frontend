import { createHash, randomBytes } from 'crypto';

/** Claims of a vendor access token. Signed with VENDOR_JWT_SECRET only. */
export interface VendorJwtPayload {
  sub: string;   // VendorUser.id
  vid: string;   // Vendor.id   — informational; re-checked against the DB on every request
  sid: string;   // Store.id    — informational; re-checked against the DB on every request
  tv:  number;   // VendorUser.tokenVersion at issue time
  typ: 'vendor';
}

/** The principal on `request.vendor`. Never on `request.user`. */
export interface AuthenticatedVendor {
  vendorUserId: string;
  vendorId:     string;
  storeId:      string;
  email:        string;
  name:         string;
}

export const VENDOR_JWT_ISSUER   = 'nexuscart';
export const VENDOR_JWT_AUDIENCE = 'nexuscart-vendor';

/** httpOnly refresh cookie, sent only to the vendor auth endpoints. */
export const VENDOR_REFRESH_COOKIE      = 'nc_vendor_rt';
export const VENDOR_REFRESH_COOKIE_PATH = '/api/v1/vendor/auth';

export const BCRYPT_COST               = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES           = 15;
export const INVITATION_TTL_HOURS      = 72;
export const PASSWORD_RESET_TTL_MINUTES = 60;

/** 256-bit random token for links and refresh cookies (only its SHA-256 is stored). */
export const newOpaqueToken = (): string => randomBytes(32).toString('base64url');
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

// Same rule as customer passwords (RegisterCustomerDto).
export const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,128}$/;
export const PASSWORD_RULE_MESSAGE =
  'password must be 8–128 characters with at least one uppercase letter, one lowercase letter, and one number';
