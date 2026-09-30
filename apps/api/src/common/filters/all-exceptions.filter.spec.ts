import {
  type ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function hostWith(): {
  host: ArgumentsHost;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ id: 'req-1', method: 'GET', originalUrl: '/x' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('renders AppException with its code', () => {
    const { host, status, json } = hostWith();
    new AllExceptionsFilter(false).catch(
      new AppException('PRODUCT_NOT_FOUND', 'Product not found', HttpStatus.NOT_FOUND),
      host,
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found', details: undefined },
    });
  });

  it('renders validation errors with details', () => {
    const { host, status, json } = hostWith();
    new AllExceptionsFilter(false).catch(
      new BadRequestException(['email must be an email', 'password too short']),
      host,
    );
    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0]?.[0] as { error: { code: string; details: string[] } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toHaveLength(2);
  });

  it('maps standard http exceptions to generic codes', () => {
    const { host, json } = hostWith();
    new AllExceptionsFilter(false).catch(new NotFoundException('missing'), host);
    const body = json.mock.calls[0]?.[0] as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('hides internal error messages in production mode', () => {
    const { host, status, json } = hostWith();
    new AllExceptionsFilter(false).catch(new Error('secret database detail'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('secret');
  });
});
