import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type {
  AuthUser,
  InventoryItemView,
  InventorySummary,
  InventoryTransactionView,
  Paginated,
} from '@pe/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { InventoryService, type InventorySnapshot } from './inventory.service.js';

const ADJUST_TYPES = ['ADJUSTMENT', 'PURCHASE', 'RETURN'] as const;

const toBool = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value;

export class InventoryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SKU, variant or product title' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() lowStock?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBool) @IsBoolean() outOfStock?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID('7') productId?: string;
}

export class AdjustInventoryDto {
  @ApiProperty({ description: 'Signed quantity applied to stock', example: 10 })
  @IsInt()
  @Min(-1_000_000)
  @Max(1_000_000)
  quantity: number;

  @ApiPropertyOptional({ enum: ADJUST_TYPES, default: 'ADJUSTMENT' })
  @IsOptional()
  @IsIn(ADJUST_TYPES)
  type?: (typeof ADJUST_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class LowStockThresholdDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold: number;
}

@ApiTags('admin/inventory')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Inventory list (lowest stock first) with filters' })
  list(@Query() query: InventoryListQueryDto): Promise<Paginated<InventoryItemView>> {
    return this.inventory.list(query);
  }

  @Get('summary')
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Dashboard counters' })
  summary(): Promise<InventorySummary> {
    return this.inventory.summary();
  }

  @Get(':variantId')
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Inventory snapshot for a variant with its product identity' })
  get(@Param('variantId') variantId: string): Promise<InventoryItemView> {
    return this.inventory.getItem(variantId);
  }

  @Get(':variantId/transactions')
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Recent inventory ledger entries for a variant' })
  transactions(@Param('variantId') variantId: string): Promise<InventoryTransactionView[]> {
    return this.inventory.transactions(variantId);
  }

  @Patch(':variantId/adjust')
  @RequirePermissions(Permissions.InventoryManage)
  @ApiOperation({ summary: 'Adjust stock (audited, ledger entry created)' })
  async adjust(
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<InventorySnapshot> {
    const snapshot = await this.inventory.adjustStock({
      variantId,
      quantity: dto.quantity,
      type: dto.type ?? 'ADJUSTMENT',
      note: dto.note,
      actorId: actor.id,
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'inventory.adjust',
      entityType: 'ProductVariant',
      entityId: variantId,
      metadata: {
        quantity: dto.quantity,
        type: dto.type ?? 'ADJUSTMENT',
        note: dto.note,
        stockAfter: snapshot.stockQuantity,
      },
      request: req,
    });
    return snapshot;
  }

  @Patch(':variantId/threshold')
  @RequirePermissions(Permissions.InventoryManage)
  @ApiOperation({ summary: 'Set low-stock threshold' })
  async threshold(
    @Param('variantId') variantId: string,
    @Body() dto: LowStockThresholdDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<InventorySnapshot> {
    const snapshot = await this.inventory.setLowStockThreshold(variantId, dto.lowStockThreshold);
    await this.audit.record({
      actorId: actor.id,
      action: 'inventory.threshold',
      entityType: 'ProductVariant',
      entityId: variantId,
      metadata: { lowStockThreshold: dto.lowStockThreshold },
      request: req,
    });
    return snapshot;
  }
}
