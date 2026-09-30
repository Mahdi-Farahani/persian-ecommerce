import { Module } from '@nestjs/common';
import { AdminAttributesController } from './attributes.controller.js';
import { AttributesService } from './attributes.service.js';

@Module({
  controllers: [AdminAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
