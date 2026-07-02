export abstract class CheckoutDomainEvent {
  readonly eventVersion: number = 1;
  readonly occurredAt:   Date   = new Date();

  constructor(
    readonly eventType:    string,
    readonly checkoutId:   string,
    readonly cartId:       string,
    readonly storeId:      string,
    readonly sessionId:    string,
    readonly traceId:      string | null,
    readonly spanId:       string | null,
    readonly correlationId: string | null,
    readonly requestId:    string | null,
    readonly ipAddress:    string | null,
    readonly userAgent:    string | null,
  ) {}
}
