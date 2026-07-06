/**
 * FI-1 — Customer Identity Platform.
 *
 * Shared data-contract types for the customer-auth module. No behavior lives
 * here — strategy/guard/service implementations (IM-3+) consume these shapes.
 */

/** JWT payload signed into both the access and refresh token. */
export interface CustomerJwtPayload {
  /** Customer.id */
  sub: string;
  storeId: string;
  email: string;
  /**
   * Defense-in-depth discriminator: even though a merchant token can never
   * verify against CUSTOMER_JWT_SECRET (different secret entirely), the
   * strategy explicitly rejects any payload missing this claim.
   */
  type: 'customer';
  /**
   * Refresh tokens only (P1 fix) — a random UUID (crypto.randomUUID())
   * guaranteeing the signed JWT string is unique even when every other
   * claim (sub/storeId/email/type) and `iat` (1-second resolution) are
   * identical to a previous issuance for the same customer. Without this,
   * two refresh tokens issued for the same customer within the same second
   * are byte-identical, so their SHA-256 hashes collide on
   * CustomerRefreshToken.tokenHash's unique constraint. Access tokens never
   * carry this claim — they're never persisted/hashed, so the collision
   * can't happen there.
   */
  jti?: string;
}

/** Access + refresh token pair returned by register/login/refresh. */
export interface CustomerTokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * The principal resolved by CustomerJwtStrategy and attached to
 * `request.customer` (never `request.user`, which is the merchant principal).
 */
export interface AuthenticatedCustomer {
  id: string;
  storeId: string;
  email: string;
  name: string;
  isActive: boolean;
}

/** Public-safe shape returned by GET /storefront/auth/me — never includes CustomerCredential fields. */
export interface CustomerProfileResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isEmailVerified: boolean;
}
