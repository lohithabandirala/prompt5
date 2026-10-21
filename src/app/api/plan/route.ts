import { NextRequest } from 'next/server';
import { ServerEventInputSchema } from '@/lib/schemas/event-input';
import { EventPlanSchema } from '@/lib/schemas/event-plan';
import { generateEventPlan, AIGenerationError } from '@/lib/ai/generate-plan';
import { isAiConfigured } from '@/lib/ai/client';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import { validateBudgetTotal, reconcileBudgetCategories } from '@/lib/budget/calculate';
import {
  validateRequestSize,
  safeParseJSON,
  validateWithSchema,
} from '@/lib/security/validate-request';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rate-limit';
import { jsonOk, jsonError, toErrorResponse, logMetric } from '@/lib/api/responses';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const rateCheck = checkRateLimit(getClientIdentifier(request.headers), 10, 60_000);
    if (!rateCheck.allowed) {
      return jsonError(
        'Too many plan requests. Please wait a minute and try again.',
        429,
        'RATE_LIMITED'
      );
    }

    const body = await request.text();
    validateRequestSize(body);
    const input = validateWithSchema(ServerEventInputSchema, safeParseJSON(body));

    if (!isAiConfigured()) {
      return jsonError(
        'The AI planner is not configured on this server. Add GEMINI_API_KEY to the server environment.',
        503,
        'NOT_CONFIGURED'
      );
    }

    const aiResponse = await generateEventPlan(input);
    const plan = buildPlanFromAI(aiResponse, input);

    // Defensive reconciliation: the allocation algorithm is deterministic and
    // already exact, but never return a plan whose budget does not balance.
    const budgetCheck = validateBudgetTotal(plan.budgetCategories, input.totalBudget, input.currency);
    if (!budgetCheck.valid) {
      plan.budgetCategories = reconcileBudgetCategories(
        plan.budgetCategories,
        input.totalBudget,
        input.currency
      );
    }

    // Final schema gate before anything leaves the server.
    const planValidation = EventPlanSchema.safeParse(plan);
    if (!planValidation.success) {
      throw new AIGenerationError(
        'The generated plan did not pass final validation. Please try again.',
        'SCHEMA_VALIDATION_FAILED',
        false
      );
    }

    logMetric('plan_generated', {
      latencyMs: Date.now() - startedAt,
      inputBytes: body.length,
      budgetCategories: plan.budgetCategories.length,
      timelineTasks: plan.timelineTasks.length,
      vendors: plan.vendorEntries.length,
      ideas: plan.celebrationIdeas.length,
      scheduleEntries: plan.eventDaySchedule.length,
      shortNotice: plan.timelineTasks.some((task) => task.daysBeforeEvent <= 14),
    });

    return jsonOk({ plan: planValidation.data });
  } catch (error) {
    logMetric('plan_generation_failed', {
      latencyMs: Date.now() - startedAt,
      code: error instanceof AIGenerationError ? error.code : 'INTERNAL_ERROR',
    });
    return toErrorResponse(error);
  }
}
