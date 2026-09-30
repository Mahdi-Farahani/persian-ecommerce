-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `currency` CHAR(3) NOT NULL DEFAULT 'IRR',
    `subtotal` BIGINT NOT NULL,
    `discount` BIGINT NOT NULL DEFAULT 0,
    `shippingFee` BIGINT NOT NULL DEFAULT 0,
    `total` BIGINT NOT NULL,
    `couponId` CHAR(36) NULL,
    `couponCode` VARCHAR(50) NULL,
    `shippingMethodCode` VARCHAR(50) NOT NULL,
    `shippingMethodName` VARCHAR(150) NOT NULL,
    `estimatedDaysMin` INTEGER NOT NULL DEFAULT 1,
    `estimatedDaysMax` INTEGER NOT NULL DEFAULT 3,
    `recipientName` VARCHAR(150) NOT NULL,
    `recipientPhone` VARCHAR(20) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `addressLine` VARCHAR(500) NOT NULL,
    `postalCode` CHAR(10) NOT NULL,
    `customerNote` VARCHAR(500) NULL,
    `paymentDeadlineAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_number_key`(`number`),
    INDEX `orders_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `orders_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `orders_status_paymentDeadlineAt_idx`(`status`, `paymentDeadlineAt`),
    INDEX `orders_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `variantId` CHAR(36) NULL,
    `productId` CHAR(36) NULL,
    `productTitle` VARCHAR(255) NOT NULL,
    `productSlug` VARCHAR(180) NOT NULL,
    `variantTitle` VARCHAR(255) NULL,
    `sku` VARCHAR(64) NOT NULL,
    `imageUrl` VARCHAR(500) NULL,
    `unitPrice` BIGINT NOT NULL,
    `compareAtPrice` BIGINT NULL,
    `quantity` INTEGER NOT NULL,
    `lineTotal` BIGINT NOT NULL,

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_variantId_idx`(`variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `fromStatus` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED') NULL,
    `toStatus` ENUM('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED') NOT NULL,
    `note` VARCHAR(500) NULL,
    `actorId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_status_history_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipments` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `carrier` VARCHAR(100) NULL,
    `trackingCode` VARCHAR(100) NULL,
    `shippedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `shipments_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shipment_tracking` (
    `id` CHAR(36) NOT NULL,
    `shipmentId` CHAR(36) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shipment_tracking_shipmentId_occurredAt_idx`(`shipmentId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `orderId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `provider` ENUM('ZARINPAL', 'SNAPP_PAY', 'DIGIPAY', 'TOROB_PAY', 'MOCK') NOT NULL,
    `environment` ENUM('SANDBOX', 'PRODUCTION') NOT NULL,
    `attemptNumber` INTEGER NOT NULL,
    `amount` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'IRR',
    `status` ENUM('INITIATED', 'REDIRECTED', 'CALLBACK_RECEIVED', 'VERIFYING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED') NOT NULL DEFAULT 'INITIATED',
    `requestId` CHAR(36) NOT NULL,
    `providerAuthority` VARCHAR(255) NULL,
    `providerTransactionId` VARCHAR(255) NULL,
    `redirectUrl` VARCHAR(1000) NULL,
    `cardPanMask` VARCHAR(32) NULL,
    `errorCode` VARCHAR(64) NULL,
    `errorMessage` VARCHAR(500) NULL,
    `callbackPayload` JSON NULL,
    `verificationPayload` JSON NULL,
    `redirectedAt` DATETIME(3) NULL,
    `callbackAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_requestId_key`(`requestId`),
    INDEX `payments_provider_providerAuthority_idx`(`provider`, `providerAuthority`),
    INDEX `payments_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `payments_status_createdAt_idx`(`status`, `createdAt`),
    UNIQUE INDEX `payments_orderId_attemptNumber_key`(`orderId`, `attemptNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_transactions` (
    `id` CHAR(36) NOT NULL,
    `paymentId` CHAR(36) NOT NULL,
    `type` ENUM('PAYMENT', 'REFUND', 'REVERSE', 'SETTLEMENT', 'INQUIRY') NOT NULL,
    `amount` BIGINT NOT NULL,
    `succeeded` BOOLEAN NOT NULL,
    `providerReference` VARCHAR(255) NULL,
    `errorCode` VARCHAR(64) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_transactions_paymentId_createdAt_idx`(`paymentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_provider_configs` (
    `id` CHAR(36) NOT NULL,
    `provider` ENUM('ZARINPAL', 'SNAPP_PAY', 'DIGIPAY', 'TOROB_PAY', 'MOCK') NOT NULL,
    `displayName` VARCHAR(100) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `environment` ENUM('SANDBOX', 'PRODUCTION') NOT NULL DEFAULT 'SANDBOX',
    `credentialsEncrypted` TEXT NULL,
    `configuration` JSON NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestSucceeded` BOOLEAN NULL,
    `lastTestMessage` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_provider_configs_provider_key`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `coupons`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipments` ADD CONSTRAINT `shipments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shipment_tracking` ADD CONSTRAINT `shipment_tracking_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `shipments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
