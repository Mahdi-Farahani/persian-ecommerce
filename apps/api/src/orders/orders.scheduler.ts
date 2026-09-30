import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service.js';

/**
 * Background housekeeping for orders. Runs in-process; with several API
 * replicas the expiry is idempotent (each order is re-checked in its own
 * transaction), so duplicate runs are harmless.
 */
@Injectable()
export class OrdersScheduler {
  private readonly logger = new Logger(OrdersScheduler.name);
  private running = false;

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireUnpaidOrders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.orders.expireUnpaid();
    } catch (error) {
      this.logger.error(`Order expiry job failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
