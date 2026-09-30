import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { AdminOrdersController, OrdersController } from './orders.controller.js';
import { OrdersScheduler } from './orders.scheduler.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [CartModule, CheckoutModule, InventoryModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrdersScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
