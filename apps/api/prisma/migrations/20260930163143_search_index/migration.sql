-- AlterTable
ALTER TABLE `products` ADD COLUMN `searchText` TEXT NULL;

-- CreateIndex
CREATE FULLTEXT INDEX `products_searchText_idx` ON `products`(`searchText`);

-- Backfill from the titles so existing rows are searchable immediately;
-- the application reindexes with brand/category/SKU context on next seed or admin edit.
UPDATE `products` SET `searchText` = TRIM(CONCAT_WS(' ', `title`, `titleEn`, `shortDescription`));
