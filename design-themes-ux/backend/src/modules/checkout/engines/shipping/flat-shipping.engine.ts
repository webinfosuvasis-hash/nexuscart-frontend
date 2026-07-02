import { Injectable } from '@nestjs/common';
import {
  ICheckoutShippingEngine,
  CheckoutShippingInput,
  CheckoutShippingMethod,
  CheckoutShippingResult,
} from './checkout-shipping.interface';

const METHODS: Omit<CheckoutShippingMethod, 'isFree' | 'cost'>[] = [
  { id: 'standard', name: 'Standard Delivery', description: 'Delivered in 5–7 business days', estimatedDays: '5–7 days' },
  { id: 'express',  name: 'Express Delivery',  description: 'Delivered in 2–3 business days', estimatedDays: '2–3 days' },
  { id: 'same_day', name: 'Same Day Delivery', description: 'Order before 12 PM for same-day delivery', estimatedDays: 'Today' },
];

const BASE_COSTS: Record<string, number> = {
  standard: 99,
  express:  199,
  same_day: 299,
};

@Injectable()
export class FlatShippingEngine implements ICheckoutShippingEngine {
  async listMethods(
    _storeId: string,
    input:    CheckoutShippingInput,
  ): Promise<CheckoutShippingResult> {
    const qualified  = input.subtotal >= input.freeShippingThreshold;
    const methods    = METHODS.map((m) => this.buildMethod(m.id, input.subtotal, input.freeShippingThreshold));

    return { available: true, methods, selectedMethodId: 'standard' };
  }

  async calculate(
    _storeId: string,
    methodId: string,
    input:    CheckoutShippingInput,
  ): Promise<CheckoutShippingMethod | null> {
    const def = METHODS.find((m) => m.id === methodId);
    if (!def) return null;
    return this.buildMethod(methodId, input.subtotal, input.freeShippingThreshold);
  }

  async estimate(
    _storeId: string,
    input:    CheckoutShippingInput,
  ): Promise<CheckoutShippingMethod> {
    return this.buildMethod('standard', input.subtotal, input.freeShippingThreshold);
  }

  private buildMethod(
    id:                    string,
    subtotal:              number,
    freeShippingThreshold: number,
  ): CheckoutShippingMethod {
    const def       = METHODS.find((m) => m.id === id) ?? METHODS[0]!;
    const baseCoast = BASE_COSTS[id] ?? 99;
    const isFree    = id === 'standard' && subtotal >= freeShippingThreshold;
    const cost      = isFree ? 0 : baseCoast;

    return { ...def, cost, isFree };
  }
}
