import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface LivenessReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessReport extends Omit<LivenessReport, 'status'> {
  status: 'ok' | 'degraded';
  checks: {
    database: { status: 'up' | 'down'; latencyMs?: number; error?: string };
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  liveness(): LivenessReport {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    const base = this.liveness();
    const startedAt = Date.now();
    try {
      await this.prisma.ping();
      return {
        ...base,
        checks: { database: { status: 'up', latencyMs: Date.now() - startedAt } },
      };
    } catch (error) {
      this.logger.error(`Database readiness check failed: ${(error as Error).message}`);
      return {
        ...base,
        status: 'degraded',
        checks: { database: { status: 'down', error: 'database unreachable' } },
      };
    }
  }
}
