-- Vendor assignment (marketplace sellers) + vendor ownership snapshot on order lines.
-- Additive only: every new column is NULLable, so existing products (no vendor)
-- and existing order lines (no snapshot) are untouched and keep working.
-- order_items.vendorId deliberately has NO foreign key — it is a historical
-- snapshot that must survive product reassignment and vendor deletion.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `vendorId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `vendorId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `vendors` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `notifyOnOrder` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendors_storeId_status_idx`(`storeId`, `status`),
    UNIQUE INDEX `vendors_storeId_name_key`(`storeId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `products_vendorId_fkey` ON `products`(`vendorId`);

-- CreateIndex
CREATE INDEX `order_items_vendorId_idx` ON `order_items`(`vendorId`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

