-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `commissionAmount` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `sellerAmount` BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN `sellerId` CHAR(36) NULL,
    ADD COLUMN `settlementId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `sellerId` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `shipments` ADD COLUMN `sellerId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `sellers` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `storeName` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `description` VARCHAR(1000) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `commissionBps` INTEGER NOT NULL DEFAULT 1000,
    `contactPhone` VARCHAR(20) NOT NULL,
    `contactEmail` VARCHAR(255) NULL,
    `legalName` VARCHAR(255) NULL,
    `nationalId` VARCHAR(20) NULL,
    `iban` VARCHAR(34) NULL,
    `province` VARCHAR(100) NULL,
    `city` VARCHAR(100) NULL,
    `addressLine` VARCHAR(500) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `approvedAt` DATETIME(3) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sellers_userId_key`(`userId`),
    UNIQUE INDEX `sellers_storeName_key`(`storeName`),
    UNIQUE INDEX `sellers_slug_key`(`slug`),
    INDEX `sellers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` CHAR(36) NOT NULL,
    `sellerId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `grossAmount` BIGINT NOT NULL,
    `commissionAmount` BIGINT NOT NULL,
    `netAmount` BIGINT NOT NULL,
    `itemCount` INTEGER NOT NULL,
    `periodStart` DATETIME(3) NULL,
    `periodEnd` DATETIME(3) NULL,
    `note` VARCHAR(500) NULL,
    `paymentReference` VARCHAR(100) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdById` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `settlements_sellerId_status_idx`(`sellerId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `order_items_sellerId_settlementId_idx` ON `order_items`(`sellerId`, `settlementId`);

-- CreateIndex
CREATE INDEX `product_variants_sellerId_status_idx` ON `product_variants`(`sellerId`, `status`);

-- CreateIndex
CREATE INDEX `shipments_sellerId_idx` ON `shipments`(`sellerId`);

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `settlements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sellers` ADD CONSTRAINT `sellers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `sellers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
