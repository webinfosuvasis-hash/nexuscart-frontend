-- Vendor order-email delivery records (one row per order × vendor).
-- Additive only: one new table + FK to orders (cascade). No existing table changes.
-- Delivery itself is scheduled through the existing outbox_events table
-- (eventType 'VENDOR_ORDER_EMAIL'), so no new worker or queue is introduced.

-- CreateTable
CREATE TABLE `vendor_order_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'RETRYING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(500) NULL,
    `nextRetryAt` DATETIME(3) NULL,
    `messageId` VARCHAR(255) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendor_order_notifications_storeId_status_idx`(`storeId`, `status`),
    INDEX `vendor_order_notifications_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `vendor_order_notifications_orderId_vendorId_key`(`orderId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendor_order_notifications` ADD CONSTRAINT `vendor_order_notifications_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

