import type { GenerationConfig } from '@google/generative-ai';
import {
  getModel,
  MODEL_REQUEST_TIMEOUT_MS,
  THINKING_CONFIG,
  type FestivaGenerationConfig,
} from './client';
import {
  buildSystemPrompt,
  buildPlanCorePrompt,
  buildPlanOperationsPrompt,
  buildRegeneratePrompt,
} from './prompts';
import {
  AIPlanResponseSchema,
  AIPlanCoreSchema,
  AIPlanOperationsSchema,
  RegenerateResultSchemas,
  type AIPlanResponse,
  type RegenerateSection,
} from '../schemas/event-plan';
import type { EventInput } from '../schemas/event-input';

/** One retry for recoverable format failures. Never loops indefinitely. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

/**
 * Leave a small margin below the route's 60s serverless limit for request
 * parsing, plan assembly and the final response. A retry is only attempted
 * when there is enough of this budget left for a meaningful second call.
 */
const GENERATION_BUDGET_MS = 55_000;
const MIN_ATTEMPT_MS = 5_000;
const MIN_RETRY_BUDGET_MS = 10_000;

export type AIGenerationErrorCode =
  | 'NOT_CONFIGURED'
  | 'MODEL_UNAVAILABLE'
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
    status === 404 ||
    (lower.includes('model') &&
      (lower.includes('not found') ||
        lower.includes('not supported') ||
        lower.includes('deprecated') ||
        lower.includes('no longer available')))
  ) {
    return new AIGenerationError(
      'The configured AI model is unavailable. Update GEMINI_MODEL to a supported model and redeploy.',
      'MODEL_UNAVAILABLE',
      false
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
async function callModel(
  userPrompt: string,
  options: ModelCallOptions = {},
  timeoutMs: number = MODEL_REQUEST_TIMEOUT_MS
): Promise<string> {
  const model = getModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: buildSystemPrompt() }] },
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          responseMimeType: 'application/json',
          thinkingConfig: THINKING_CONFIG,
        } as FestivaGenerationConfig as GenerationConfig,
      },
      { signal: controller.signal, timeout: timeoutMs }
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
  const startedAt = Date.now();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);

    const remaining = GENERATION_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS) {
      throw lastError ?? new AIGenerationError(
        'The AI request ran out of time. Please try again.',
        'TIMEOUT',
        false
      );
    }

    let text: string;
    try {
      text = await callModel(prompt, options, Math.min(MODEL_REQUEST_TIMEOUT_MS, remaining));
    } catch (error) {
      if (
        error instanceof AIGenerationError &&
        error.retryable &&
        attempt < MAX_ATTEMPTS - 1 &&
        GENERATION_BUDGET_MS - (Date.now() - startedAt) > MIN_RETRY_BUDGET_MS
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
  // Wait for both halves even if one fails so no provider request is left
  // running after the API has already returned an error.
  const [coreResult, operationsResult] = await Promise.allSettled([
    generateValidated(buildPlanCorePrompt(input), AIPlanCoreSchema),
    generateValidated(buildPlanOperationsPrompt(input), AIPlanOperationsSchema),
  ]);

  if (coreResult.status === 'rejected') throw coreResult.reason;
  if (operationsResult.status === 'rejected') throw operationsResult.reason;

  const merged = AIPlanResponseSchema.safeParse({
    ...coreResult.value,
    ...operationsResult.value,
  });
  if (!merged.success) {
    throw new AIGenerationError(
      'The AI response did not match the required plan format. Please try again.',
      'SCHEMA_VALIDATION_FAILED',
      true
    );
  }

  return merged.data;
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
