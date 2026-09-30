-- CreateIndex
CREATE INDEX `audit_logs_action_createdAt_idx` ON `audit_logs`(`action`, `createdAt`);

-- CreateIndex
CREATE INDEX `orders_paidAt_idx` ON `orders`(`paidAt`);

-- CreateIndex
CREATE INDEX `products_categoryId_status_minPrice_idx` ON `products`(`categoryId`, `status`, `minPrice`);
