-- Phase P4B: Payment Foundation + Order Creation
--
-- Changes:
--   1.  orders — drop global orderNumber unique, add @@unique([storeId, orderNumber]) + @@index([orderNumber])
--   2.  orders — add checkoutSessionId, paymentTransactionId, paymentGatewayCode, confirmedAt
--   3.  order_items — add snapshot columns (brandName, brandSlug, thumbnail, variantOptions,
--                     comparePrice, lineDiscount, taxRate, taxAmount, taxClass, hsn)
--   4.  checkout_sessions — add paymentInitiatedAt, extend status enum with PAYMENT_INITIATED
--   5.  refunds — add paymentTransactionId, gatewayRefundId, amountInPaise
--   6.  orders.paymentStatus enum — add AUTHORIZED, CAPTURED, CANCELLED, PARTIALLY_REFUNDED
--   7.  Create 14 new tables: store_payment_configs, store_payment_methods, payment_transactions,
--       payment_activities, payment_refunds, inventory_levels, inventory_reservations,
--       inventory_reservation_items, store_order_counters, order_snapshots, outbox_events,
--       webhook_logs, idempotency_records, shipment_items
--   8.  Data migration — seed inventory_levels from products + product_variants
--   9.  Data migration — seed store_payment_configs + store_payment_methods (COD default)
--
-- Down migration (reversible):
--   -- Remove new tables
--   DROP TABLE IF EXISTS `shipment_items`;
--   DROP TABLE IF EXISTS `idempotency_records`;
--   DROP TABLE IF EXISTS `webhook_logs`;
--   DROP TABLE IF EXISTS `outbox_events`;
--   DROP TABLE IF EXISTS `order_snapshots`;
--   DROP TABLE IF EXISTS `store_order_counters`;
--   DROP TABLE IF EXISTS `inventory_reservation_items`;
--   DROP TABLE IF EXISTS `inventory_reservations`;
--   DROP TABLE IF EXISTS `inventory_levels`;
--   DROP TABLE IF EXISTS `payment_refunds`;
--   DROP TABLE IF EXISTS `payment_activities`;
--   DROP TABLE IF EXISTS `payment_transactions`;
--   DROP TABLE IF EXISTS `store_payment_methods`;
--   DROP TABLE IF EXISTS `store_payment_configs`;
--   -- Restore orders constraint
--   ALTER TABLE `orders` DROP INDEX `orders_storeId_orderNumber_key`;
--   ALTER TABLE `orders` DROP INDEX `orders_orderNumber_idx`;
--   ALTER TABLE `orders` ADD UNIQUE INDEX `orders_orderNumber_key` (`orderNumber`);
--   ALTER TABLE `orders` DROP COLUMN `checkoutSessionId`, DROP COLUMN `paymentTransactionId`,
--     DROP COLUMN `paymentGatewayCode`, DROP COLUMN `confirmedAt`;
--   -- Restore order_items columns
--   ALTER TABLE `order_items` DROP COLUMN `brandName`, DROP COLUMN `brandSlug`,
--     DROP COLUMN `thumbnail`, DROP COLUMN `variantOptions`, DROP COLUMN `comparePrice`,
--     DROP COLUMN `lineDiscount`, DROP COLUMN `taxRate`, DROP COLUMN `taxAmount`,
--     DROP COLUMN `taxClass`, DROP COLUMN `hsn`;
--   -- Restore checkout_sessions
--   ALTER TABLE `checkout_sessions` DROP COLUMN `paymentInitiatedAt`;
--   ALTER TABLE `checkout_sessions` MODIFY `status`
--     ENUM('PENDING','ADDRESS_ADDED','SHIPPING_SELECTED','VALIDATED','COMPLETED','CANCELLED','EXPIRED')
--     NOT NULL DEFAULT 'PENDING';
--   -- Restore refunds
--   ALTER TABLE `refunds` DROP COLUMN `paymentTransactionId`, DROP COLUMN `gatewayRefundId`,
--     DROP COLUMN `amountInPaise`;
--   -- Restore enums
--   ALTER TABLE `orders` MODIFY `paymentStatus`
--     ENUM('PENDING','PAID','FAILED','REFUNDED','PARTIAL') NOT NULL DEFAULT 'PENDING';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. orders — Fix P0-1: Replace global @unique with per-store composite unique
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `orders` DROP INDEX `orders_orderNumber_key`;
ALTER TABLE `orders` ADD UNIQUE INDEX `orders_storeId_orderNumber_key` (`storeId`, `orderNumber`);
ALTER TABLE `orders` ADD INDEX `orders_orderNumber_idx` (`orderNumber`);

