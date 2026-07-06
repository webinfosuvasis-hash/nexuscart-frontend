import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

// ---------------------------------------------------------------------------
// Cancellation event listeners (INT-1, INT-2, INT-3)
//
// The OutboxProcessorService emits these events after persisting them to the
// outbox table. Wire downstream effects here (email, webhook dispatch, alerting).
// ---------------------------------------------------------------------------

@Injectable()
export class CancellationEventListenerService {
  private readonly logger = new Logger(CancellationEventListenerService.name);

  constructor(private readonly config: ConfigService) {}

  // INT-1: ORDER_CANCELLED — customer notification email / store webhook
  @OnEvent('ORDER_CANCELLED')
  async handleOrderCancelled(payload: Record<string, unknown>): Promise<void> {
    this.logger.log(
      `ORDER_CANCELLED: orderId=${payload.orderId} storeId=${payload.storeId} ` +
      `paymentAction=${payload.paymentAction}`,
    );
    // TODO: inject EmailService / WebhookDispatchService and trigger customer notification
  }

  // INT-2: INVENTORY_RELEASED — downstream inventory sync
  @OnEvent('INVENTORY_RELEASED')
  async handleInventoryReleased(payload: Record<string, unknown>): Promise<void> {
    this.logger.log(
      `INVENTORY_RELEASED: reservationId=${payload.reservationId} orderId=${payload.orderId}`,
    );
    // TODO: trigger downstream inventory sync if needed
  }

  // INT-3: REFUND_FAILED — MUST generate an operational alert.
  // A CANCELLED order with unresolved captured funds requires human intervention.
  // Configure OPS_ALERT_WEBHOOK_URL (Slack / PagerDuty / Teams) to receive real alerts.
  @OnEvent('REFUND_FAILED')
  async handleRefundFailed(payload: Record<string, unknown>): Promise<void> {
    const message =
      `[REFUND_FAILED] orderId=${payload.orderId} storeId=${payload.storeId} ` +
      `txId=${payload.paymentTransactionId} refundId=${payload.refundId} — ${payload.reason}`;

    this.logger.error(`[OPERATIONAL ALERT] ${message}`);
    await this.sendOpsAlert(message, payload);
  }

  // ---------------------------------------------------------------------------
  // Private — operational alert delivery via HTTP webhook
  // ---------------------------------------------------------------------------

  private async sendOpsAlert(
    message: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhookUrl = this.config.get<string>('OPS_ALERT_WEBHOOK_URL');

    if (!webhookUrl) {
      // Degrade gracefully: log a prominent warning so operators know the alert
      // was not delivered externally and that OPS_ALERT_WEBHOOK_URL must be set.
      this.logger.warn(
        'OPS_ALERT_WEBHOOK_URL is not configured — REFUND_FAILED alert was only logged. ' +
        'Set OPS_ALERT_WEBHOOK_URL to a Slack/PagerDuty/Teams webhook to receive real alerts.',
      );
      return;
    }

    const body = JSON.stringify({
      text:      message,
      payload,
      severity:  'CRITICAL',
      timestamp: new Date().toISOString(),
    });

    return new Promise<void>((resolve) => {
      try {
        const url       = new URL(webhookUrl);
        const transport = url.protocol === 'https:' ? https : http;

        const req = transport.request(
          {
            hostname: url.hostname,
            port:     url.port || (url.protocol === 'https:' ? 443 : 80),
            path:     url.pathname + url.search,
            method:   'POST',
            headers:  {
              'Content-Type':   'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              this.logger.error(
                `OPS alert webhook responded HTTP ${res.statusCode} — alert may not have been delivered`,
              );
            }
            res.resume(); // consume response so the socket is released
            resolve();
          },
        );

        req.setTimeout(5000, () => {
          this.logger.error('OPS alert webhook timed out after 5 s — alert may not have been delivered');
          req.destroy();
          resolve();
        });

        req.on('error', (err: Error) => {
          this.logger.error(
            `Failed to deliver REFUND_FAILED alert via webhook: ${err.message}`,
          );
          resolve(); // swallow — logger.error above is the fallback
        });

        req.write(body);
        req.end();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to construct OPS alert webhook request: ${msg}`);
        resolve();
      }
    });
  }
}
