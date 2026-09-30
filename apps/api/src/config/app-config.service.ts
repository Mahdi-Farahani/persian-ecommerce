import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables, LogLevel, NodeEnvironment } from './env.validation.js';

/**
 * Typed facade over ConfigService so modules never read raw process.env.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get nodeEnv(): NodeEnvironment {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnvironment.Production;
  }

  get isTest(): boolean {
    return this.nodeEnv === NodeEnvironment.Test;
  }

  get port(): number {
    return this.config.get('API_PORT', { infer: true });
  }

  get globalPrefix(): string {
    return this.config.get('API_GLOBAL_PREFIX', { infer: true }).replace(/^\/+|\/+$/g, '');
  }

  get appUrl(): string {
    return this.config.get('APP_URL', { infer: true }).replace(/\/+$/g, '');
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get swaggerEnabled(): boolean {
    const explicit = this.config.get('SWAGGER_ENABLED', { infer: true });
    return explicit ?? !this.isProduction;
  }

  get logLevel(): LogLevel {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get trustProxy(): boolean {
    return this.config.get('TRUST_PROXY', { infer: true });
  }
}
