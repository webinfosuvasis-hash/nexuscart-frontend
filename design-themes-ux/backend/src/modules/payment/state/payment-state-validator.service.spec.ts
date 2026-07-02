import { PaymentTxStatus } from '@prisma/client';

import {
  InvalidPaymentTransitionException,
  PaymentInTerminalStateException,
} from '../exceptions/payment.exceptions';
import { TERMINAL_STATES } from './payment-state-transitions';
import { PaymentStateValidatorService } from './payment-state-validator.service';

describe('PaymentStateValidatorService', () => {
  let svc: PaymentStateValidatorService;

  beforeEach(() => {
    svc = new PaymentStateValidatorService();
  });

  // -------------------------------------------------------------------------
  // assertCanTransition — valid transitions
  // -------------------------------------------------------------------------

  describe('assertCanTransition — valid transitions', () => {
    const validCases: [PaymentTxStatus, PaymentTxStatus][] = [
      [PaymentTxStatus.PENDING,            PaymentTxStatus.GATEWAY_CREATED],
      [PaymentTxStatus.PENDING,            PaymentTxStatus.FAILED],
      [PaymentTxStatus.PENDING,            PaymentTxStatus.CANCELLED],
      [PaymentTxStatus.GATEWAY_CREATED,    PaymentTxStatus.AUTHORIZED],
      [PaymentTxStatus.GATEWAY_CREATED,    PaymentTxStatus.CAPTURED],   // direct-capture gateways
      [PaymentTxStatus.GATEWAY_CREATED,    PaymentTxStatus.FAILED],
      [PaymentTxStatus.GATEWAY_CREATED,    PaymentTxStatus.CANCELLED],
      [PaymentTxStatus.GATEWAY_CREATED,    PaymentTxStatus.EXPIRED],
      [PaymentTxStatus.AUTHORIZED,         PaymentTxStatus.CAPTURED],
      [PaymentTxStatus.AUTHORIZED,         PaymentTxStatus.FAILED],
      [PaymentTxStatus.AUTHORIZED,         PaymentTxStatus.CANCELLED],
      [PaymentTxStatus.CAPTURED,           PaymentTxStatus.REFUNDED],
      [PaymentTxStatus.CAPTURED,           PaymentTxStatus.PARTIALLY_REFUNDED],
      [PaymentTxStatus.PARTIALLY_REFUNDED, PaymentTxStatus.REFUNDED],
    ];

    test.each(validCases)('%s → %s does not throw', (from, to) => {
      expect(() => svc.assertCanTransition(from, to)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // assertCanTransition — invalid transitions (wrong target)
  // -------------------------------------------------------------------------

  describe('assertCanTransition — invalid transitions', () => {
    const invalidCases: [PaymentTxStatus, PaymentTxStatus][] = [
      [PaymentTxStatus.PENDING,         PaymentTxStatus.CAPTURED],
      [PaymentTxStatus.PENDING,         PaymentTxStatus.AUTHORIZED],
      [PaymentTxStatus.PENDING,         PaymentTxStatus.REFUNDED],
      [PaymentTxStatus.PENDING,         PaymentTxStatus.EXPIRED],
      [PaymentTxStatus.AUTHORIZED,      PaymentTxStatus.GATEWAY_CREATED],  // backward
      [PaymentTxStatus.AUTHORIZED,      PaymentTxStatus.PENDING],          // backward
      [PaymentTxStatus.CAPTURED,        PaymentTxStatus.AUTHORIZED],       // backward
      [PaymentTxStatus.CAPTURED,        PaymentTxStatus.GATEWAY_CREATED],  // backward
      [PaymentTxStatus.CAPTURED,        PaymentTxStatus.PENDING],          // backward
      [PaymentTxStatus.CAPTURED,        PaymentTxStatus.FAILED],
      [PaymentTxStatus.PARTIALLY_REFUNDED, PaymentTxStatus.CAPTURED],      // backward
    ];

    test.each(invalidCases)('%s → %s throws InvalidPaymentTransitionException', (from, to) => {
      expect(() => svc.assertCanTransition(from, to)).toThrow(
        InvalidPaymentTransitionException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertCanTransition — terminal states throw PaymentInTerminalStateException
  // -------------------------------------------------------------------------

  describe('assertCanTransition — terminal states', () => {
    const terminalStatuses = Array.from(TERMINAL_STATES);
    const anySafeTarget = PaymentTxStatus.PENDING;

    test.each(terminalStatuses)(
      '%s is terminal: throws PaymentInTerminalStateException',
      (terminalStatus) => {
        expect(() =>
          svc.assertCanTransition(terminalStatus, anySafeTarget, 'tx_abc'),
        ).toThrow(PaymentInTerminalStateException);
      },
    );

    it('includes transactionId in PaymentInTerminalStateException', () => {
      let caught: PaymentInTerminalStateException;
      try {
        svc.assertCanTransition(PaymentTxStatus.FAILED, PaymentTxStatus.PENDING, 'tx_123');
      } catch (e) {
        caught = e as PaymentInTerminalStateException;
      }
      expect(caught).toBeInstanceOf(PaymentInTerminalStateException);
      expect(caught.transactionId).toBe('tx_123');
      expect(caught.status).toBe(PaymentTxStatus.FAILED);
    });

    it('uses "unknown" transactionId when none provided', () => {
      let caught: PaymentInTerminalStateException;
      try {
        svc.assertCanTransition(PaymentTxStatus.CANCELLED, PaymentTxStatus.PENDING);
      } catch (e) {
        caught = e as PaymentInTerminalStateException;
      }
      expect(caught.transactionId).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Forward-Only State Rule
  // -------------------------------------------------------------------------

  describe('Forward-Only State Rule', () => {
    it('rejects AUTHORIZED → PENDING (backward)', () => {
      expect(() =>
        svc.assertCanTransition(PaymentTxStatus.AUTHORIZED, PaymentTxStatus.PENDING),
      ).toThrow(InvalidPaymentTransitionException);
    });

    it('rejects CAPTURED → GATEWAY_CREATED (backward)', () => {
      expect(() =>
        svc.assertCanTransition(PaymentTxStatus.CAPTURED, PaymentTxStatus.GATEWAY_CREATED),
      ).toThrow(InvalidPaymentTransitionException);
    });

    it('rejects CAPTURED → AUTHORIZED (backward)', () => {
      expect(() =>
        svc.assertCanTransition(PaymentTxStatus.CAPTURED, PaymentTxStatus.AUTHORIZED),
      ).toThrow(InvalidPaymentTransitionException);
    });

    it('InvalidPaymentTransitionException carries from/to/transactionId', () => {
      let caught: InvalidPaymentTransitionException;
      try {
        svc.assertCanTransition(
          PaymentTxStatus.CAPTURED,
          PaymentTxStatus.PENDING,
          'tx_456',
        );
      } catch (e) {
        caught = e as InvalidPaymentTransitionException;
      }
      expect(caught).toBeInstanceOf(InvalidPaymentTransitionException);
      expect(caught.fromStatus).toBe(PaymentTxStatus.CAPTURED);
      expect(caught.toStatus).toBe(PaymentTxStatus.PENDING);
      expect(caught.transactionId).toBe('tx_456');
      expect(caught.code).toBe('INVALID_PAYMENT_TRANSITION');
    });
  });

  // -------------------------------------------------------------------------
  // validateTransition (non-throwing variant)
  // -------------------------------------------------------------------------

  describe('validateTransition', () => {
    it('returns { valid: true } for a valid transition', () => {
      const result = svc.validateTransition(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.GATEWAY_CREATED,
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns { valid: false, reason } for an invalid transition', () => {
      const result = svc.validateTransition(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.CAPTURED,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/PENDING/);
      expect(result.reason).toMatch(/CAPTURED/);
    });

    it('returns { valid: false, reason } when from is terminal', () => {
      const result = svc.validateTransition(
        PaymentTxStatus.REFUNDED,
        PaymentTxStatus.PENDING,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/terminal/i);
      expect(result.reason).toMatch(/REFUNDED/);
    });

    it('includes allowed transitions in reason for non-terminal invalid', () => {
      const result = svc.validateTransition(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.REFUNDED,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/GATEWAY_CREATED/);
    });
  });

  // -------------------------------------------------------------------------
  // Helper: isTerminal
  // -------------------------------------------------------------------------

  describe('isTerminal', () => {
    it.each([
      [PaymentTxStatus.FAILED,    true],
      [PaymentTxStatus.CANCELLED, true],
      [PaymentTxStatus.EXPIRED,   true],
      [PaymentTxStatus.REFUNDED,  true],
      [PaymentTxStatus.PENDING,            false],
      [PaymentTxStatus.GATEWAY_CREATED,    false],
      [PaymentTxStatus.AUTHORIZED,         false],
      [PaymentTxStatus.CAPTURED,           false],
      [PaymentTxStatus.PARTIALLY_REFUNDED, false],
    ])('%s → isTerminal = %s', (status, expected) => {
      expect(svc.isTerminal(status)).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // Helper: getAllowedTransitions
  // -------------------------------------------------------------------------

  describe('getAllowedTransitions', () => {
    it('PENDING allows GATEWAY_CREATED, FAILED, CANCELLED', () => {
      const allowed = svc.getAllowedTransitions(PaymentTxStatus.PENDING);
      expect(allowed).toContain(PaymentTxStatus.GATEWAY_CREATED);
      expect(allowed).toContain(PaymentTxStatus.FAILED);
      expect(allowed).toContain(PaymentTxStatus.CANCELLED);
      expect(allowed).toHaveLength(3);
    });

    it('GATEWAY_CREATED allows 5 transitions', () => {
      const allowed = svc.getAllowedTransitions(PaymentTxStatus.GATEWAY_CREATED);
      expect(allowed).toHaveLength(5);
      expect(allowed).toContain(PaymentTxStatus.AUTHORIZED);
      expect(allowed).toContain(PaymentTxStatus.CAPTURED);
      expect(allowed).toContain(PaymentTxStatus.FAILED);
      expect(allowed).toContain(PaymentTxStatus.CANCELLED);
      expect(allowed).toContain(PaymentTxStatus.EXPIRED);
    });

    it('AUTHORIZED allows CAPTURED, FAILED, CANCELLED', () => {
      const allowed = svc.getAllowedTransitions(PaymentTxStatus.AUTHORIZED);
      expect(allowed).toHaveLength(3);
      expect(allowed).toContain(PaymentTxStatus.CAPTURED);
      expect(allowed).toContain(PaymentTxStatus.FAILED);
      expect(allowed).toContain(PaymentTxStatus.CANCELLED);
    });

    it('CAPTURED allows REFUNDED and PARTIALLY_REFUNDED', () => {
      const allowed = svc.getAllowedTransitions(PaymentTxStatus.CAPTURED);
      expect(allowed).toHaveLength(2);
      expect(allowed).toContain(PaymentTxStatus.REFUNDED);
      expect(allowed).toContain(PaymentTxStatus.PARTIALLY_REFUNDED);
    });

    it('PARTIALLY_REFUNDED allows only REFUNDED', () => {
      const allowed = svc.getAllowedTransitions(PaymentTxStatus.PARTIALLY_REFUNDED);
      expect(allowed).toHaveLength(1);
      expect(allowed).toContain(PaymentTxStatus.REFUNDED);
    });

    it.each(Array.from(TERMINAL_STATES))(
      '%s (terminal) allows no transitions',
      (terminalStatus) => {
        expect(svc.getAllowedTransitions(terminalStatus)).toHaveLength(0);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Exception hierarchy
  // -------------------------------------------------------------------------

  describe('exception hierarchy', () => {
    it('InvalidPaymentTransitionException extends PaymentException (Error)', () => {
      const ex = new InvalidPaymentTransitionException(
        PaymentTxStatus.PENDING,
        PaymentTxStatus.REFUNDED,
      );
      expect(ex).toBeInstanceOf(Error);
      expect(ex.name).toBe('InvalidPaymentTransitionException');
    });

    it('PaymentInTerminalStateException extends PaymentException (Error)', () => {
      const ex = new PaymentInTerminalStateException('tx_1', PaymentTxStatus.FAILED);
      expect(ex).toBeInstanceOf(Error);
      expect(ex.name).toBe('PaymentInTerminalStateException');
    });
  });
});
