-- ============================================================================
-- Phase 0: Universal Architecture v2 — ADDITIVE ONLY
-- Adds 7 new tables for the ContentNode document model.
-- Zero existing tables are modified. Zero data is migrated yet.
-- Old tables remain the system of record until the parity gate passes.
-- ============================================================================

-- CreateTable
CREATE TABLE `page_documents` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `themeId` VARCHAR(191) NOT NULL,
    `scope` ENUM('PAGE', 'SYMBOL', 'HEADER', 'FOOTER', 'ANNOUNCEMENT') NOT NULL DEFAULT 'PAGE',
    `ownerKey` VARCHAR(150) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `tree` JSON NOT NULL,
    `seo` JSON NULL,
    `settings` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `page_documents_storeId_themeId_status_idx`(`storeId`, `themeId`, `status`),
    UNIQUE INDEX `page_documents_storeId_themeId_ownerKey_status_key`(`storeId`, `themeId`, `ownerKey`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `symbol_documents` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `themeId` VARCHAR(191) NOT NULL,
    `scope` ENUM('PAGE', 'SYMBOL', 'HEADER', 'FOOTER', 'ANNOUNCEMENT') NOT NULL,
    `handle` VARCHAR(100) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `tree` JSON NOT NULL,
    `exposedProps` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `symbol_documents_storeId_themeId_status_idx`(`storeId`, `themeId`, `status`),
    UNIQUE INDEX `symbol_documents_storeId_themeId_handle_status_key`(`storeId`, `themeId`, `handle`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `theme_documents` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NULL,
    `themeId` VARCHAR(191) NOT NULL,
    `semver` VARCHAR(20) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `tokens` JSON NOT NULL,
    `templates` JSON NOT NULL,
    `components` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `theme_documents_themeId_status_idx`(`themeId`, `status`),
    UNIQUE INDEX `theme_documents_storeId_themeId_status_key`(`storeId`, `themeId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `node_refs` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('PAGE', 'SYMBOL', 'HEADER', 'FOOTER', 'ANNOUNCEMENT') NOT NULL,
    `ownerKey` VARCHAR(150) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL,
    `refType` ENUM('COLLECTION', 'PRODUCT', 'MENU', 'SYMBOL', 'COMPONENT', 'PAGE', 'FILE') NOT NULL,
    `refId` VARCHAR(191) NOT NULL,
    `nodePath` VARCHAR(500) NOT NULL,

    INDEX `node_refs_storeId_refType_refId_idx`(`storeId`, `refType`, `refId`),
    INDEX `node_refs_documentId_status_idx`(`documentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compiled_pages` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `themeId` VARCHAR(191) NOT NULL,
    `ownerKey` VARCHAR(150) NOT NULL,
    `cacheKey` VARCHAR(120) NOT NULL,
    `artifactUrl` VARCHAR(500) NOT NULL,
    `islandManifest` JSON NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `compiled_pages_cacheKey_idx`(`cacheKey`),
    UNIQUE INDEX `compiled_pages_storeId_themeId_ownerKey_key`(`storeId`, `themeId`, `ownerKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `component_definitions` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NULL,
    `kind` ENUM('ROOT', 'LAYOUT', 'CONTENT', 'DATA_BOUND') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `category` VARCHAR(40) NOT NULL,
    `description` VARCHAR(300) NULL,
    `settingsSchema` JSON NOT NULL,
    `acceptsChildren` BOOLEAN NOT NULL DEFAULT false,
    `allowedChildren` JSON NULL,
    `minChildren` INTEGER NULL,
    `maxChildren` INTEGER NULL,
    `providesContext` VARCHAR(50) NULL,
    `interactive` BOOLEAN NOT NULL DEFAULT false,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `isBuiltIn` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `component_definitions_storeId_kind_isActive_idx`(`storeId`, `kind`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('PAGE', 'SYMBOL', 'HEADER', 'FOOTER', 'ANNOUNCEMENT') NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `publishedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `document_versions_documentId_version_idx`(`documentId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `page_documents` ADD CONSTRAINT `page_documents_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `symbol_documents` ADD CONSTRAINT `symbol_documents_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `theme_documents` ADD CONSTRAINT `theme_documents_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `component_definitions` ADD CONSTRAINT `component_definitions_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
