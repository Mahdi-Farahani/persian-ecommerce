import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness endpoint for the web container (used by Docker health checks). */
export function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
