import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { SearchModule } from '../search/search.module.js';
import { ProductsAdminService } from './products-admin.service.js';
import { AdminProductsController, ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [CategoriesModule, InventoryModule, SearchModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService, ProductsAdminService],
  exports: [ProductsService, ProductsAdminService],
})
export class ProductsModule {}
