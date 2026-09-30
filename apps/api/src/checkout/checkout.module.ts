import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module.js';
import { ShippingModule } from '../shipping/shipping.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [CartModule, ShippingModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
