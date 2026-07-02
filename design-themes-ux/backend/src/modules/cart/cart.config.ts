import { registerAs } from '@nestjs/config';

export const CART_CONFIG_KEY = 'cart';

export interface CartConfig {
  lockTimeoutMinutes:  number;
  debugMode:           boolean;
  gcBatchSize:         number;
  abandonAfterHours:   number;
  expireAfterDays:     number;
  archiveAfterDays:    number;
  readThresholdMinutes: number;
}

export const cartConfig = registerAs(CART_CONFIG_KEY, (): CartConfig => ({
  lockTimeoutMinutes:   parseInt(process.env.CART_LOCK_TIMEOUT_MINUTES    ?? '15',  10),
  debugMode:            process.env.CART_DEBUG === 'true' && process.env.NODE_ENV !== 'production',
  gcBatchSize:          parseInt(process.env.CART_GC_BATCH_SIZE           ?? '500', 10),
  abandonAfterHours:    parseInt(process.env.CART_ABANDON_AFTER_HOURS     ?? '24',  10),
  expireAfterDays:      parseInt(process.env.CART_EXPIRE_AFTER_DAYS       ?? '30',  10),
  archiveAfterDays:     parseInt(process.env.CART_ARCHIVE_AFTER_DAYS      ?? '60',  10),
  readThresholdMinutes: parseInt(process.env.CART_READ_THRESHOLD_MINUTES  ?? '5',   10),
}));
