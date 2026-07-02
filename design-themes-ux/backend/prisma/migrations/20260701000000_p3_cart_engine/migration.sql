-- Phase P3: Cart Engine — carts, cart_items, cart_activities
--
-- Down migration (reversible):
--   DROP TABLE IF EXISTS `cart_activities`;
--   DROP TABLE IF EXISTS `cart_items`;
--   DROP TABLE IF EXISTS `carts`;

-- CreateTable
CREATE TABLE `carts` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE','LOCKED','MERGED','ABANDONED','EXPIRED','CONVERTED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 1,
    `currencyCode` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `exchangeRate` DECIMAL(15, 6) NULL,
    `locale` VARCHAR(191) NOT NULL DEFAULT 'en-IN',
    `couponCode` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedUntil` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `abandonedAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `checkoutStartedAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `mergedIntoCartId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `carts_storeId_sessionId_idx`(`storeId`, `sessionId`),
    INDEX `carts_storeId_status_idx`(`storeId`, `status`),
    INDEX `carts_status_lastActivityAt_idx`(`status`, `lastActivityAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `variantId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `seoUrl` VARCHAR(191) NULL,
    `image` VARCHAR(1000) NOT NULL,
    `unitPrice` DECIMAL(15, 4) NOT NULL,
    `comparePrice` DECIMAL(15, 4) NULL,
    `taxCategory` VARCHAR(191) NULL,
    `hsn` VARCHAR(191) NULL,
    `gstClass` VARCHAR(191) NULL,
    `weight` DECIMAL(8, 2) NULL,
    `dimensions` TEXT NULL,
    `variantOptions` TEXT NULL,
    `warehouseId` VARCHAR(191) NULL,
    `inventorySource` ENUM('PRODUCT','VARIANT','WAREHOUSE','VIRTUAL') NOT NULL DEFAULT 'PRODUCT',
    `appliedPromotions` LONGTEXT NULL,
    `lineDiscount` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cart_items_cartId_idx`(`cartId`),
    INDEX `cart_items_storeId_productId_idx`(`storeId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_activities` (
    `id` VARCHAR(191) NOT NULL,
    `cartId` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `activityType` ENUM('CART_CREATED','ITEM_ADDED','ITEM_REMOVED','QTY_UPDATED','QTY_ADJUSTED','PROMOTION_APPLIED','PROMOTION_REMOVED','CART_CLEARED','CART_MERGED','CART_LOCKED','CART_UNLOCKED','CART_ABANDONED','CART_EXPIRED','CART_ARCHIVED','CHECKOUT_STARTED','CHECKOUT_COMPLETED','CHECKOUT_FAILED','CART_VALIDATED') NOT NULL,
    `actorType` ENUM('CUSTOMER','SYSTEM','ADMIN') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `payload` JSON NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `traceId` VARCHAR(32) NULL,
    `spanId` VARCHAR(16) NULL,
    `correlationId` VARCHAR(191) NULL,
    `requestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cart_activities_cartId_idx`(`cartId`),
    INDEX `cart_activities_storeId_activityType_createdAt_idx`(`storeId`, `activityType`, `createdAt`),
    INDEX `cart_activities_traceId_idx`(`traceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_activities` ADD CONSTRAINT `cart_activities_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
