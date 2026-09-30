import { Injectable } from '@nestjs/common';
import { NotFoundAppException, UnprocessableAppException } from '../common/errors/app.exception.js';
import type { InventoryTransactionType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface InventorySnapshot {
  variantId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  lowStock: boolean;
  updatedAt: string;
}

export interface AdjustStockInput {
  variantId: string;
  /** Signed quantity applied to stock. */
  quantity: number;
  type: Extract<InventoryTransactionType, 'ADJUSTMENT' | 'PURCHASE' | 'RETURN'>;
  note?: string;
  actorId?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface ReservationLine {
  variantId: string;
  quantity: number;
}

export interface ReservationReference {
  referenceType: string;
  referenceId: string;
  note?: string;
  actorId?: string;
}

export class InsufficientStockError extends UnprocessableAppException {
  constructor(
    readonly shortages: Array<{ variantId: string; requested: number; available: number }>,
  ) {
    super('INSUFFICIENT_STOCK', 'موجودی برخی کالاها کافی نیست', { shortages });
  }
}

type Tx = Prisma.TransactionClient;
type LockedRow = { stockQuantity: number; reservedQuantity: number; lowStockThreshold: number };

/**
 * Stock ledger. Every mutation runs inside a transaction that locks the
 * inventory row (`SELECT … FOR UPDATE`) and appends an immutable transaction
 * record, so concurrent operations can never oversell.
 *
 * Lifecycle of a sale:  reserve (checkout) → commitSale (payment verified)
 *                        └→ release (payment failed / order expired or cancelled)
 * A delivered order that comes back: returnStock.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  static toSnapshot(row: {
    variantId: string;
    stockQuantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
    updatedAt: Date;
  }): InventorySnapshot {
    const available = Math.max(0, row.stockQuantity - row.reservedQuantity);
    return {
      variantId: row.variantId,
      stockQuantity: row.stockQuantity,
      reservedQuantity: row.reservedQuantity,
      availableQuantity: available,
      lowStockThreshold: row.lowStockThreshold,
      lowStock: available <= row.lowStockThreshold,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async get(variantId: string): Promise<InventorySnapshot> {
    const row = await this.prisma.inventory.findUnique({ where: { variantId } });
    if (!row)
      throw new NotFoundAppException('INVENTORY_NOT_FOUND', 'موجودی برای این تنوع ثبت نشده است');
    return InventoryService.toSnapshot(row);
  }

  /** Ensures an inventory row exists for a variant (used on variant creation). */
  async ensure(tx: Tx, variantId: string, lowStockThreshold?: number): Promise<void> {
    await tx.inventory.upsert({
      where: { variantId },
      update: lowStockThreshold === undefined ? {} : { lowStockThreshold },
      create: { variantId, lowStockThreshold: lowStockThreshold ?? 5 },
    });
  }

  /** Locks and returns the inventory row for update inside `tx`. */
  async lock(tx: Tx, variantId: string): Promise<LockedRow> {
    const rows = await tx.$queryRaw<
      LockedRow[]
    >`SELECT stockQuantity, reservedQuantity, lowStockThreshold FROM inventory WHERE variantId = ${variantId} FOR UPDATE`;
    const row = rows[0];
    if (!row)
      throw new NotFoundAppException('INVENTORY_NOT_FOUND', 'موجودی برای این تنوع ثبت نشده است');
    return row;
  }

  /**
   * Reserves stock for every line atomically. Rows are locked in a stable
   * order (sorted by variant id) to avoid deadlocks between concurrent
   * checkouts. Throws InsufficientStockError when any line cannot be met.
   */
  async reserve(tx: Tx, lines: ReservationLine[], ref: ReservationReference): Promise<void> {
    const sorted = [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));
    const locked = new Map<string, LockedRow>();
    const shortages: InsufficientStockError['shortages'] = [];
    for (const line of sorted) {
      const row = await this.lock(tx, line.variantId);
      locked.set(line.variantId, row);
      const available = row.stockQuantity - row.reservedQuantity;
      if (line.quantity > available) {
        shortages.push({
          variantId: line.variantId,
          requested: line.quantity,
          available: Math.max(0, available),
        });
      }
    }
    if (shortages.length > 0) throw new InsufficientStockError(shortages);
    for (const line of sorted) {
      const row = locked.get(line.variantId)!;
      const reservedAfter = row.reservedQuantity + line.quantity;
      await tx.inventory.update({
        where: { variantId: line.variantId },
        data: { reservedQuantity: reservedAfter },
      });
      await this.ledger(
        tx,
        line.variantId,
        'RESERVATION',
        line.quantity,
        row.stockQuantity,
        reservedAfter,
        ref,
      );
    }
  }

  /** Releases a reservation (order cancelled/expired, payment failed). */
  async release(tx: Tx, lines: ReservationLine[], ref: ReservationReference): Promise<void> {
    for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const row = await this.lock(tx, line.variantId);
      const reservedAfter = Math.max(0, row.reservedQuantity - line.quantity);
      await tx.inventory.update({
        where: { variantId: line.variantId },
        data: { reservedQuantity: reservedAfter },
      });
      await this.ledger(
        tx,
        line.variantId,
        'RELEASE',
        -line.quantity,
        row.stockQuantity,
        reservedAfter,
        ref,
      );
    }
  }

  /** Converts a reservation into a sale: stock and reserved both decrease. */
  async commitSale(tx: Tx, lines: ReservationLine[], ref: ReservationReference): Promise<void> {
    for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const row = await this.lock(tx, line.variantId);
      const stockAfter = Math.max(0, row.stockQuantity - line.quantity);
      const reservedAfter = Math.max(0, row.reservedQuantity - line.quantity);
      await tx.inventory.update({
        where: { variantId: line.variantId },
        data: { stockQuantity: stockAfter, reservedQuantity: reservedAfter },
      });
      await this.ledger(tx, line.variantId, 'SALE', -line.quantity, stockAfter, reservedAfter, ref);
    }
  }

  /** Puts sold units back into stock (returned order). */
  async returnStock(tx: Tx, lines: ReservationLine[], ref: ReservationReference): Promise<void> {
    for (const line of [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const row = await this.lock(tx, line.variantId);
      const stockAfter = row.stockQuantity + line.quantity;
      await tx.inventory.update({
        where: { variantId: line.variantId },
        data: { stockQuantity: stockAfter },
      });
      await this.ledger(
        tx,
        line.variantId,
        'RETURN',
        line.quantity,
        stockAfter,
        row.reservedQuantity,
        ref,
      );
    }
  }

  /** Manual/purchase/return stock change with ledger entry. */
  async adjustStock(input: AdjustStockInput): Promise<InventorySnapshot> {
    if (!Number.isInteger(input.quantity) || input.quantity === 0) {
      throw new UnprocessableAppException(
        'INVENTORY_QUANTITY_INVALID',
        'مقدار تغییر باید عدد صحیح غیر صفر باشد',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await this.lock(tx, input.variantId);
      const stockAfter = current.stockQuantity + input.quantity;
      if (stockAfter < 0) {
        throw new UnprocessableAppException('INVENTORY_NEGATIVE', 'موجودی نمی‌تواند منفی شود');
      }
      if (stockAfter < current.reservedQuantity) {
        throw new UnprocessableAppException(
          'INVENTORY_BELOW_RESERVED',
          'موجودی نمی‌تواند کمتر از مقدار رزروشده باشد',
        );
      }
      const updated = await tx.inventory.update({
        where: { variantId: input.variantId },
        data: { stockQuantity: stockAfter },
      });
      await this.ledger(
        tx,
        input.variantId,
        input.type,
        input.quantity,
        stockAfter,
        current.reservedQuantity,
        {
          referenceType: input.referenceType ?? 'manual',
          referenceId: input.referenceId ?? '',
          note: input.note,
          actorId: input.actorId,
        },
      );
      return InventoryService.toSnapshot(updated);
    });
  }

  async setLowStockThreshold(variantId: string, threshold: number): Promise<InventorySnapshot> {
    const row = await this.prisma.inventory.update({
      where: { variantId },
      data: { lowStockThreshold: threshold },
    });
    return InventoryService.toSnapshot(row);
  }

  async transactions(
    variantId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      type: InventoryTransactionType;
      quantity: number;
      stockAfter: number;
      reservedAfter: number;
      referenceType: string | null;
      referenceId: string | null;
      note: string | null;
      actorId: string | null;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.inventoryTransaction.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      quantity: r.quantity,
      stockAfter: r.stockAfter,
      reservedAfter: r.reservedAfter,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      actorId: r.actorId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async ledger(
    tx: Tx,
    variantId: string,
    type: InventoryTransactionType,
    quantity: number,
    stockAfter: number,
    reservedAfter: number,
    ref: ReservationReference,
  ): Promise<void> {
    await tx.inventoryTransaction.create({
      data: {
        variantId,
        type,
        quantity,
        stockAfter,
        reservedAfter,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId || null,
        note: ref.note,
        actorId: ref.actorId,
      },
    });
  }
}
