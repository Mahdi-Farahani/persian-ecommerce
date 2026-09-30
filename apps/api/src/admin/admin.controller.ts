import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuditLogView, DashboardMetrics, Paginated } from '@pe/shared';
import { RequirePermissions } from '../auth/auth.decorators.js';
import { Permissions } from '../rbac/permissions.js';
import { AuditLogsService } from './audit-logs.service.js';
import { DashboardService } from './dashboard.service.js';
import { AuditLogsQueryDto } from './dto/admin.dto.js';

@ApiTags('admin/dashboard')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get('dashboard')
  @RequirePermissions(Permissions.ReportsView)
  @ApiOperation({ summary: 'Sales, orders, customers, catalogue, inventory and activity metrics' })
  metrics(): Promise<DashboardMetrics> {
    return this.dashboard.metrics();
  }

  @Get('audit-logs')
  @RequirePermissions(Permissions.AuditLogsView)
  @ApiOperation({ summary: 'Audit trail of sensitive administrative actions' })
  list(@Query() query: AuditLogsQueryDto): Promise<Paginated<AuditLogView>> {
    return this.auditLogs.list(query);
  }

  @Get('audit-logs/actions')
  @RequirePermissions(Permissions.AuditLogsView)
  @ApiOperation({ summary: 'Distinct audit action names' })
  actions(): Promise<string[]> {
    return this.auditLogs.actions();
  }
}
