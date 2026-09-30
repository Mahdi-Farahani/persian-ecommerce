import {
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Seconds a public catalogue response may be reused by browsers and CDNs. */
export const PUBLIC_CACHE_SECONDS = 60;
const STALE_WHILE_REVALIDATE_SECONDS = 300;

/** Sets short public cache headers on successful anonymous GET responses. */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  constructor(private readonly maxAge: number = PUBLIC_CACHE_SECONDS) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method: string; headers: Record<string, unknown> }>();
    const response = http.getResponse<Response>();
    return next.handle().pipe(
      tap(() => {
        // Only anonymous GETs are shared; authenticated calls to the same
        // routes (optional auth) must never be cached by intermediaries.
        if (
          request.method !== 'GET' ||
          request.headers['authorization'] ||
          request.headers['cookie']
        ) {
          return;
        }
        response.setHeader(
          'Cache-Control',
          `public, max-age=${this.maxAge}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`,
        );
        response.setHeader('Vary', 'Accept-Encoding');
      }),
    );
  }
}

/**
 * Marks a controller (or handler) whose GET output does not depend on the
 * caller as cacheable. Works at class and method level.
 */
export function PublicCache(maxAge = PUBLIC_CACHE_SECONDS): MethodDecorator & ClassDecorator {
  return applyDecorators(UseInterceptors(new PublicCacheInterceptor(maxAge)));
}
