import { NextResponse } from 'next/server';
import { ValidationError } from '../security/validate-request';
import { AIGenerationError } from '../ai/generate-plan';

/**
 * Response headers applied to every API response. Global security headers are
 * configured in next.config.ts; these cover the dynamic API surface too.
 */
export const API_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
};

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: API_SECURITY_HEADERS });
}

export function jsonError(
  message: string,
  status: number,
  code: string,
  fieldErrors?: Array<{ path: string; message: string }>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      code,
      ...(fieldErrors && fieldErrors.length > 0 ? { fieldErrors } : {}),
    },
    { status, headers: API_SECURITY_HEADERS }
  );
}

/**
 * Map internal errors to controlled client errors. Provider diagnostics,
 * stack traces, prompts and credentials are never included in the response.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return jsonError(
      error.message,
      error.code === 'REQUEST_TOO_LARGE' ? 413 : 400,
      error.code,
      error.fieldErrors
    );
  }

  if (error instanceof AIGenerationError) {
    const statusByCode: Record<string, number> = {
      NOT_CONFIGURED: 503,
      AUTH_FAILED: 503,
      RATE_LIMITED: 429,
      TIMEOUT: 504,
      UNAVAILABLE: 502,
      EMPTY_RESPONSE: 502,
      INVALID_JSON: 502,
      SCHEMA_VALIDATION_FAILED: 502,
      GENERATION_FAILED: 502,
    };
    return jsonError(error.message, statusByCode[error.code] ?? 502, error.code);
  }

  return jsonError('An unexpected error occurred. Please try again.', 500, 'INTERNAL_ERROR');
}

/**
 * Structured operational metric. Deliberately excludes event notes, locations
 * and any other user content.
 */
export function logMetric(event: string, fields: Record<string, number | string | boolean>): void {
  try {
    console.info(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }));
  } catch {
    // Metrics must never break a request.
  }
}
