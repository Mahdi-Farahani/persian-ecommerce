import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const ping = vi.fn<() => Promise<boolean>>();

  async function build(): Promise<HealthService> {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: { ping } }],
    }).compile();
    return moduleRef.get(HealthService);
  }

  beforeEach(() => {
    ping.mockReset();
  });

  it('reports liveness', async () => {
    const service = await build();
    const report = service.liveness();
    expect(report.status).toBe('ok');
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports ready when the database answers', async () => {
    ping.mockResolvedValue(true);
    const service = await build();
    const report = await service.readiness();
    expect(report.status).toBe('ok');
    expect(report.checks.database.status).toBe('up');
  });

  it('reports degraded when the database is down', async () => {
    ping.mockRejectedValue(new Error('connection refused'));
    const service = await build();
    const report = await service.readiness();
    expect(report.status).toBe('degraded');
    expect(report.checks.database.status).toBe('down');
    expect(report.checks.database.error).not.toContain('refused');
  });
});
