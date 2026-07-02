import { PaymentTxStatus } from '@prisma/client';

export class PaymentException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidPaymentTransitionException extends PaymentException {
  constructor(
    public readonly fromStatus: PaymentTxStatus,
    public readonly toStatus: PaymentTxStatus,
    public readonly transactionId?: string,
  ) {
    super(
      `Cannot transition payment from ${fromStatus} to ${toStatus}` +
        (transactionId ? ` (tx: ${transactionId})` : ''),
      'INVALID_PAYMENT_TRANSITION',
    );
  }
}

export class PaymentInTerminalStateException extends PaymentException {
  constructor(
    public readonly transactionId: string,
    public readonly status: PaymentTxStatus,
  ) {
    super(
      `Payment transaction ${transactionId} is in terminal state ${status} and cannot be modified`,
      'PAYMENT_TERMINAL_STATE',
    );
  }
}

export class PaymentAlreadyCapturedException extends PaymentException {
  constructor(public readonly transactionId: string) {
    super(
      `Payment transaction ${transactionId} is already captured`,
      'PAYMENT_ALREADY_CAPTURED',
    );
  }
}

export class PaymentAlreadyRefundedException extends PaymentException {
  constructor(public readonly transactionId: string) {
    super(
      `Payment transaction ${transactionId} is already refunded`,
      'PAYMENT_ALREADY_REFUNDED',
    );
  }
}

export class PaymentNotAuthorizedException extends PaymentException {
  constructor(
    public readonly transactionId: string,
    public readonly currentStatus: PaymentTxStatus,
  ) {
    super(
      `Payment transaction ${transactionId} is not authorized (current status: ${currentStatus})`,
      'PAYMENT_NOT_AUTHORIZED',
    );
  }
}

export class UnsupportedGatewayException extends PaymentException {
  constructor(public readonly gatewayCode: string) {
    super(
      `Payment gateway '${gatewayCode}' is not registered`,
      'UNSUPPORTED_GATEWAY',
    );
  }
}

export class DuplicateGatewayRegistrationException extends PaymentException {
  constructor(public readonly gatewayCode: string) {
    super(
      `Payment gateway '${gatewayCode}' is already registered`,
      'DUPLICATE_GATEWAY_REGISTRATION',
    );
  }
}

export class GatewayCapabilityException extends PaymentException {
  constructor(
    public readonly gatewayCode: string,
    public readonly capability: string,
  ) {
    super(
      `Gateway '${gatewayCode}' does not support capability: ${capability}`,
      'GATEWAY_CAPABILITY_NOT_SUPPORTED',
    );
  }
}

export class GatewayInitializationException extends PaymentException {
  constructor(
    public readonly gatewayCode: string,
    cause?: Error,
  ) {
    super(
      `Failed to initialize gateway '${gatewayCode}': ${cause?.message ?? 'unknown error'}`,
      'GATEWAY_INIT_FAILED',
    );
    if (cause) (this as any).cause = cause;
  }
}

export class GatewayVerificationException extends PaymentException {
  constructor(
    public readonly gatewayCode: string,
    message: string,
  ) {
    super(
      `Gateway '${gatewayCode}' verification failed: ${message}`,
      'GATEWAY_VERIFICATION_FAILED',
    );
  }
}

export class IdempotencyViolationException extends PaymentException {
  constructor(public readonly idempotencyKey: string) {
    super(
      `Duplicate request detected for idempotency key: ${idempotencyKey}`,
      'IDEMPOTENCY_VIOLATION',
    );
  }
}
