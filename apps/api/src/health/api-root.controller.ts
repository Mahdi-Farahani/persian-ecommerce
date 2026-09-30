import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { AppConfigService } from '../config/app-config.service.js';

export interface ApiRootInfo {
  name: string;
  version: string;
  status: 'ok';
  docs: string | null;
  health: string;
  readiness: string;
}

/** `GET /api/v1` — discovery endpoint used by deployment smoke checks. */
@ApiTags('health')
@Public()
@Controller()
export class ApiRootController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: 'API identity and links' })
  info(): ApiRootInfo {
    return {
      name: 'persian-ecommerce-api',
      version: process.env['npm_package_version'] ?? '0.1.0',
      status: 'ok',
      docs: this.config.swaggerEnabled ? '/api/docs' : null,
      health: '/health',
      readiness: '/health/ready',
    };
  }
}
