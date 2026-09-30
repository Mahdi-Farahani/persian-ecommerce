import { Injectable } from '@nestjs/common';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import type { Address } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddressDto, CreateAddressDto, UpdateAddressDto } from './dto/address.dto.js';

const MAX_ADDRESSES_PER_USER = 10;

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  static toDto(address: Address): AddressDto {
    return {
      id: address.id,
      title: address.title,
      recipientName: address.recipientName,
      recipientPhone: address.recipientPhone,
      province: address.province,
      city: address.city,
      addressLine: address.addressLine,
      postalCode: address.postalCode,
      latitude: address.latitude === null ? null : Number(address.latitude),
      longitude: address.longitude === null ? null : Number(address.longitude),
      isDefault: address.isDefault,
      createdAt: address.createdAt.toISOString(),
      updatedAt: address.updatedAt.toISOString(),
    };
  }

  async list(userId: string): Promise<AddressDto[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return addresses.map((address) => AddressesService.toDto(address));
  }

  async get(userId: string, id: string): Promise<AddressDto> {
    return AddressesService.toDto(await this.findOwned(userId, id));
  }

  async create(userId: string, dto: CreateAddressDto): Promise<AddressDto> {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new UnprocessableAppException(
        'ADDRESS_LIMIT_REACHED',
        `حداکثر ${MAX_ADDRESSES_PER_USER} آدرس می‌توانید ثبت کنید`,
      );
    }
    const makeDefault = dto.isDefault === true || count === 0;
    const address = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.address.create({ data: { ...dto, userId, isDefault: makeDefault } });
    });
    return AddressesService.toDto(address);
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<AddressDto> {
    await this.findOwned(userId, id);
    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      const { isDefault, ...rest } = dto;
      return tx.address.update({
        where: { id },
        data: { ...rest, ...(isDefault === true ? { isDefault: true } : {}) },
      });
    });
    return AddressesService.toDto(address);
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.findOwned(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (address.isDefault) {
        const next = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  private async findOwned(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundAppException('ADDRESS_NOT_FOUND', 'آدرس پیدا نشد');
    return address;
  }
}
