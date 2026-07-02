export abstract class PaymentDomainEvent {
  abstract readonly SCHEMA_VERSION: number;
  readonly occurredAt: Date = new Date();

  constructor(
    readonly eventType: string,
    readonly paymentTransactionId: string,
    readonly checkoutSessionId: string,
    readonly storeId: string,
    readonly traceId: string | null,
    readonly correlationId: string | null,
  ) {}
}
