import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/auth.decorators.js';
import { UnprocessableAppException } from '../common/errors/app.exception.js';
import { Permissions } from '../rbac/permissions.js';
import { MAX_IMAGE_BYTES, StorageService, type ImageUploadResult } from './storage.service.js';

export class UploadedImageDto implements ImageUploadResult {
  @ApiProperty() key: string;
  @ApiProperty() url: string;
  @ApiProperty() size: number;
  @ApiProperty() contentType: string;
  @ApiProperty() width: number;
  @ApiProperty() height: number;
}

@ApiTags('admin/uploads')
@ApiBearerAuth('access-token')
@ApiCookieAuth('pe_access')
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @RequirePermissions(Permissions.CatalogManage)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a product/category image (re-encoded as WebP)' })
  @ApiCreatedResponse({ type: UploadedImageDto })
  async uploadImage(@UploadedFile() file?: Express.Multer.File): Promise<UploadedImageDto> {
    if (!file) {
      throw new UnprocessableAppException('FILE_MISSING', 'فایلی ارسال نشده است');
    }
    return this.storage.storeImage(file.buffer, 'catalog');
  }
}
