import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma client wired to MariaDB through the official driver adapter.
 * A single instance is shared across the application (connection pooling is
 * handled by the mariadb connector).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: AppConfigService) {
    const url = new URL(config.databaseUrl);
    const adapter = new PrismaMariaDb({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      connectionLimit: Number(url.searchParams.get('connection_limit') ?? 10),
      timezone: 'Z',
      allowPublicKeyRetrieval: true,
      // MariaDB 11 enables innodb_snapshot_isolation: under REPEATABLE READ a
      // `SELECT … FOR UPDATE` issued after an earlier read in the same
      // transaction fails with error 1020 when the row changed meanwhile.
      // Our write paths rely on row locks, so sessions run READ COMMITTED.
      initSql: [`SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED`],
    });
    super({
      adapter,
      log: config.isProduction ? ['error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight liveness probe used by the readiness endpoint. */
  async ping(): Promise<boolean> {
    await this.$queryRaw`SELECT 1`;
    return true;
  }
}
