import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Domain-level exception carrying a stable machine-readable error code.
 * All API errors are rendered as:
 * { success: false, error: { code, message, details? } }
 */
export class AppException extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export class NotFoundAppException extends AppException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

export class ConflictAppException extends AppException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(code = 'FORBIDDEN', message = 'دسترسی غیرمجاز', details?: unknown) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

export class UnauthorizedAppException extends AppException {
  constructor(code = 'UNAUTHORIZED', message = 'احراز هویت لازم است', details?: unknown) {
    super(code, message, HttpStatus.UNAUTHORIZED, details);
  }
}

export class UnprocessableAppException extends AppException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
