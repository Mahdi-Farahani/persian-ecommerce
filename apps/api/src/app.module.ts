import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AttributesModule } from './attributes/attributes.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { BrandsModule } from './brands/brands.module.js';
import { CartModule } from './cart/cart.module.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { ShippingModule } from './shipping/shipping.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ProductsModule } from './products/products.module.js';
import { StorageModule } from './storage/storage.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SearchModule } from './search/search.module.js';
import { WishlistModule } from './wishlist/wishlist.module.js';
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
    StorageModule,
    BrandsModule,
    CategoriesModule,
    AttributesModule,
    InventoryModule,
    ProductsModule,
    PricingModule,
    CouponsModule,
    ShippingModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    SearchModule,
    ReviewsModule,
    WishlistModule,
    AdminModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Throttling runs first so abusive traffic is rejected before auth work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
