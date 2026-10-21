import { NextResponse } from 'next/server';
import { isAiConfigured, DEFAULT_MODEL } from '@/lib/ai/client';

/**
 * Public capability probe. Exposes only whether a server credential exists —
 * never the credential itself.
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      aiConfigured: isAiConfigured(),
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
