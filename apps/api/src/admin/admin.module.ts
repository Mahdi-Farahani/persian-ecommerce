import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { AdminController } from './admin.controller.js';
import { AuditLogsService } from './audit-logs.service.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [InventoryModule],
  controllers: [AdminController],
  providers: [DashboardService, AuditLogsService],
})
export class AdminModule {}
