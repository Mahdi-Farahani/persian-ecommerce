import { Module } from '@nestjs/common';
import { AdminBrandsController, BrandsController } from './brands.controller.js';
import { BrandsService } from './brands.service.js';

@Module({
  controllers: [BrandsController, AdminBrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
