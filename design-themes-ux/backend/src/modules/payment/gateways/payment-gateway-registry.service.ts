import { Injectable } from '@nestjs/common';

import {
  DuplicateGatewayRegistrationException,
  GatewayCapabilityException,
  UnsupportedGatewayException,
} from '../exceptions/payment.exceptions';
import { GatewayCapability } from '../types/payment.types';
import { GatewayCapabilities, PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PaymentGatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  /**
   * Registers a gateway implementation.
   * Throws DuplicateGatewayRegistrationException if the code is already registered.
   * Called during module initialization by each concrete gateway provider.
   */
  register(gateway: PaymentGateway): void {
    const code = gateway.capabilities.gatewayCode;
    if (this.gateways.has(code)) {
      throw new DuplicateGatewayRegistrationException(code);
    }
    this.gateways.set(code, gateway);
  }

  /**
   * Returns the gateway for the given code.
   * Throws UnsupportedGatewayException if not registered.
   */
  resolve(gatewayCode: string): PaymentGateway {
    const gateway = this.gateways.get(gatewayCode);
    if (!gateway) {
      throw new UnsupportedGatewayException(gatewayCode);
    }
    return gateway;
  }

  /**
   * Returns the capability declaration for the given gateway code.
   * Throws UnsupportedGatewayException if not registered.
   */
  getCapabilities(gatewayCode: string): GatewayCapabilities {
    return this.resolve(gatewayCode).capabilities;
  }

  /**
   * Asserts that the gateway supports the given capability.
   * Throws GatewayCapabilityException if the capability is absent.
   */
  assertCapability(gatewayCode: string, capability: GatewayCapability): void {
    const caps = this.getCapabilities(gatewayCode);
    if (!caps.supports.has(capability)) {
      throw new GatewayCapabilityException(gatewayCode, capability);
    }
  }

  /** Returns the list of all registered gateway codes. */
  listRegistered(): string[] {
    return Array.from(this.gateways.keys());
  }

  isRegistered(gatewayCode: string): boolean {
    return this.gateways.has(gatewayCode);
  }
}
