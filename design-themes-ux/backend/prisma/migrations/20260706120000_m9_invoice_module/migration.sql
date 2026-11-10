-- M9: Customer & Merchant Invoice Module.
-- Purely additive: new seller/GST billing fields on `store_settings`, plus two
-- new tables (`store_invoice_counters`, `order_invoices`). No existing table's
-- data is altered; `Order.total`/`tax`/etc. and `StoreOrderCounter` are untouched
-- — invoice numbering deliberately uses its own separate counter/sequence.

-- AlterTable
ALTER TABLE `store_settings`
    ADD COLUMN `legalBusinessName` VARCHAR(191) NULL,
    ADD COLUMN `gstin` VARCHAR(20) NULL,
    ADD COLUMN `registeredAddressLine1` VARCHAR(191) NULL,
    ADD COLUMN `registeredAddressLine2` VARCHAR(191) NULL,
    ADD COLUMN `registeredCity` VARCHAR(191) NULL,
    ADD COLUMN `registeredState` VARCHAR(191) NULL,
    ADD COLUMN `registeredPostalCode` VARCHAR(191) NULL,
    ADD COLUMN `registeredCountry` VARCHAR(191) NULL DEFAULT 'India',
    ADD COLUMN `businessPhone` VARCHAR(191) NULL,
    ADD COLUMN `businessEmail` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `store_invoice_counters` (
    `storeId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `counter` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`storeId`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `order_invoices_orderId_key`(`orderId`),
    UNIQUE INDEX `order_invoices_storeId_invoiceNumber_key`(`storeId`, `invoiceNumber`),
    INDEX `order_invoices_storeId_idx`(`storeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_invoices` ADD CONSTRAINT `order_invoices_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
