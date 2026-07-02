import { Injectable } from '@nestjs/common';
import { PaymentTxStatus } from '@prisma/client';

import {
  canTransition,
  getAllowedTransitions,
  isTerminal,
} from './payment-state-transitions';
import {
  InvalidPaymentTransitionException,
  PaymentInTerminalStateException,
} from '../exceptions/payment.exceptions';

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

@Injectable()
export class PaymentStateValidatorService {
  /**
   * Asserts that the from→to transition is allowed.
   * Throws PaymentInTerminalStateException if `from` is terminal.
   * Throws InvalidPaymentTransitionException if the transition is not in the table.
   * Forward-Only State Rule: the transition table itself is one-directional,
   * so any backward transition fails as an invalid transition.
   */
  assertCanTransition(
    from: PaymentTxStatus,
    to: PaymentTxStatus,
    transactionId?: string,
  ): void {
    if (isTerminal(from)) {
      throw new PaymentInTerminalStateException(transactionId ?? 'unknown', from);
    }
    if (!canTransition(from, to)) {
      throw new InvalidPaymentTransitionException(from, to, transactionId);
    }
  }

  /**
   * Non-throwing variant for pre-flight checks.
   * Returns { valid: true } or { valid: false, reason } without throwing.
   */
  validateTransition(
    from: PaymentTxStatus,
    to: PaymentTxStatus,
  ): TransitionValidationResult {
    if (isTerminal(from)) {
      return {
        valid: false,
        reason: `Status ${from} is terminal; no further transitions are allowed`,
      };
    }
    if (!canTransition(from, to)) {
      const allowed = getAllowedTransitions(from);
      const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none';
      return {
        valid: false,
        reason: `Cannot transition from ${from} to ${to}. Allowed: [${allowedStr}]`,
      };
    }
    return { valid: true };
  }

  isTerminal(status: PaymentTxStatus): boolean {
    return isTerminal(status);
  }

  getAllowedTransitions(from: PaymentTxStatus): PaymentTxStatus[] {
    return getAllowedTransitions(from);
  }
}
