import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import { STORAGE_PROVIDER } from './storage.provider.js';
import { StorageService } from './storage.service.js';
import { UploadsController } from './uploads.controller.js';

/**
 * Only the local-disk provider exists today. An S3-compatible provider can be
 * returned from the factory below without touching any business module.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new LocalStorageProvider(config.uploadsDir, '/uploads'),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
