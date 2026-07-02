import { PaymentTxStatus } from '@prisma/client';

import {
  DuplicateGatewayRegistrationException,
  GatewayCapabilityException,
  GatewayInitializationException,
  GatewayVerificationException,
  IdempotencyViolationException,
  InvalidPaymentTransitionException,
  PaymentAlreadyCapturedException,
  PaymentAlreadyRefundedException,
  PaymentException,
  PaymentInTerminalStateException,
  PaymentNotAuthorizedException,
  UnsupportedGatewayException,
} from './payment.exceptions';

describe('PaymentException hierarchy', () => {
  it('PaymentException is an Error subclass with name and code', () => {
    const ex = new PaymentException('test msg', 'TEST_CODE');
    expect(ex).toBeInstanceOf(Error);
    expect(ex.message).toBe('test msg');
    expect(ex.code).toBe('TEST_CODE');
    expect(ex.name).toBe('PaymentException');
  });

  describe('InvalidPaymentTransitionException', () => {
    it('sets fromStatus, toStatus, and code', () => {
      const ex = new InvalidPaymentTransitionException(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.REFUNDED,
      );
      expect(ex.fromStatus).toBe(PaymentTxStatus.PENDING);
      expect(ex.toStatus).toBe(PaymentTxStatus.REFUNDED);
      expect(ex.transactionId).toBeUndefined();
      expect(ex.code).toBe('INVALID_PAYMENT_TRANSITION');
      expect(ex.message).toContain('PENDING');
      expect(ex.message).toContain('REFUNDED');
    });

    it('includes transactionId in message when provided', () => {
      const ex = new InvalidPaymentTransitionException(
        PaymentTxStatus.AUTHORIZED,
        PaymentTxStatus.PENDING,
        'tx_abc',
      );
      expect(ex.transactionId).toBe('tx_abc');
      expect(ex.message).toContain('tx_abc');
    });
  });

  describe('PaymentInTerminalStateException', () => {
    it('sets transactionId, status, and code', () => {
      const ex = new PaymentInTerminalStateException('tx_1', PaymentTxStatus.FAILED);
      expect(ex.transactionId).toBe('tx_1');
      expect(ex.status).toBe(PaymentTxStatus.FAILED);
      expect(ex.code).toBe('PAYMENT_TERMINAL_STATE');
      expect(ex.message).toContain('tx_1');
      expect(ex.message).toContain('FAILED');
    });
  });

  describe('PaymentAlreadyCapturedException', () => {
    it('sets transactionId and correct code', () => {
      const ex = new PaymentAlreadyCapturedException('tx_captured');
      expect(ex.transactionId).toBe('tx_captured');
      expect(ex.code).toBe('PAYMENT_ALREADY_CAPTURED');
      expect(ex.message).toContain('tx_captured');
      expect(ex).toBeInstanceOf(PaymentException);
    });
  });

  describe('PaymentAlreadyRefundedException', () => {
    it('sets transactionId and correct code', () => {
      const ex = new PaymentAlreadyRefundedException('tx_refunded');
      expect(ex.transactionId).toBe('tx_refunded');
      expect(ex.code).toBe('PAYMENT_ALREADY_REFUNDED');
      expect(ex.message).toContain('tx_refunded');
    });
  });

  describe('PaymentNotAuthorizedException', () => {
    it('sets transactionId, currentStatus, and code', () => {
      const ex = new PaymentNotAuthorizedException('tx_x', PaymentTxStatus.PENDING);
      expect(ex.transactionId).toBe('tx_x');
      expect(ex.currentStatus).toBe(PaymentTxStatus.PENDING);
      expect(ex.code).toBe('PAYMENT_NOT_AUTHORIZED');
      expect(ex.message).toContain('tx_x');
      expect(ex.message).toContain('PENDING');
    });
  });

  describe('UnsupportedGatewayException', () => {
    it('sets gatewayCode and correct code', () => {
      const ex = new UnsupportedGatewayException('stripe');
      expect(ex.gatewayCode).toBe('stripe');
      expect(ex.code).toBe('UNSUPPORTED_GATEWAY');
      expect(ex.message).toContain('stripe');
    });
  });

  describe('DuplicateGatewayRegistrationException', () => {
    it('sets gatewayCode and correct code', () => {
      const ex = new DuplicateGatewayRegistrationException('razorpay');
      expect(ex.gatewayCode).toBe('razorpay');
      expect(ex.code).toBe('DUPLICATE_GATEWAY_REGISTRATION');
      expect(ex.message).toContain('razorpay');
    });
  });

  describe('GatewayCapabilityException', () => {
    it('sets gatewayCode, capability, and code', () => {
      const ex = new GatewayCapabilityException('cod', 'REFUND');
      expect(ex.gatewayCode).toBe('cod');
      expect(ex.capability).toBe('REFUND');
      expect(ex.code).toBe('GATEWAY_CAPABILITY_NOT_SUPPORTED');
      expect(ex.message).toContain('cod');
      expect(ex.message).toContain('REFUND');
    });
  });

  describe('GatewayInitializationException', () => {
    it('works without a cause', () => {
      const ex = new GatewayInitializationException('razorpay');
      expect(ex.gatewayCode).toBe('razorpay');
      expect(ex.code).toBe('GATEWAY_INIT_FAILED');
      expect(ex.message).toContain('razorpay');
      expect(ex.message).toContain('unknown error');
    });

    it('includes cause message when provided', () => {
      const cause = new Error('connection refused');
      const ex = new GatewayInitializationException('stripe', cause);
      expect(ex.message).toContain('connection refused');
    });
  });

  describe('GatewayVerificationException', () => {
    it('sets gatewayCode and code', () => {
      const ex = new GatewayVerificationException('phonepe', 'signature mismatch');
      expect(ex.gatewayCode).toBe('phonepe');
      expect(ex.code).toBe('GATEWAY_VERIFICATION_FAILED');
      expect(ex.message).toContain('phonepe');
      expect(ex.message).toContain('signature mismatch');
    });
  });

  describe('IdempotencyViolationException', () => {
    it('sets idempotencyKey and code', () => {
      const ex = new IdempotencyViolationException('idem_key_abc');
      expect(ex.idempotencyKey).toBe('idem_key_abc');
      expect(ex.code).toBe('IDEMPOTENCY_VIOLATION');
      expect(ex.message).toContain('idem_key_abc');
    });
  });

  describe('instanceof checks across hierarchy', () => {
    it('all exception types are instanceof PaymentException and Error', () => {
      const exceptions = [
        new PaymentAlreadyCapturedException('tx'),
        new PaymentAlreadyRefundedException('tx'),
        new PaymentNotAuthorizedException('tx', PaymentTxStatus.PENDING),
        new UnsupportedGatewayException('gw'),
        new DuplicateGatewayRegistrationException('gw'),
        new GatewayCapabilityException('gw', 'cap'),
        new GatewayInitializationException('gw'),
        new GatewayVerificationException('gw', 'reason'),
        new IdempotencyViolationException('key'),
        new InvalidPaymentTransitionException(PaymentTxStatus.PENDING, PaymentTxStatus.REFUNDED),
        new PaymentInTerminalStateException('tx', PaymentTxStatus.FAILED),
      ];

      for (const ex of exceptions) {
        expect(ex).toBeInstanceOf(PaymentException);
        expect(ex).toBeInstanceOf(Error);
        expect(typeof ex.name).toBe('string');
        expect(ex.name).not.toBe('Error');
      }
    });
  });
});
