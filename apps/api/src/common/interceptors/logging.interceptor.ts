import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Structured access log: one line per request with method, path, status,
 * duration and the correlation id.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const startedAt = process.hrtime.bigint();

    const finish = (): void => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log({
        message: 'request',
        requestId: request.id,
        method: request.method,
        path: request.originalUrl,
        status: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    };

    return next.handle().pipe(tap({ next: finish, error: finish }));
  }
}
