import { NextRequest } from 'next/server';
import { z } from 'zod';
import { EventInputSchema } from '@/lib/schemas/event-input';
import {
  RegenerateResultSchemas,
  RegenerateSectionSchema,
  type RegenerateResults,
  type RegenerateSection,
} from '@/lib/schemas/event-plan';
import { regenerateSection, AIGenerationError } from '@/lib/ai/generate-plan';
import { isAiConfigured } from '@/lib/ai/client';
import { buildRegeneratedPayload } from '@/lib/plan/build-plan';
import {
  validateRequestSize,
  safeParseJSON,
  validateWithSchema,
} from '@/lib/security/validate-request';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rate-limit';
import { jsonOk, jsonError, toErrorResponse, logMetric } from '@/lib/api/responses';

export const maxDuration = 60;

const RegenerateRequestSchema = z
  .object({
    section: RegenerateSectionSchema,
    input: EventInputSchema,
    currentSummary: z.string().max(2000).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const rateCheck = checkRateLimit(getClientIdentifier(request.headers), 10, 60_000);
    if (!rateCheck.allowed) {
      return jsonError('Too many regeneration requests. Please wait and try again.', 429, 'RATE_LIMITED');
    }

    const body = await request.text();
    validateRequestSize(body);
    const { section, input, currentSummary } = validateWithSchema(
      RegenerateRequestSchema,
      safeParseJSON(body)
    );

    if (!isAiConfigured()) {
      return jsonError(
        'The AI planner is not configured on this server. Add GEMINI_API_KEY to the server environment.',
        503,
        'NOT_CONFIGURED'
      );
    }

    const rawResult = await regenerateSection(section, input, currentSummary);

    // Re-validate the section output against its exact schema. This is the
    // boundary that prevents unvalidated model data from entering the plan.
    const sectionSchema = RegenerateResultSchemas[section as RegenerateSection];
    const parsed = sectionSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new AIGenerationError(
        'The AI returned an invalid section. No changes were applied.',
        'SCHEMA_VALIDATION_FAILED',
        false
      );
    }

    const payload = buildRegeneratedPayload(
      section,
      parsed.data as RegenerateResults[RegenerateSection],
      input
    );

    logMetric('plan_section_regenerated', {
      latencyMs: Date.now() - startedAt,
      inputBytes: body.length,
      section,
    });

    return jsonOk(payload);
  } catch (error) {
    logMetric('plan_regeneration_failed', {
      latencyMs: Date.now() - startedAt,
      code: error instanceof AIGenerationError ? error.code : 'INTERNAL_ERROR',
    });
    return toErrorResponse(error);
  }
}
