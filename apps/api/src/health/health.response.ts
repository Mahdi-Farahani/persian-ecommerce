import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: 120 }) uptimeSeconds: number;
  @ApiProperty({ example: '2026-09-30T12:00:00.000Z' }) timestamp: string;
}

export class DatabaseCheckDto {
  @ApiProperty({ enum: ['up', 'down'] }) status: 'up' | 'down';
  @ApiProperty({ required: false }) latencyMs?: number;
  @ApiProperty({ required: false }) error?: string;
}

export class ReadinessChecksDto {
  @ApiProperty({ type: DatabaseCheckDto }) database: DatabaseCheckDto;
}

export class ReadinessResponseDto extends HealthResponseDto {
  @ApiProperty({ type: ReadinessChecksDto }) checks: ReadinessChecksDto;
}
