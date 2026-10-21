import { getModel } from './client';
import { buildSystemPrompt, buildPlanPrompt, buildRegeneratePrompt } from './prompts';
import {
  AIPlanResponseSchema,
  RegenerateResultSchemas,
  type AIPlanResponse,
  type RegenerateSection,
} from '../schemas/event-plan';
import type { EventInput } from '../schemas/event-input';

/** One retry for recoverable format failures. Never loops indefinitely. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

export type AIGenerationErrorCode =
  | 'NOT_CONFIGURED'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'UNAVAILABLE'
  | 'EMPTY_RESPONSE'
  | 'INVALID_JSON'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'GENERATION_FAILED';

export class AIGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: AIGenerationErrorCode,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIGenerationError';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract a JSON object from model output, tolerating markdown code fences
 * and leading/trailing prose. The result is still untrusted and must be
 * validated by the caller.
 */
export function extractJsonObject(text: string): unknown {
  const withoutFences = text
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstBrace = withoutFences.indexOf('{');
  const lastBrace = withoutFences.lastIndexOf('}');
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? withoutFences.slice(firstBrace, lastBrace + 1)
      : withoutFences;

  return JSON.parse(candidate);
}

function mapProviderError(error: unknown): AIGenerationError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  // Parse the HTTP status from messages such as
  // "[500 Internal Server Error] ...". Substring matching on "401" is unsafe
  // because a base URL like http://127.0.0.1:4010 contains that sequence.
  const statusMatch = /(?:^|\[|\s)(\d{3})(?=\s|\])/.exec(message);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('deadline')) {
    return new AIGenerationError(
      'The AI request timed out. Please try again.',
      'TIMEOUT',
      true
    );
  }
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
    return new AIGenerationError(
      'The AI service is busy right now. Please wait a moment and try again.',
      'RATE_LIMITED',
      true
    );
  }
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api key') ||
    lower.includes('permission')
  ) {
    return new AIGenerationError(
      'The AI service credential was rejected. Check the server configuration.',
      'AUTH_FAILED',
      false
    );
  }
  if (status !== undefined && status >= 500 && status <= 599) {
    return new AIGenerationError(
      'The AI service is temporarily unavailable. Please try again shortly.',
      'UNAVAILABLE',
      true
    );
  }

  return new AIGenerationError(
    'The AI service could not complete the request. Please try again.',
    'GENERATION_FAILED',
    false
  );
}

interface ModelCallOptions {
  temperature?: number;
}

/**
 * Call the model once, applying a hard timeout and separating the trusted
 * system instruction from untrusted user content.
 */
async function callModel(userPrompt: string, options: ModelCallOptions = {}): Promise<string> {
  const model = getModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: buildSystemPrompt() }] },
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          responseMimeType: 'application/json',
        },
      },
      { signal: controller.signal, timeout: 25_000 }
    );

    const text = result.response.text();
    if (!text || text.trim().length === 0) {
      throw new AIGenerationError(
        'The AI returned an empty response. Please try again.',
        'EMPTY_RESPONSE',
        true
      );
    }
    return text;
  } catch (error) {
    if (error instanceof AIGenerationError) throw error;
    throw mapProviderError(error);
  } finally {
    clearTimeout(timeout);
  }
}

async function generateValidated<T>(
  prompt: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  options: ModelCallOptions = {}
): Promise<T> {
  let lastError: AIGenerationError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);

    let text: string;
    try {
      text = await callModel(prompt, options);
    } catch (error) {
      if (
        error instanceof AIGenerationError &&
        error.retryable &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        lastError = error;
        continue;
      }
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch {
      lastError = new AIGenerationError(
        'The AI returned a response that was not valid JSON. Please try again.',
        'INVALID_JSON',
        true
      );
      continue;
    }

    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      lastError = new AIGenerationError(
        'The AI response did not match the required plan format. Please try again.',
        'SCHEMA_VALIDATION_FAILED',
        true
      );
      continue;
    }

    return validation.data;
  }

  throw lastError ?? new AIGenerationError(
    'The AI could not produce a valid plan. Please try again.',
    'GENERATION_FAILED',
    false
  );
}

/**
 * Generate a full event plan using the configured provider.
 * Throws AIGenerationError on any failure — there is no fabricated fallback.
 */
export async function generateEventPlan(input: EventInput): Promise<AIPlanResponse> {
  return generateValidated(buildPlanPrompt(input), AIPlanResponseSchema);
}

/**
 * Regenerate a single plan section. The response is validated against a
 * section-specific schema before it reaches the API route.
 */
export async function regenerateSection(
  section: RegenerateSection,
  input: EventInput,
  currentSummary?: string
): Promise<unknown> {
  const prompt = buildRegeneratePrompt(section, input, currentSummary);
  const options = { temperature: 0.85 };

  switch (section) {
    case 'budget':
      return generateValidated(prompt, RegenerateResultSchemas.budget, options);
    case 'timeline':
      return generateValidated(prompt, RegenerateResultSchemas.timeline, options);
    case 'vendors':
      return generateValidated(prompt, RegenerateResultSchemas.vendors, options);
    case 'ideas':
      return generateValidated(prompt, RegenerateResultSchemas.ideas, options);
    case 'schedule':
      return generateValidated(prompt, RegenerateResultSchemas.schedule, options);
    case 'theme':
      return generateValidated(prompt, RegenerateResultSchemas.theme, options);
  }
}
