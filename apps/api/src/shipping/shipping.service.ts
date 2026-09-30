import { Injectable } from '@nestjs/common';
import type { ShippingMethodView } from '@pe/shared';
import { ConflictAppException, NotFoundAppException } from '../common/errors/app.exception.js';
import { money, moneyOrNull } from '../common/utils/money.util.js';
import type { Prisma, ShippingMethod } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import type { CreateShippingMethodDto, UpdateShippingMethodDto } from './dto/shipping.dto.js';

export interface AdminShippingMethodView extends Omit<ShippingMethodView, 'fee'> {
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  toView(method: ShippingMethod, merchandiseTotal: number): ShippingMethodView {
    const baseFee = money(method.baseFee);
    const freeAboveAmount = moneyOrNull(method.freeAboveAmount);
    return {
      id: method.id,
      code: method.code,
      name: method.name,
      description: method.description,
      baseFee,
      freeAboveAmount,
      fee: this.pricing.shippingFee(merchandiseTotal, { baseFee, freeAboveAmount }),
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
    };
  }

  static toAdminView(method: ShippingMethod): AdminShippingMethodView {
    return {
      id: method.id,
      code: method.code,
      name: method.name,
      description: method.description,
      baseFee: money(method.baseFee),
      freeAboveAmount: moneyOrNull(method.freeAboveAmount),
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
      createdAt: method.createdAt.toISOString(),
      updatedAt: method.updatedAt.toISOString(),
    };
  }

  async listActive(merchandiseTotal: number): Promise<ShippingMethodView[]> {
    const methods = await this.prisma.shippingMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { baseFee: 'asc' }],
    });
    return methods.map((m) => this.toView(m, merchandiseTotal));
  }

  async findActiveByCode(code: string): Promise<ShippingMethod | null> {
    return this.prisma.shippingMethod.findFirst({ where: { code, isActive: true } });
  }

  // --- administration -------------------------------------------------------

  async adminList(): Promise<AdminShippingMethodView[]> {
    const methods = await this.prisma.shippingMethod.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return methods.map((m) => ShippingService.toAdminView(m));
  }

  async create(dto: CreateShippingMethodDto): Promise<AdminShippingMethodView> {
    const clash = await this.prisma.shippingMethod.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (clash) throw new ConflictAppException('SHIPPING_CODE_TAKEN', 'کد روش ارسال تکراری است');
    const method = await this.prisma.shippingMethod.create({
      data: this.toData(dto) as Prisma.ShippingMethodUncheckedCreateInput,
    });
    return ShippingService.toAdminView(method);
  }

  async update(id: string, dto: UpdateShippingMethodDto): Promise<AdminShippingMethodView> {
    const current = await this.prisma.shippingMethod.findUnique({ where: { id } });
    if (!current) throw new NotFoundAppException('SHIPPING_METHOD_NOT_FOUND', 'روش ارسال پیدا نشد');
    if (dto.code && dto.code !== current.code) {
      const clash = await this.prisma.shippingMethod.findUnique({
        where: { code: dto.code },
        select: { id: true },
      });
      if (clash) throw new ConflictAppException('SHIPPING_CODE_TAKEN', 'کد روش ارسال تکراری است');
    }
    const method = await this.prisma.shippingMethod.update({
      where: { id },
      data: this.toData(dto),
    });
    return ShippingService.toAdminView(method);
  }

  async remove(id: string): Promise<void> {
    const current = await this.prisma.shippingMethod.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundAppException('SHIPPING_METHOD_NOT_FOUND', 'روش ارسال پیدا نشد');
    await this.prisma.shippingMethod.delete({ where: { id } });
  }

  private toData(dto: Partial<CreateShippingMethodDto>): Prisma.ShippingMethodUncheckedUpdateInput {
    return {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      baseFee: dto.baseFee === undefined ? undefined : BigInt(dto.baseFee),
      freeAboveAmount:
        dto.freeAboveAmount === undefined
          ? undefined
          : dto.freeAboveAmount === null
            ? null
            : BigInt(dto.freeAboveAmount),
      estimatedDaysMin: dto.estimatedDaysMin,
      estimatedDaysMax: dto.estimatedDaysMax,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    };
  }
}
