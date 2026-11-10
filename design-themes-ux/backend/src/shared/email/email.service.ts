import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// ---------------------------------------------------------------------------
// Transactional email over SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER /
// SMTP_PASS / SMTP_FROM — see .env.example). Any SMTP relay works (SES,
// SendGrid, Postmark, Mailgun, a mailbox provider).
//
// The result says exactly what happened: `accepted` only when the SMTP server
// accepted the message for every recipient — never assume delivery otherwise.
// Unconfigured SMTP is a normal state (dev, or a store that hasn't set it up):
// nothing is sent and the caller is told so.
// ---------------------------------------------------------------------------

export interface EmailMessage {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

export type EmailSendResult =
  | { status: 'accepted'; messageId: string }
  | { status: 'rejected'; reason: string }
  | { status: 'not_configured' };

/** `asha@example.com` → `a***@example.com` — for logs, which must not carry full addresses. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null | undefined;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_FROM'));
  }

  /** Throws on transport errors (connection, auth, timeout) so callers can retry. */
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const transporter = this.getTransporter();
    if (!transporter) return { status: 'not_configured' };

    const info = await transporter.sendMail({
      from:    this.config.get<string>('SMTP_FROM'),
      to:      message.to,
      subject: message.subject,
      html:    message.html,
      text:    message.text,
    });

    const accepted = (info.accepted ?? []).length;
    const rejected = (info.rejected ?? []).length;
    if (accepted > 0 && rejected === 0) {
      return { status: 'accepted', messageId: String(info.messageId ?? '') };
    }
    return { status: 'rejected', reason: String(info.response ?? 'recipient rejected by SMTP server') };
  }

  private getTransporter(): Transporter | null {
    if (this.transporter !== undefined) return this.transporter;
    if (!this.isConfigured()) {
      this.logger.warn('SMTP is not configured (SMTP_HOST / SMTP_FROM) — transactional emails will not be sent');
      this.transporter = null;
      return null;
    }
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    this.transporter = createTransport({
      host:   this.config.get<string>('SMTP_HOST'),
      port,
      secure: port === 465, // implicit TLS on 465; STARTTLS is negotiated on 587
      auth:   user ? { user, pass: this.config.get<string>('SMTP_PASS') } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout:   10_000,
      socketTimeout:     20_000,
    });
    return this.transporter;
  }
}