ALTER TABLE `orders`
  ADD COLUMN `checkoutSessionId`    VARCHAR(191) NULL,
  ADD COLUMN `paymentTransactionId` VARCHAR(191) NULL,
  ADD COLUMN `paymentGatewayCode`   VARCHAR(20)  NULL,
  ADD COLUMN `confirmedAt`          DATETIME(3)  NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. orders.paymentStatus — add AUTHORIZED, CAPTURED, CANCELLED, PARTIALLY_REFUNDED
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `orders`
  MODIFY `paymentStatus` ENUM('PENDING','AUTHORIZED','PAID','CAPTURED','FAILED','CANCELLED','REFUNDED','PARTIAL','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. order_items — add snapshot columns (all nullable or defaulted)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `order_items`
  ADD COLUMN `brandName`      VARCHAR(200)  NULL,
  ADD COLUMN `brandSlug`      VARCHAR(200)  NULL,
  ADD COLUMN `thumbnail`      VARCHAR(1000) NULL,
  ADD COLUMN `variantOptions` JSON          NULL,
  ADD COLUMN `comparePrice`   DECIMAL(10,2) NULL,
  ADD COLUMN `lineDiscount`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `taxRate`        DECIMAL(5,4)  NOT NULL DEFAULT 0.0000,
  ADD COLUMN `taxAmount`      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN `taxClass`       VARCHAR(20)   NULL,
  ADD COLUMN `hsn`            VARCHAR(20)   NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. checkout_sessions — add paymentInitiatedAt + extend status enum
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `checkout_sessions`
  ADD COLUMN `paymentInitiatedAt` DATETIME(3) NULL;

ALTER TABLE `checkout_sessions`
  MODIFY `status` ENUM('PENDING','ADDRESS_ADDED','SHIPPING_SELECTED','VALIDATED','PAYMENT_INITIATED','COMPLETED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. refunds — add payment cross-reference fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `refunds`
  ADD COLUMN `paymentTransactionId` VARCHAR(191) NULL,
  ADD COLUMN `gatewayRefundId`      VARCHAR(200) NULL,
  ADD COLUMN `amountInPaise`        INT          NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CreateTable: store_payment_configs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `store_payment_configs` (
    `id`             VARCHAR(191) NOT NULL,
    `storeId`        VARCHAR(191) NOT NULL,
    `defaultGateway` VARCHAR(20)  NOT NULL DEFAULT 'cod',
    `isLive`         BOOLEAN      NOT NULL DEFAULT false,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)  NOT NULL,

    UNIQUE INDEX `store_payment_configs_storeId_key`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CreateTable: store_payment_methods
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `store_payment_methods` (
    `id`             VARCHAR(191) NOT NULL,
    `storeId`        VARCHAR(191) NOT NULL,
    `configId`       VARCHAR(191) NOT NULL,
    `gatewayCode`    VARCHAR(20)  NOT NULL,
    `displayName`    VARCHAR(100) NOT NULL,
    `isActive`       BOOLEAN      NOT NULL DEFAULT true,
    `sortOrder`      INTEGER      NOT NULL DEFAULT 0,
    `credentialsEnc` TEXT         NULL,
    `credentialsIv`  VARCHAR(32)  NULL,
    `credentialsTag` VARCHAR(32)  NULL,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`      DATETIME(3)  NOT NULL,

    UNIQUE INDEX `store_payment_methods_storeId_gatewayCode_key`(`storeId`, `gatewayCode`),
    INDEX `store_payment_methods_configId_fkey`(`configId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CreateTable: payment_transactions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `payment_transactions` (
    `id`                   VARCHAR(191)  NOT NULL,
    `storeId`              VARCHAR(191)  NOT NULL,
    `checkoutSessionId`    VARCHAR(191)  NOT NULL,
    `paymentMethodId`      VARCHAR(191)  NULL,
    `gatewayCode`          VARCHAR(20)   NOT NULL,
    `status`               ENUM('PENDING','GATEWAY_CREATED','AUTHORIZED','CAPTURED','FAILED','CANCELLED','EXPIRED','REFUNDED','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
    `amountInPaise`        INTEGER       NOT NULL,
    `currency`             VARCHAR(3)    NOT NULL DEFAULT 'INR',
    `attemptNumber`        INTEGER       NOT NULL DEFAULT 1,
    `gatewayOrderId`       VARCHAR(200)  NULL,
    `gatewayPaymentId`     VARCHAR(200)  NULL,
    `gatewayIntentId`      VARCHAR(200)  NULL,
    `gatewayReferenceId`   VARCHAR(200)  NULL,
    `gatewaySignature`     VARCHAR(1000) NULL,
    `capturedPaise`        INTEGER       NULL,
    `checkoutSnapshot`     JSON          NULL,
    `orderId`              VARCHAR(191)  NULL,
    `supersededById`       VARCHAR(191)  NULL,
    `authorizedAt`         DATETIME(3)   NULL,
    `capturedAt`           DATETIME(3)   NULL,
    `failedAt`             DATETIME(3)   NULL,
    `cancelledAt`          DATETIME(3)   NULL,
    `expiredAt`            DATETIME(3)   NULL,
    `refundedAt`           DATETIME(3)   NULL,
    `retryCount`           INTEGER       NOT NULL DEFAULT 0,
    `nextRetryAt`          DATETIME(3)   NULL,
    `traceId`              VARCHAR(32)   NULL,
    `spanId`               VARCHAR(16)   NULL,
    `correlationId`        VARCHAR(191)  NULL,
    `requestId`            VARCHAR(191)  NULL,
    `createdAt`            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3)   NOT NULL,

    UNIQUE INDEX `payment_transactions_supersededById_key`(`supersededById`),
    INDEX `payment_transactions_storeId_status_idx`(`storeId`, `status`),
    INDEX `payment_transactions_storeId_checkoutSessionId_idx`(`storeId`, `checkoutSessionId`),
    INDEX `payment_transactions_gatewayOrderId_idx`(`gatewayOrderId`),
    INDEX `payment_transactions_gatewayIntentId_idx`(`gatewayIntentId`),
    INDEX `payment_transactions_status_capturedAt_idx`(`status`, `capturedAt`),
    INDEX `payment_transactions_status_authorizedAt_idx`(`status`, `authorizedAt`),
    INDEX `payment_transactions_checkoutSessionId_fkey`(`checkoutSessionId`),
    INDEX `payment_transactions_paymentMethodId_fkey`(`paymentMethodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CreateTable: payment_activities
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `payment_activities` (
    `id`                   VARCHAR(191) NOT NULL,
    `paymentTransactionId` VARCHAR(191) NOT NULL,
    `storeId`              VARCHAR(191) NOT NULL,
    `activityType`         ENUM('PAYMENT_INITIATED','GATEWAY_ORDER_CREATED','SIGNATURE_VERIFIED','SIGNATURE_FAILED','PAYMENT_AUTHORIZED','PAYMENT_CAPTURED','PAYMENT_FAILED','PAYMENT_CANCELLED','PAYMENT_EXPIRED','PAYMENT_REFUND_INITIATED','PAYMENT_REFUND_PROCESSED','PAYMENT_ORDER_LINKED','RECOVERY_ATTEMPTED','RECONCILIATION_MISMATCH','SYSTEM_AUTO_REFUND') NOT NULL,
    `actorType`            ENUM('CUSTOMER','GATEWAY','SYSTEM','ADMIN') NOT NULL,
    `actorId`              VARCHAR(191) NULL,
    `payload`              JSON         NOT NULL,
    `ipAddress`            VARCHAR(45)  NULL,
    `userAgent`            VARCHAR(500) NULL,
    `traceId`              VARCHAR(32)  NULL,
    `spanId`               VARCHAR(16)  NULL,
    `correlationId`        VARCHAR(191) NULL,
    `requestId`            VARCHAR(191) NULL,
    `createdAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_activities_paymentTransactionId_idx`(`paymentTransactionId`),
    INDEX `payment_activities_storeId_activityType_createdAt_idx`(`storeId`, `activityType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CreateTable: payment_refunds
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `payment_refunds` (
    `id`                   VARCHAR(191) NOT NULL,
    `paymentTransactionId` VARCHAR(191) NOT NULL,
    `orderId`              VARCHAR(191) NULL,
    `storeId`              VARCHAR(191) NOT NULL,
    `amountInPaise`        INTEGER      NOT NULL,
    `reason`               TEXT         NULL,
    `gatewayRefundId`      VARCHAR(200) NULL,
    `status`               VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    `initiatedById`        VARCHAR(191) NULL,
    `processedAt`          DATETIME(3)  NULL,
    `createdAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3)  NOT NULL,

    INDEX `payment_refunds_paymentTransactionId_idx`(`paymentTransactionId`),
    INDEX `payment_refunds_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. CreateTable: inventory_levels
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `inventory_levels` (
    `id`          VARCHAR(191) NOT NULL,
    `storeId`     VARCHAR(191) NOT NULL,
    `productId`   VARCHAR(191) NOT NULL,
    `variantId`   VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NULL,
    `onHand`      INTEGER      NOT NULL DEFAULT 0,
    `reserved`    INTEGER      NOT NULL DEFAULT 0,
    `committed`   INTEGER      NOT NULL DEFAULT 0,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,

    UNIQUE INDEX `inventory_levels_storeId_productId_variantId_key`(`storeId`, `productId`, `variantId`),
    INDEX `inventory_levels_storeId_productId_idx`(`storeId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. CreateTable: inventory_reservations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `inventory_reservations` (
    `id`                   VARCHAR(191) NOT NULL,
    `storeId`              VARCHAR(191) NOT NULL,
    `paymentTransactionId` VARCHAR(191) NULL,
    `tentativeOrderId`     VARCHAR(191) NOT NULL,
    `status`               ENUM('RESERVED','COMMITTED','RELEASED','EXPIRED') NOT NULL DEFAULT 'RESERVED',
    `expiresAt`            DATETIME(3)  NOT NULL,
    `reservedAt`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `releasedAt`           DATETIME(3)  NULL,
    `createdAt`            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`            DATETIME(3)  NOT NULL,

    UNIQUE INDEX `inventory_reservations_paymentTransactionId_key`(`paymentTransactionId`),
    INDEX `inventory_reservations_storeId_status_idx`(`storeId`, `status`),
    INDEX `inventory_reservations_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. CreateTable: inventory_reservation_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `inventory_reservation_items` (
    `id`            VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `storeId`       VARCHAR(191) NOT NULL,
    `productId`     VARCHAR(191) NOT NULL,
    `variantId`     VARCHAR(191) NULL,
    `warehouseId`   VARCHAR(191) NULL,
    `quantity`      INTEGER      NOT NULL,

    INDEX `inventory_reservation_items_reservationId_idx`(`reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. CreateTable: store_order_counters
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `store_order_counters` (
    `storeId` VARCHAR(191) NOT NULL,
    `year`    INTEGER      NOT NULL,
    `counter` INTEGER      NOT NULL DEFAULT 0,

    PRIMARY KEY (`storeId`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. CreateTable: order_snapshots
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `order_snapshots` (
    `id`        VARCHAR(191) NOT NULL,
    `orderId`   VARCHAR(191) NOT NULL,
    `storeId`   VARCHAR(191) NOT NULL,
    `payload`   JSON         NOT NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_snapshots_orderId_key`(`orderId`),
    INDEX `order_snapshots_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. CreateTable: outbox_events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `outbox_events` (
    `id`            VARCHAR(191) NOT NULL,
    `storeId`       VARCHAR(191) NOT NULL,
    `eventType`     VARCHAR(100) NOT NULL,
    `eventVersion`  INTEGER      NOT NULL DEFAULT 1,
    `aggregateId`   VARCHAR(191) NOT NULL,
    `aggregateType` VARCHAR(50)  NOT NULL,
    `payload`       JSON         NOT NULL,
    `status`        ENUM('PENDING','PROCESSING','SENT','FAILED','DEAD') NOT NULL DEFAULT 'PENDING',
    `attempts`      INTEGER      NOT NULL DEFAULT 0,
    `maxAttempts`   INTEGER      NOT NULL DEFAULT 5,
    `nextRetryAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt`   DATETIME(3)  NULL,
    `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`     DATETIME(3)  NOT NULL,

    INDEX `outbox_events_status_nextRetryAt_idx`(`status`, `nextRetryAt`),
    INDEX `outbox_events_storeId_eventType_createdAt_idx`(`storeId`, `eventType`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. CreateTable: webhook_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `webhook_logs` (
    `id`             VARCHAR(191) NOT NULL,
    `gatewayCode`    VARCHAR(20)  NOT NULL,
    `storeId`        VARCHAR(191) NULL,
    `gatewayEventId` VARCHAR(200) NULL,
    `eventType`      VARCHAR(100) NULL,
    `status`         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    `rawBody`        LONGBLOB     NOT NULL,
    `processingMs`   INTEGER      NULL,
    `error`          TEXT         NULL,
    `receivedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt`    DATETIME(3)  NULL,
    `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `webhook_logs_gatewayCode_receivedAt_idx`(`gatewayCode`, `receivedAt`),
    INDEX `webhook_logs_gatewayCode_status_idx`(`gatewayCode`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 18. CreateTable: idempotency_records
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `idempotency_records` (
    `id`        VARCHAR(191) NOT NULL,
    `key`       VARCHAR(500) NOT NULL,
    `storeId`   VARCHAR(191) NULL,
    `expiresAt` DATETIME(3)  NOT NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `idempotency_records_key_key`(`key`),
    INDEX `idempotency_records_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 19. CreateTable: shipment_items
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE `shipment_items` (
    `id`         VARCHAR(191) NOT NULL,
    `shipmentId` VARCHAR(191) NOT NULL,
    `orderId`    VARCHAR(191) NOT NULL,
    `productId`  VARCHAR(191) NOT NULL,
    `variantId`  VARCHAR(191) NULL,
    `quantity`   INTEGER      NOT NULL,

    INDEX `shipment_items_shipmentId_idx`(`shipmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- 20. AddForeignKey constraints
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE `store_payment_configs`
  ADD CONSTRAINT `store_payment_configs_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `store_payment_methods`
  ADD CONSTRAINT `store_payment_methods_configId_fkey`
  FOREIGN KEY (`configId`) REFERENCES `store_payment_configs`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payment_transactions`
  ADD CONSTRAINT `payment_transactions_checkoutSessionId_fkey`
  FOREIGN KEY (`checkoutSessionId`) REFERENCES `checkout_sessions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `payment_transactions`
  ADD CONSTRAINT `payment_transactions_paymentMethodId_fkey`
  FOREIGN KEY (`paymentMethodId`) REFERENCES `store_payment_methods`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment_transactions`
  ADD CONSTRAINT `payment_transactions_supersededById_fkey`
  FOREIGN KEY (`supersededById`) REFERENCES `payment_transactions`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `payment_activities`
  ADD CONSTRAINT `payment_activities_paymentTransactionId_fkey`
  FOREIGN KEY (`paymentTransactionId`) REFERENCES `payment_transactions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payment_refunds`
  ADD CONSTRAINT `payment_refunds_paymentTransactionId_fkey`
  FOREIGN KEY (`paymentTransactionId`) REFERENCES `payment_transactions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inventory_reservations`
  ADD CONSTRAINT `inventory_reservations_paymentTransactionId_fkey`
  FOREIGN KEY (`paymentTransactionId`) REFERENCES `payment_transactions`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_reservation_items`
  ADD CONSTRAINT `inventory_reservation_items_reservationId_fkey`
  FOREIGN KEY (`reservationId`) REFERENCES `inventory_reservations`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_snapshots`
  ADD CONSTRAINT `order_snapshots_orderId_fkey`
  FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `shipment_items`
  ADD CONSTRAINT `shipment_items_shipmentId_fkey`
  FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 21. Data migration — seed inventory_levels from Product.stock
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO `inventory_levels` (`id`, `storeId`, `productId`, `variantId`, `warehouseId`, `onHand`, `reserved`, `committed`, `createdAt`, `updatedAt`)
SELECT
  UUID(), p.`storeId`, p.`id`, NULL, NULL, p.`stock`, 0, 0, NOW(3), NOW(3)
FROM `products` p
WHERE p.`stock` > 0
  AND NOT EXISTS (
    SELECT 1 FROM `inventory_levels` il
    WHERE il.`storeId` = p.`storeId`
      AND il.`productId` = p.`id`
      AND il.`variantId` IS NULL
  );

-- Seed InventoryLevel from ProductVariant.stock
INSERT INTO `inventory_levels` (`id`, `storeId`, `productId`, `variantId`, `warehouseId`, `onHand`, `reserved`, `committed`, `createdAt`, `updatedAt`)
SELECT
  UUID(), p.`storeId`, pv.`productId`, pv.`id`, NULL, pv.`stock`, 0, 0, NOW(3), NOW(3)
FROM `product_variants` pv
JOIN `products` p ON pv.`productId` = p.`id`
WHERE pv.`stock` > 0
  AND NOT EXISTS (
    SELECT 1 FROM `inventory_levels` il
    WHERE il.`storeId` = p.`storeId`
      AND il.`productId` = pv.`productId`
      AND il.`variantId` = pv.`id`
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 22. Data migration — seed StorePaymentConfig + COD StorePaymentMethod
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO `store_payment_configs` (`id`, `storeId`, `defaultGateway`, `isLive`, `createdAt`, `updatedAt`)
SELECT UUID(), `id`, 'cod', false, NOW(3), NOW(3)
FROM `stores`
WHERE NOT EXISTS (
  SELECT 1 FROM `store_payment_configs` spc WHERE spc.`storeId` = `stores`.`id`
);

INSERT INTO `store_payment_methods` (`id`, `storeId`, `configId`, `gatewayCode`, `displayName`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT UUID(), s.`id`, spc.`id`, 'cod', 'Cash on Delivery', true, 0, NOW(3), NOW(3)
FROM `stores` s
JOIN `store_payment_configs` spc ON spc.`storeId` = s.`id`
WHERE NOT EXISTS (
  SELECT 1 FROM `store_payment_methods` spm
  WHERE spm.`storeId` = s.`id` AND spm.`gatewayCode` = 'cod'
);
