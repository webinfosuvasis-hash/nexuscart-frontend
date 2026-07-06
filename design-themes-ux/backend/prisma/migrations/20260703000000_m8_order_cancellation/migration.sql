-- Milestone 8: Order Cancellation — add cancellation fields to orders table
-- AlterTable
ALTER TABLE `orders`
    ADD COLUMN `cancelled_at`        DATETIME(3)  NULL,
    ADD COLUMN `cancellation_reason` LONGTEXT     NULL;
