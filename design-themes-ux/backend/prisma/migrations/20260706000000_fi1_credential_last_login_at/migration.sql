-- FI-1 IM-4: track last successful customer login.
-- Additive, nullable — no backfill needed.
ALTER TABLE `customer_credentials` ADD COLUMN `lastLoginAt` DATETIME(3) NULL;
