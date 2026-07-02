import { registerAs } from '@nestjs/config';

export type MockBehavior = 'success' | 'authorize_capture' | 'fail' | 'timeout';

export const paymentConfig = registerAs('payment', () => ({
  enabled: process.env.PAYMENT_ENABLED === 'true',

  razorpay: {
    keyId:         process.env.RAZORPAY_KEY_ID         ?? '',
    keySecret:     process.env.RAZORPAY_KEY_SECRET      ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET  ?? '',
  },

  stripe: {
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },

  mock: {
    behavior:  (process.env.MOCK_PAYMENT_BEHAVIOR ?? 'success') as MockBehavior,
    delayMs:   parseInt(process.env.MOCK_PAYMENT_DELAY_MS ?? '0', 10),
  },
}));
