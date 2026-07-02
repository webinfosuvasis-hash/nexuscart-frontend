import {
  DuplicateGatewayRegistrationException,
  GatewayCapabilityException,
  UnsupportedGatewayException,
} from '../exceptions/payment.exceptions';
import { GatewayCapability } from '../types/payment.types';
import { GatewayCapabilities, PaymentGateway } from './payment-gateway.interface';
import { PaymentGatewayRegistry } from './payment-gateway-registry.service';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function makeGateway(
  gatewayCode: string,
  supports: GatewayCapability[] = [],
): PaymentGateway {
  const capabilities: GatewayCapabilities = {
    gatewayCode,
    displayName: `${gatewayCode} Gateway`,
    supports: new Set(supports),
    isLiveCapable: false,
    requiresWebhook: false,
  };

  return {
    capabilities,
    initiatePayment: jest.fn(),
    capturePayment: jest.fn(),
    refundPayment: jest.fn(),
    verifyPayment: jest.fn(),
    cancelPayment: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentGatewayRegistry', () => {
  let registry: PaymentGatewayRegistry;

  beforeEach(() => {
    registry = new PaymentGatewayRegistry();
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register', () => {
    it('registers a gateway successfully', () => {
      const gw = makeGateway('razorpay');
      expect(() => registry.register(gw)).not.toThrow();
      expect(registry.isRegistered('razorpay')).toBe(true);
    });

    it('registers multiple different gateways', () => {
      registry.register(makeGateway('razorpay'));
      registry.register(makeGateway('stripe'));
      registry.register(makeGateway('cod'));
      expect(registry.listRegistered()).toHaveLength(3);
    });

    it('throws DuplicateGatewayRegistrationException on duplicate code', () => {
      registry.register(makeGateway('razorpay'));
      expect(() => registry.register(makeGateway('razorpay'))).toThrow(
        DuplicateGatewayRegistrationException,
      );
    });

    it('DuplicateGatewayRegistrationException carries gatewayCode', () => {
      registry.register(makeGateway('stripe'));
      let caught: DuplicateGatewayRegistrationException;
      try {
        registry.register(makeGateway('stripe'));
      } catch (e) {
        caught = e as DuplicateGatewayRegistrationException;
      }
      expect(caught.gatewayCode).toBe('stripe');
      expect(caught.code).toBe('DUPLICATE_GATEWAY_REGISTRATION');
    });
  });

  // -------------------------------------------------------------------------
  // resolve
  // -------------------------------------------------------------------------

  describe('resolve', () => {
    it('returns the registered gateway instance', () => {
      const gw = makeGateway('razorpay');
      registry.register(gw);
      expect(registry.resolve('razorpay')).toBe(gw);
    });

    it('throws UnsupportedGatewayException for unknown gateway', () => {
      expect(() => registry.resolve('unknown_gw')).toThrow(
        UnsupportedGatewayException,
      );
    });

    it('UnsupportedGatewayException carries gatewayCode', () => {
      let caught: UnsupportedGatewayException;
      try {
        registry.resolve('phonepe');
      } catch (e) {
        caught = e as UnsupportedGatewayException;
      }
      expect(caught.gatewayCode).toBe('phonepe');
      expect(caught.code).toBe('UNSUPPORTED_GATEWAY');
    });
  });

  // -------------------------------------------------------------------------
  // getCapabilities
  // -------------------------------------------------------------------------

  describe('getCapabilities', () => {
    it('returns capabilities of registered gateway', () => {
      const gw = makeGateway('stripe', [GatewayCapability.INTENT_BASED, GatewayCapability.REFUND]);
      registry.register(gw);
      const caps = registry.getCapabilities('stripe');
      expect(caps.gatewayCode).toBe('stripe');
      expect(caps.supports.has(GatewayCapability.INTENT_BASED)).toBe(true);
      expect(caps.supports.has(GatewayCapability.REFUND)).toBe(true);
      expect(caps.supports.has(GatewayCapability.ORDER_BASED)).toBe(false);
    });

    it('throws UnsupportedGatewayException for unknown gateway', () => {
      expect(() => registry.getCapabilities('unknown')).toThrow(
        UnsupportedGatewayException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertCapability
  // -------------------------------------------------------------------------

  describe('assertCapability', () => {
    it('does not throw when gateway supports the capability', () => {
      registry.register(
        makeGateway('razorpay', [
          GatewayCapability.ORDER_BASED,
          GatewayCapability.AUTHORIZE_THEN_CAPTURE,
        ]),
      );
      expect(() =>
        registry.assertCapability('razorpay', GatewayCapability.AUTHORIZE_THEN_CAPTURE),
      ).not.toThrow();
    });

    it('throws GatewayCapabilityException when capability is absent', () => {
      registry.register(makeGateway('cod', [GatewayCapability.DIRECT_CAPTURE]));
      expect(() =>
        registry.assertCapability('cod', GatewayCapability.REFUND),
      ).toThrow(GatewayCapabilityException);
    });

    it('GatewayCapabilityException carries gatewayCode and capability', () => {
      registry.register(makeGateway('cod', [GatewayCapability.DIRECT_CAPTURE]));
      let caught: GatewayCapabilityException;
      try {
        registry.assertCapability('cod', GatewayCapability.PARTIAL_REFUND);
      } catch (e) {
        caught = e as GatewayCapabilityException;
      }
      expect(caught.gatewayCode).toBe('cod');
      expect(caught.capability).toBe(GatewayCapability.PARTIAL_REFUND);
      expect(caught.code).toBe('GATEWAY_CAPABILITY_NOT_SUPPORTED');
    });

    it('throws UnsupportedGatewayException when gateway is not registered', () => {
      expect(() =>
        registry.assertCapability('ghost_gateway', GatewayCapability.REFUND),
      ).toThrow(UnsupportedGatewayException);
    });
  });

  // -------------------------------------------------------------------------
  // listRegistered / isRegistered
  // -------------------------------------------------------------------------

  describe('listRegistered', () => {
    it('returns empty array when no gateways registered', () => {
      expect(registry.listRegistered()).toEqual([]);
    });

    it('returns codes in registration order', () => {
      registry.register(makeGateway('cod'));
      registry.register(makeGateway('razorpay'));
      registry.register(makeGateway('stripe'));
      expect(registry.listRegistered()).toEqual(['cod', 'razorpay', 'stripe']);
    });
  });

  describe('isRegistered', () => {
    it('returns false for unregistered gateway', () => {
      expect(registry.isRegistered('razorpay')).toBe(false);
    });

    it('returns true after registration', () => {
      registry.register(makeGateway('razorpay'));
      expect(registry.isRegistered('razorpay')).toBe(true);
    });

    it('returns false for different gateway code', () => {
      registry.register(makeGateway('razorpay'));
      expect(registry.isRegistered('stripe')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Exception hierarchy
  // -------------------------------------------------------------------------

  describe('exception hierarchy', () => {
    it('UnsupportedGatewayException extends Error', () => {
      const ex = new UnsupportedGatewayException('unknown');
      expect(ex).toBeInstanceOf(Error);
      expect(ex.name).toBe('UnsupportedGatewayException');
    });

    it('DuplicateGatewayRegistrationException extends Error', () => {
      const ex = new DuplicateGatewayRegistrationException('razorpay');
      expect(ex).toBeInstanceOf(Error);
      expect(ex.name).toBe('DuplicateGatewayRegistrationException');
    });

    it('GatewayCapabilityException extends Error', () => {
      const ex = new GatewayCapabilityException('cod', GatewayCapability.REFUND);
      expect(ex).toBeInstanceOf(Error);
      expect(ex.name).toBe('GatewayCapabilityException');
    });
  });
});
