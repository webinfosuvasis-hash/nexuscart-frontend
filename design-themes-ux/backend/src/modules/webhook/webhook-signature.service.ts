import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SignatureVerificationResult } from './types/webhook.types';

@Injectable()
export class WebhookSignatureService {
  /**
   * Razorpay: HMAC-SHA256(rawBody, webhookSecret) as hex string.
   * Header: X-Razorpay-Signature
   */
  verifyRazorpay(
    rawBody:       Buffer,
    signature:     string,
    webhookSecret: string,
  ): SignatureVerificationResult {
    if (!webhookSecret) {
      return { valid: false, reason: 'Razorpay webhook secret not configured' };
    }
    if (!signature) {
      return { valid: false, reason: 'Missing X-Razorpay-Signature header' };
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(signature, 'utf8');

    if (expectedBuf.length !== receivedBuf.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }

    const match = timingSafeEqual(expectedBuf, receivedBuf);
    return match ? { valid: true } : { valid: false, reason: 'Signature mismatch' };
  }

  /**
   * Stripe: parses "t=timestamp,v1=sig1,v1=sig2,..." header,
   * checks timestamp tolerance (replay protection), then verifies
   * HMAC-SHA256(`${timestamp}.${rawBody}`, webhookSecret) against each v1 signature.
   */
  verifyStripe(
    rawBody:          Buffer,
    signatureHeader:  string,
    webhookSecret:    string,
    toleranceSeconds: number = 300,
  ): SignatureVerificationResult {
    if (!webhookSecret) {
      return { valid: false, reason: 'Stripe webhook secret not configured' };
    }
    if (!signatureHeader) {
      return { valid: false, reason: 'Missing stripe-signature header' };
    }

    // Parse header: t=timestamp,v1=sig,...
    const parts: Record<string, string[]> = {};
    for (const part of signatureHeader.split(',')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      const key = part.slice(0, eq);
      const val = part.slice(eq + 1);
      if (!parts[key]) parts[key] = [];
      parts[key].push(val);
    }

    const timestamp = parts['t']?.[0];
    const v1Sigs   = parts['v1'] ?? [];

    if (!timestamp) {
      return { valid: false, reason: 'Missing timestamp in stripe-signature header' };
    }
    if (v1Sigs.length === 0) {
      return { valid: false, reason: 'No v1 signatures in stripe-signature header' };
    }

    // Replay protection
    const nowSeconds = Math.floor(Date.now() / 1000);
    const webhookTs  = parseInt(timestamp, 10);
    if (Math.abs(nowSeconds - webhookTs) > toleranceSeconds) {
      return { valid: false, reason: `Webhook timestamp outside tolerance (${toleranceSeconds}s)` };
    }

    // Signed payload = "${timestamp}.${rawBody}"
    const signedPayload = Buffer.concat([
      Buffer.from(`${timestamp}.`, 'utf8'),
      rawBody,
    ]);

    const expected    = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');

    for (const sig of v1Sigs) {
      const receivedBuf = Buffer.from(sig, 'utf8');
      if (expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf)) {
        return { valid: true };
      }
    }

    return { valid: false, reason: 'No v1 signature matched' };
  }
}
