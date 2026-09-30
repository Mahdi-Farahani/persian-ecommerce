import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ApiErrorCode, type ApiErrorBody } from '@pe/shared';
import type { Request, Response } from 'express';
import { AppException } from '../errors/app.exception.js';

interface NestErrorPayload {
  message?: string | string[];
  error?: string;
  code?: string;
  details?: unknown;
}

const SERVER_ERROR_THRESHOLD = 500;

const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ApiErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ApiErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ApiErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ApiErrorCode.CONFLICT,
  [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RATE_LIMITED,
};

/**
 * Converts every thrown error into the documented error envelope and
 * guarantees stack traces never leak to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly exposeInternalErrors: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { status, body } = this.normalize(exception);

    if (status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error({
        message: 'Unhandled exception',
        requestId: request.id,
        method: request.method,
        path: request.originalUrl,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; body: ApiErrorBody } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          success: false,
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          success: false,
          error: {
            code: ApiErrorCode.RATE_LIMITED,
            message: 'تعداد درخواست‌ها بیش از حد مجاز است',
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const parsed: NestErrorPayload = typeof payload === 'string' ? { message: payload } : payload;
      const messages = Array.isArray(parsed.message) ? parsed.message : undefined;
      const message = Array.isArray(parsed.message)
        ? 'اطلاعات ارسال‌شده معتبر نیست'
        : (parsed.message ?? exception.message);
      return {
        status,
        body: {
          success: false,
          error: {
            code: parsed.code ?? STATUS_CODES[status] ?? `HTTP_${status}`,
            message,
            details: messages ?? parsed.details,
          },
        },
      };
    }

    const message =
      this.exposeInternalErrors && exception instanceof Error
        ? exception.message
        : 'خطای داخلی سرور';
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { success: false, error: { code: ApiErrorCode.INTERNAL_ERROR, message } },
    };
  }
}
