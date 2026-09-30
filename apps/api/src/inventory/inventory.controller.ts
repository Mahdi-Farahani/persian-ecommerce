import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '@pe/shared';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Permissions } from '../rbac/permissions.js';
import { InventoryService, type InventorySnapshot } from './inventory.service.js';

const ADJUST_TYPES = ['ADJUSTMENT', 'PURCHASE', 'RETURN'] as const;

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

  @Get(':variantId')
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Inventory snapshot for a variant' })
  get(@Param('variantId') variantId: string): Promise<InventorySnapshot> {
    return this.inventory.get(variantId);
  }

  @Get(':variantId/transactions')
  @RequirePermissions(Permissions.InventoryView)
  @ApiOperation({ summary: 'Recent inventory ledger entries for a variant' })
  transactions(
    @Param('variantId') variantId: string,
  ): ReturnType<InventoryService['transactions']> {
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
  threshold(
    @Param('variantId') variantId: string,
    @Body() dto: LowStockThresholdDto,
  ): Promise<InventorySnapshot> {
    return this.inventory.setLowStockThreshold(variantId, dto.lowStockThreshold);
  }
}
