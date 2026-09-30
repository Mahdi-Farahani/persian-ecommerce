import { Module } from '@nestjs/common';
import { AdminShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';

@Module({
  controllers: [AdminShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
