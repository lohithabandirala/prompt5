import { NextResponse } from 'next/server';
import { isAiConfigured, resolveModelName } from '@/lib/ai/client';

/**
 * Public capability probe. Exposes only whether a server credential exists —
 * never the credential itself.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      aiConfigured: isAiConfigured(),
      model: resolveModelName(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
