import { Module } from '@nestjs/common';
import { ApiRootController } from './api-root.controller.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController, ApiRootController],
  providers: [HealthService],
})
export class HealthModule {}
