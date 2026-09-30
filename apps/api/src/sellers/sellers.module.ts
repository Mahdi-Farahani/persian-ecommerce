import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  AdminSellersController,
  AdminSettlementsController,
  PublicSellersController,
} from './admin-sellers.controller.js';
import { SellerCatalogService } from './seller-catalog.service.js';
import { SellerOrdersService } from './seller-orders.service.js';
import { SellerController } from './seller.controller.js';
import { SellersService } from './sellers.service.js';
import { SettlementsService } from './settlements.service.js';

@Module({
  imports: [UsersModule, ProductsModule, InventoryModule, OrdersModule],
  controllers: [
    SellerController,
    PublicSellersController,
    AdminSellersController,
    AdminSettlementsController,
  ],
  providers: [SellersService, SellerCatalogService, SellerOrdersService, SettlementsService],
  exports: [SellersService],
})
export class SellersModule {}
