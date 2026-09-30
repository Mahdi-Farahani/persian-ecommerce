import type { ApiErrorBody } from '@pe/shared';

/** Error thrown by the API client for non-2xx responses. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromBody(status: number, body: unknown): ApiError {
    if (isApiErrorBody(body)) {
      return new ApiError(status, body.error.code, body.error.message, body.error.details);
    }
    return new ApiError(status, `HTTP_${status}`, 'خطا در ارتباط با سرور');
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Field-level validation messages when the API returned them. */
  get validationMessages(): string[] {
    return Array.isArray(this.details)
      ? this.details.filter((d): d is string => typeof d === 'string')
      : [];
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { success?: unknown; error?: { code?: unknown; message?: unknown } };
  return (
    candidate.success === false &&
    typeof candidate.error === 'object' &&
    candidate.error !== null &&
    typeof candidate.error.code === 'string' &&
    typeof candidate.error.message === 'string'
  );
}
