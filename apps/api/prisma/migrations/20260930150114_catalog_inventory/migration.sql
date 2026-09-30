-- CreateTable
CREATE TABLE `brands` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `nameEn` VARCHAR(150) NULL,
    `slug` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `logoUrl` VARCHAR(500) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `seoTitle` VARCHAR(255) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `brands_name_key`(`name`),
    UNIQUE INDEX `brands_slug_key`(`slug`),
    INDEX `brands_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` CHAR(36) NOT NULL,
    `parentId` CHAR(36) NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `path` VARCHAR(1200) NOT NULL,
    `depth` INTEGER NOT NULL DEFAULT 0,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `seoTitle` VARCHAR(255) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_parentId_idx`(`parentId`),
    INDEX `categories_isActive_idx`(`isActive`),
    INDEX `categories_path_idx`(`path`(191)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attributes` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `type` ENUM('SELECT', 'TEXT', 'NUMBER', 'BOOLEAN') NOT NULL DEFAULT 'SELECT',
    `unit` VARCHAR(30) NULL,
    `isVariant` BOOLEAN NOT NULL DEFAULT false,
    `isFilterable` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attributes_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribute_values` (
    `id` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `value` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(150) NOT NULL,
    `colorHex` CHAR(7) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `attribute_values_attributeId_slug_key`(`attributeId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category_attributes` (
    `categoryId` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `category_attributes_attributeId_idx`(`attributeId`),
    PRIMARY KEY (`categoryId`, `attributeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `titleEn` VARCHAR(255) NULL,
    `slug` VARCHAR(180) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `brandId` CHAR(36) NULL,
    `description` TEXT NULL,
    `shortDescription` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `minPrice` BIGINT NULL,
    `maxPrice` BIGINT NULL,
    `ratingAverage` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `ratingCount` INTEGER NOT NULL DEFAULT 0,
    `weightGrams` INTEGER NULL,
    `seoTitle` VARCHAR(255) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    INDEX `products_status_idx`(`status`),
    INDEX `products_categoryId_status_idx`(`categoryId`, `status`),
    INDEX `products_brandId_status_idx`(`brandId`, `status`),
    INDEX `products_minPrice_idx`(`minPrice`),
    INDEX `products_createdAt_idx`(`createdAt`),
    INDEX `products_publishedAt_idx`(`publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NULL,
    `url` VARCHAR(500) NOT NULL,
    `alt` VARCHAR(255) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_images_productId_idx`(`productId`),
    INDEX `product_images_variantId_idx`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_attribute_values` (
    `productId` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `valueId` CHAR(36) NULL,
    `valueText` VARCHAR(255) NULL,

    INDEX `product_attribute_values_attributeId_valueId_idx`(`attributeId`, `valueId`),
    PRIMARY KEY (`productId`, `attributeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_specifications` (
    `id` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `group` VARCHAR(100) NULL,
    `name` VARCHAR(150) NOT NULL,
    `value` VARCHAR(500) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `product_specifications_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `barcode` VARCHAR(64) NULL,
    `title` VARCHAR(255) NULL,
    `price` BIGINT NOT NULL,
    `compareAtPrice` BIGINT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `weightGrams` INTEGER NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_variants_sku_key`(`sku`),
    UNIQUE INDEX `product_variants_barcode_key`(`barcode`),
    INDEX `product_variants_productId_status_idx`(`productId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `variant_attribute_values` (
    `variantId` CHAR(36) NOT NULL,
    `attributeId` CHAR(36) NOT NULL,
    `valueId` CHAR(36) NOT NULL,

    INDEX `variant_attribute_values_valueId_idx`(`valueId`),
    PRIMARY KEY (`variantId`, `attributeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `variantId` CHAR(36) NOT NULL,
    `stockQuantity` INTEGER NOT NULL DEFAULT 0,
    `reservedQuantity` INTEGER NOT NULL DEFAULT 0,
    `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inventory_stockQuantity_idx`(`stockQuantity`),
    PRIMARY KEY (`variantId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transactions` (
    `id` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NOT NULL,
    `type` ENUM('PURCHASE', 'RESERVATION', 'RELEASE', 'SALE', 'RETURN', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `stockAfter` INTEGER NOT NULL,
    `reservedAfter` INTEGER NOT NULL,
    `referenceType` VARCHAR(50) NULL,
    `referenceId` VARCHAR(64) NULL,
    `note` VARCHAR(255) NULL,
    `actorId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_transactions_variantId_createdAt_idx`(`variantId`, `createdAt`),
    INDEX `inventory_transactions_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attribute_values` ADD CONSTRAINT `attribute_values_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_attributes` ADD CONSTRAINT `category_attributes_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `category_attributes` ADD CONSTRAINT `category_attributes_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `product_attribute_values_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `product_attribute_values_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_values` ADD CONSTRAINT `product_attribute_values_valueId_fkey` FOREIGN KEY (`valueId`) REFERENCES `attribute_values`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_specifications` ADD CONSTRAINT `product_specifications_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_attribute_values` ADD CONSTRAINT `variant_attribute_values_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_attribute_values` ADD CONSTRAINT `variant_attribute_values_attributeId_fkey` FOREIGN KEY (`attributeId`) REFERENCES `attributes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `variant_attribute_values` ADD CONSTRAINT `variant_attribute_values_valueId_fkey` FOREIGN KEY (`valueId`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transactions` ADD CONSTRAINT `inventory_transactions_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
