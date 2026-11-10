-- Vendor portal authentication: vendor users, rotating refresh tokens, and
-- single-use invitation / password-reset tokens. Additive only: three new tables
-- with FKs to vendors (RESTRICT — a vendor with users cannot be deleted) and to
-- vendor_users (CASCADE). No existing table or column changes.

-- CreateTable
CREATE TABLE `vendor_users` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'INVITED',
    `passwordHash` VARCHAR(100) NULL,
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `tokenVersion` INTEGER NOT NULL DEFAULT 0,
    `invitedById` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendor_users_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `vendor_users_storeId_email_key`(`storeId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `vendorUserId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendor_refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `vendor_refresh_tokens_vendorUserId_idx`(`vendorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_auth_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `vendorUserId` VARCHAR(191) NOT NULL,
    `purpose` ENUM('INVITATION', 'PASSWORD_RESET') NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendor_auth_tokens_tokenHash_key`(`tokenHash`),
    INDEX `vendor_auth_tokens_vendorUserId_purpose_idx`(`vendorUserId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendor_users` ADD CONSTRAINT `vendor_users_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_refresh_tokens` ADD CONSTRAINT `vendor_refresh_tokens_vendorUserId_fkey` FOREIGN KEY (`vendorUserId`) REFERENCES `vendor_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_auth_tokens` ADD CONSTRAINT `vendor_auth_tokens_vendorUserId_fkey` FOREIGN KEY (`vendorUserId`) REFERENCES `vendor_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

