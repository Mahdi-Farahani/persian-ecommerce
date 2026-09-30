import { ConsoleLogger, Logger, type LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './config/app-config.service.js';

const LEVELS: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

function levelsUpTo(level: string): LogLevel[] {
  const index = LEVELS.indexOf(level as LogLevel);
  return LEVELS.slice(0, (index === -1 ? 3 : index) + 1);
}

async function bootstrap(): Promise<void> {
  const isProduction = process.env['NODE_ENV'] === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // JSON logs in production for log shippers; pretty logs in development.
    logger: new ConsoleLogger({
      json: isProduction,
      colors: !isProduction,
      logLevels: levelsUpTo(process.env['LOG_LEVEL'] ?? 'log'),
    }),
    bufferLogs: true,
  });

  configureApp(app);

  const config = app.get(AppConfigService);
  await app.listen(config.port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on port ${config.port} (prefix /${config.globalPrefix})`);
  if (config.swaggerEnabled) {
    logger.log('Swagger UI available at /api/docs');
  }
}

await bootstrap();
