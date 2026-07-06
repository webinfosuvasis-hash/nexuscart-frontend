import {
  BadRequestException, ConflictException, ServiceUnavailableException,
} from '@nestjs/common';
import {
  GatewayCapabilityException,
  GatewayInitializationException,
  GatewayVerificationException,
  IdempotencyViolationException,
  InvalidPaymentTransitionException,
  PaymentAlreadyCapturedException,
  PaymentAlreadyRefundedException,
  PaymentInTerminalStateException,
  PaymentNotAuthorizedException,
  UnsupportedGatewayException,
} from '@/modules/payment/exceptions/payment.exceptions';

/**
 * PaymentService's exceptions (payment.exceptions.ts) are plain `Error`
 * subclasses, not NestJS `HttpException`s — AllExceptionsFilter has no
 * special case for them, so left unmapped they'd surface as a generic 500.
 * This adapter translates them at the customer-facing REST boundary only;
 * PaymentService/PaymentOrchestratorService/their exception hierarchy are
 * untouched.
 */
export function mapPaymentException(err: unknown): unknown {
  if (
    err instanceof InvalidPaymentTransitionException
    || err instanceof PaymentInTerminalStateException
    || err instanceof PaymentNotAuthorizedException
    || err instanceof UnsupportedGatewayException
    || err instanceof GatewayCapabilityException
    || err instanceof GatewayVerificationException
  ) {
    return new BadRequestException(err.message);
  }

  if (
    err instanceof PaymentAlreadyCapturedException
    || err instanceof PaymentAlreadyRefundedException
    || err instanceof IdempotencyViolationException
  ) {
    return new ConflictException(err.message);
  }

  if (err instanceof GatewayInitializationException) {
    return new ServiceUnavailableException(err.message);
  }

  return err;
}
