import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RbacModule } from './rbac/rbac.module.js';
import { UsersModule } from './users/users.module.js';

const ONE_MINUTE_MS = 60_000;
const DEFAULT_REQUESTS_PER_MINUTE = 300;

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: ONE_MINUTE_MS, limit: DEFAULT_REQUESTS_PER_MINUTE }],
        skipIf: () => config.throttleDisabled,
      }),
    }),
    AuditModule,
    NotificationsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    RbacModule,
  ],
  providers: [
    // Throttling runs first so abusive traffic is rejected before auth work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
