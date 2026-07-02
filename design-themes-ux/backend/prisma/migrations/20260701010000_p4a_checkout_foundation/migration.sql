-- Phase P4A: Checkout Foundation
--
-- Changes:
--   1. Add ARCHIVED to CartStatus enum (fixes P3B cart-lifecycle.service bug)
--   2. Create checkout_sessions, checkout_address_snapshots, checkout_activities
--   3. Add CheckoutStatus, AddressType, CheckoutActivityType, CheckoutActorType enums
--
-- Down migration (reversible):
--   DROP TABLE IF EXISTS `checkout_activities`;
--   DROP TABLE IF EXISTS `checkout_address_snapshots`;
--   DROP TABLE IF EXISTS `checkout_sessions`;
--   ALTER TABLE `carts` MODIFY `status` ENUM('ACTIVE','LOCKED','MERGED','ABANDONED','EXPIRED','CONVERTED') NOT NULL DEFAULT 'ACTIVE';

-- AlterEnum: add ARCHIVED to CartStatus
ALTER TABLE `carts`
  MODIFY `status` ENUM('ACTIVE','LOCKED','MERGED','ABANDONED','EXPIRED','ARCHIVED','CONVERTED') NOT NULL DEFAULT 'ACTIVE';

-- CreateTable: checkout_sessions
CREATE TABLE `checkout_sessions` (
    `id`                       VARCHAR(191) NOT NULL,
    `storeId`                  VARCHAR(191) NOT NULL,
    `cartId`                   VARCHAR(191) NOT NULL,
    `cartVersion`              INTEGER NOT NULL,
    `sessionId`                VARCHAR(191) NOT NULL,
    `customerId`               VARCHAR(191) NULL,
    `status`                   ENUM('PENDING','ADDRESS_ADDED','SHIPPING_SELECTED','VALIDATED','COMPLETED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
    `selectedShippingMethodId` VARCHAR(191) NULL,
    `isValid`                  BOOLEAN NOT NULL DEFAULT false,
    `validatedAt`              DATETIME(3) NULL,
    `expiresAt`                DATETIME(3) NOT NULL,
    `cancelledAt`              DATETIME(3) NULL,
    `completedAt`              DATETIME(3) NULL,
    `traceId`                  VARCHAR(32) NULL,
    `spanId`                   VARCHAR(16) NULL,
    `correlationId`            VARCHAR(191) NULL,
    `requestId`                VARCHAR(191) NULL,
    `ipAddress`                VARCHAR(45) NULL,
    `userAgent`                VARCHAR(500) NULL,
    `createdAt`                DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`                DATETIME(3) NOT NULL,

    INDEX `checkout_sessions_storeId_cartId_idx`(`storeId`, `cartId`),
    INDEX `checkout_sessions_storeId_sessionId_idx`(`storeId`, `sessionId`),
    INDEX `checkout_sessions_storeId_status_idx`(`storeId`, `status`),
    INDEX `checkout_sessions_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: checkout_address_snapshots
CREATE TABLE `checkout_address_snapshots` (
    `id`              VARCHAR(191) NOT NULL,
    `checkoutId`      VARCHAR(191) NOT NULL,
    `type`            ENUM('SHIPPING','BILLING') NOT NULL,
    `firstName`       VARCHAR(100) NOT NULL,
    `lastName`        VARCHAR(100) NOT NULL,
    `line1`           VARCHAR(255) NOT NULL,
    `line2`           VARCHAR(255) NULL,
    `city`            VARCHAR(100) NOT NULL,
    `state`           VARCHAR(100) NOT NULL,
    `postalCode`      VARCHAR(20) NOT NULL,
    `country`         VARCHAR(5) NOT NULL DEFAULT 'IN',
    `phone`           VARCHAR(20) NOT NULL,
    `email`           VARCHAR(255) NULL,
    `isGuestAddress`  BOOLEAN NOT NULL DEFAULT false,
    `sourceAddressId` VARCHAR(191) NULL,
    `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`       DATETIME(3) NOT NULL,

    INDEX `checkout_address_snapshots_checkoutId_type_idx`(`checkoutId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: checkout_activities
CREATE TABLE `checkout_activities` (
    `id`            VARCHAR(191) NOT NULL,
    `checkoutId`    VARCHAR(191) NOT NULL,
    `storeId`       VARCHAR(191) NOT NULL,
    `sessionId`     VARCHAR(191) NOT NULL,
    `customerId`    VARCHAR(191) NULL,
    `activityType`  ENUM('CHECKOUT_STARTED','ADDRESS_UPDATED','SHIPPING_UPDATED','VALIDATION_PASSED','VALIDATION_FAILED','CHECKOUT_CANCELLED','CHECKOUT_COMPLETED','CHECKOUT_EXPIRED') NOT NULL,
    `actorType`     ENUM('CUSTOMER','SYSTEM','ADMIN') NOT NULL,
    `actorId`       VARCHAR(191) NULL,
    `payload`       JSON NOT NULL,
    `ipAddress`     VARCHAR(45) NULL,
    `userAgent`     VARCHAR(500) NULL,
    `traceId`       VARCHAR(32) NULL,
    `spanId`        VARCHAR(16) NULL,
    `correlationId` VARCHAR(191) NULL,
    `requestId`     VARCHAR(191) NULL,
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `checkout_activities_checkoutId_idx`(`checkoutId`),
    INDEX `checkout_activities_storeId_activityType_createdAt_idx`(`storeId`, `activityType`, `createdAt`),
    INDEX `checkout_activities_traceId_idx`(`traceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: checkout_address_snapshots → checkout_sessions
ALTER TABLE `checkout_address_snapshots`
  ADD CONSTRAINT `checkout_address_snapshots_checkoutId_fkey`
  FOREIGN KEY (`checkoutId`) REFERENCES `checkout_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: checkout_activities → checkout_sessions
ALTER TABLE `checkout_activities`
  ADD CONSTRAINT `checkout_activities_checkoutId_fkey`
  FOREIGN KEY (`checkoutId`) REFERENCES `checkout_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
