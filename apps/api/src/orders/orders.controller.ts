import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AdminOrderDetail,
  AdminOrderSummary,
  AuthUser,
  OrderDetail,
  OrderSummary,
  Paginated,
} from '@pe/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentUser, RequirePermissions } from '../auth/auth.decorators.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Permissions } from '../rbac/permissions.js';
import {
  AdminOrdersQueryDto,
  CreateShipmentDto,
  PlaceOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Place an order from the cart (reserves stock, status PENDING_PAYMENT)',
  })
  placeOrder(@CurrentUser() user: AuthUser, @Body() dto: PlaceOrderDto): Promise<OrderDetail> {
    return this.orders.placeOrder(user.id, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'My orders' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<OrderSummary>> {
    return this.orders.listForUser(user.id, query.page, query.limit);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'My order detail' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.orders.getForUser(user.id, id);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel my unpaid order' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderDetail> {
    return this.orders.cancelByCustomer(user.id, id);
  }
}

@ApiTags('admin/orders')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.OrdersView)
  @ApiOperation({ summary: 'List orders (admin)' })
  list(@Query() query: AdminOrdersQueryDto): Promise<Paginated<AdminOrderSummary>> {
    return this.orders.adminList(query);
  }

  @Get(':id')
  @RequirePermissions(Permissions.OrdersView)
  @ApiOperation({ summary: 'Order detail (admin)' })
  get(@Param('id') id: string): Promise<AdminOrderDetail> {
    return this.orders.adminGet(id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permissions.OrdersManage)
  @ApiOperation({ summary: 'Change order status (validated transitions, audited)' })
  async setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminOrderDetail> {
    const order = await this.orders.adminSetStatus(id, dto.status, dto.note, actor.id);
    await this.audit.record({
      actorId: actor.id,
      action: 'order.status.update',
      entityType: 'Order',
      entityId: id,
      metadata: { to: dto.status, note: dto.note },
      request: req,
    });
    return order;
  }

  @Post(':id/shipments')
  @RequirePermissions(Permissions.OrdersManage)
  @ApiOperation({ summary: 'Register a shipment (moves the order to SHIPPED)' })
  async addShipment(
    @Param('id') id: string,
    @Body() dto: CreateShipmentDto,
    @CurrentUser() actor: AuthUser,
    @Req() req: AuthenticatedRequest,
  ): Promise<AdminOrderDetail> {
    const order = await this.orders.adminAddShipment(id, dto, actor.id);
    await this.audit.record({
      actorId: actor.id,
      action: 'order.shipment.create',
      entityType: 'Order',
      entityId: id,
      metadata: { carrier: dto.carrier, trackingCode: dto.trackingCode },
      request: req,
    });
    return order;
  }
}
