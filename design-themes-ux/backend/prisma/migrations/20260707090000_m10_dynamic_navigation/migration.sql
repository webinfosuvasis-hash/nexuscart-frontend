-- M10: Dynamic Storefront Navigation Integration (Phase 9).
-- Purely additive: new optional columns on `menu_items` for structured link
-- targets, active/inactive state, and mega-menu visual extras. No existing
-- column, row, or table is altered. Menu/MenuItem CRUD semantics are
-- untouched — these columns simply flow through the existing create/update
-- spread (`dto: any`) unmodified.

-- AlterTable
ALTER TABLE `menu_items`
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `linkType` VARCHAR(20) NULL,
    ADD COLUMN `categoryId` VARCHAR(191) NULL,
    ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `brandId` VARCHAR(191) NULL,
    ADD COLUMN `cmsPageId` VARCHAR(191) NULL,
    ADD COLUMN `collectionId` VARCHAR(191) NULL,
    ADD COLUMN `megaMenu` JSON NULL;

-- CreateIndex
CREATE INDEX `menu_items_categoryId_idx` ON `menu_items`(`categoryId`);

-- CreateIndex
CREATE INDEX `menu_items_productId_idx` ON `menu_items`(`productId`);

-- CreateIndex
CREATE INDEX `menu_items_brandId_idx` ON `menu_items`(`brandId`);

-- CreateIndex
CREATE INDEX `menu_items_cmsPageId_idx` ON `menu_items`(`cmsPageId`);

-- CreateIndex
CREATE INDEX `menu_items_collectionId_idx` ON `menu_items`(`collectionId`);
