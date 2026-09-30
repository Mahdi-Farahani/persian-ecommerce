import { Module } from '@nestjs/common';
import { AdminCouponsController } from './coupons.controller.js';
import { CouponsService } from './coupons.service.js';

@Module({
  controllers: [AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
