import { registerAs } from '@nestjs/config';

export const CHECKOUT_CONFIG_KEY = 'checkout';

export interface CheckoutConfig {
  sessionTimeoutMinutes:  number;
  debugMode:              boolean;
  defaultCurrency:        string;
  storeStateCode:         string;
  freeShippingThreshold:  number;
}

export const checkoutConfig = registerAs(CHECKOUT_CONFIG_KEY, (): CheckoutConfig => ({
  sessionTimeoutMinutes: parseInt(process.env.CHECKOUT_SESSION_TIMEOUT_MINUTES ?? '30',  10),
  debugMode:             process.env.CHECKOUT_DEBUG === 'true' && process.env.NODE_ENV !== 'production',
  defaultCurrency:       process.env.CHECKOUT_DEFAULT_CURRENCY ?? 'INR',
  storeStateCode:        process.env.STORE_STATE_CODE ?? 'KA',
  freeShippingThreshold: parseInt(process.env.CHECKOUT_FREE_SHIPPING_THRESHOLD ?? '999', 10),
}));
