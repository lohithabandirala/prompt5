import { z } from 'zod';

const MAX_REQUEST_BODY_SIZE = 50 * 1024; // 50KB

/**
 * Validate that the request body isn't too large.
 */
export function validateRequestSize(body: string): void {
  if (body.length > MAX_REQUEST_BODY_SIZE) {
    throw new ValidationError(
      `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE} bytes.`,
      'REQUEST_TOO_LARGE'
    );
  }
}

/**
 * Safely parse JSON from request body.
 */
export function safeParseJSON(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new ValidationError('Invalid JSON in request body.', 'INVALID_JSON');
  }
}

/**
 * Validate request data against a Zod schema.
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError(
      `Validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
      'VALIDATION_FAILED',
      errors
    );
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fieldErrors?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitize a URL: only allow http/https protocols.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Strip potential XSS from text content.
 * React already escapes by default, but this provides extra defense.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
