import { ConfigService } from '@nestjs/config';

import { CodPaymentGateway } from './cod/cod-payment.gateway';
import { MockPaymentGateway } from './mock/mock-payment.gateway';
import { PaymentGatewayRegistry } from './payment-gateway-registry.service';
import { DuplicateGatewayRegistrationException, UnsupportedGatewayException } from '../exceptions/payment.exceptions';
import { GatewayCapability } from '../types/payment.types';

function makeConfigService(behavior = 'success'): ConfigService {
  return {
    get: jest.fn((key: string, def?: any) => {
      if (key === 'payment.mock.behavior') return behavior;
      if (key === 'payment.mock.delayMs')  return 0;
      return def;
    }),
  } as any;
}

describe('Gateway registry integration (Mock + COD)', () => {
  let registry: PaymentGatewayRegistry;
  let mockGw: MockPaymentGateway;
  let codGw: CodPaymentGateway;

  beforeEach(() => {
    registry = new PaymentGatewayRegistry();
    mockGw   = new MockPaymentGateway(makeConfigService());
    codGw    = new CodPaymentGateway();

    registry.register(mockGw);
    registry.register(codGw);
  });

  it('lists both registered gateways', () => {
    expect(registry.listRegistered()).toEqual(expect.arrayContaining(['mock', 'cod']));
    expect(registry.listRegistered()).toHaveLength(2);
  });

  it('resolves mock gateway', () => {
    expect(registry.resolve('mock')).toBe(mockGw);
  });

  it('resolves cod gateway', () => {
    expect(registry.resolve('cod')).toBe(codGw);
  });

  it('prevents duplicate registration', () => {
    expect(() => registry.register(new CodPaymentGateway())).toThrow(
      DuplicateGatewayRegistrationException,
    );
  });

  it('throws UnsupportedGatewayException for unregistered gateway', () => {
    expect(() => registry.resolve('stripe')).toThrow(UnsupportedGatewayException);
  });

  it('mock gateway capability lookup: AUTHORIZE_THEN_CAPTURE present', () => {
    expect(() =>
      registry.assertCapability('mock', GatewayCapability.AUTHORIZE_THEN_CAPTURE),
    ).not.toThrow();
  });

  it('cod gateway does not support AUTHORIZE_THEN_CAPTURE', () => {
    expect(() =>
      registry.assertCapability('cod', GatewayCapability.AUTHORIZE_THEN_CAPTURE),
    ).toThrow();
  });

  it('mock is not live-capable; cod is live-capable', () => {
    expect(registry.getCapabilities('mock').isLiveCapable).toBe(false);
    expect(registry.getCapabilities('cod').isLiveCapable).toBe(true);
  });

  it('isRegistered works correctly', () => {
    expect(registry.isRegistered('mock')).toBe(true);
    expect(registry.isRegistered('cod')).toBe(true);
    expect(registry.isRegistered('razorpay')).toBe(false);
  });
});
