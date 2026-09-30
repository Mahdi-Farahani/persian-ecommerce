import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { LoggerNotificationProvider } from './logger-notification.provider.js';
import { NOTIFICATION_PROVIDER } from './notification.provider.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Provider selection happens here. Only the logging transport exists today;
 * an SMTP or SMS-gateway provider plugs in by implementing
 * NotificationProvider and being returned from this factory.
 */
@Global()
@Module({
  providers: [
    {
      provide: NOTIFICATION_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new LoggerNotificationProvider(!config.isProduction),
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
