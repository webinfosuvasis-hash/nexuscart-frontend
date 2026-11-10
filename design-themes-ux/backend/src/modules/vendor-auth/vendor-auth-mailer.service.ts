import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService, maskEmail } from '@/shared/email/email.service';
import { sanitizeError } from '../vendors/vendor-order-notification.service';

export type AuthEmailOutcome = 'sent' | 'not_configured' | 'failed';

const escapeHtml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ---------------------------------------------------------------------------
// Vendor invitation / password-reset emails, sent through the shared SMTP
// EmailService. The raw token only ever appears in the link, inside the URL
// fragment (#/…?token=), which browsers never send to servers or in Referer.
// It is never logged and never returned by any API.
// ---------------------------------------------------------------------------
@Injectable()
export class VendorAuthMailer {
  private readonly logger = new Logger(VendorAuthMailer.name);

  constructor(
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  sendInvitation(to: { email: string; name: string }, ctx: { vendorName: string; storeName: string }, rawToken: string) {
    const link = this.link('accept-invite', rawToken);
    return this.send(to.email, 'invitation', {
      subject: `You're invited to the ${ctx.storeName} vendor portal`,
      text:
        `Hi ${to.name},\n\nYou have been invited to manage ${ctx.vendorName} on ${ctx.storeName}.\n` +
        `Set your password and activate your account here (valid for 72 hours):\n${link}\n\n` +
        `If you were not expecting this, you can ignore this email.\n`,
      html:
        `<p>Hi ${escapeHtml(to.name)},</p>` +
        `<p>You have been invited to manage <strong>${escapeHtml(ctx.vendorName)}</strong> on ${escapeHtml(ctx.storeName)}.</p>` +
        `<p><a href="${escapeHtml(link)}">Set your password and activate your account</a> (valid for 72 hours).</p>` +
        `<p>If you were not expecting this, you can ignore this email.</p>`,
    });
  }

  sendPasswordReset(to: { email: string; name: string }, ctx: { storeName: string }, rawToken: string) {
    const link = this.link('reset-password', rawToken);
    return this.send(to.email, 'password reset', {
      subject: `Reset your ${ctx.storeName} vendor portal password`,
      text:
        `Hi ${to.name},\n\nUse this link to choose a new password (valid for 60 minutes):\n${link}\n\n` +
        `If you did not ask for this, ignore this email — your password stays unchanged.\n`,
      html:
        `<p>Hi ${escapeHtml(to.name)},</p>` +
        `<p><a href="${escapeHtml(link)}">Choose a new password</a> (valid for 60 minutes).</p>` +
        `<p>If you did not ask for this, ignore this email — your password stays unchanged.</p>`,
    });
  }

  private link(view: 'accept-invite' | 'reset-password', rawToken: string): string {
    const base = this.config.get<string>('VENDOR_PORTAL_URL', 'http://localhost:8080/vendor.html');
    return `${base}#/${view}?token=${encodeURIComponent(rawToken)}`;
  }

  private async send(
    to: string, kind: string, message: { subject: string; text: string; html: string },
  ): Promise<AuthEmailOutcome> {
    const who = maskEmail(to);
    try {
      const result = await this.email.send({ to, ...message });
      if (result.status === 'accepted') {
        this.logger.log(`Vendor ${kind} email accepted by SMTP server (to=${who})`);
        return 'sent';
      }
      if (result.status === 'not_configured') {
        this.logger.warn(`Vendor ${kind} email NOT sent: SMTP is not configured (to=${who})`);
        return 'not_configured';
      }
      this.logger.error(`Vendor ${kind} email rejected (to=${who}): ${sanitizeError(result.reason)}`);
      return 'failed';
    } catch (err) {
      this.logger.error(`Vendor ${kind} email failed (to=${who}): ${sanitizeError(err instanceof Error ? err.message : String(err))}`);
      return 'failed';
    }
  }
}
