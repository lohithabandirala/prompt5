import { calculateBudgetAllocations } from '../budget/calculate';
import {
  calculateDueDates,
  normalizeTasksForShortNotice,
  resolveDependencies,
  sortScheduleEntries,
  sortTasks,
  subtractDays,
} from '../timeline/schedule';
import type {
  AIPlanResponse,
  BudgetCategory,
  CelebrationIdea,
  EventPlan,
  RegenerateResults,
  ScheduleEntry,
  TimelineTask,
  VendorEntry,
} from '../schemas/event-plan';
import type { EventInput } from '../schemas/event-input';

let fallbackIdCounter = 0;

function createUuid(): string {
  const globalCrypto = globalThis.crypto;

  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }

  // Non-cryptographic fallback for runtimes without Web Crypto. These ids are
  // only used for local React keys and local storage records, never for
  // authentication or security decisions.
  fallbackIdCounter = (fallbackIdCounter + 1) % 0xffff;
  const random = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  const counter = fallbackIdCounter.toString(16).padStart(4, '0');
  return `${Date.now().toString(16)}-${counter}-${random}-0000`;
}

function shortId(): string {
  return createUuid().slice(0, 8);
}

export function normalizeBudget(
  categories: RegenerateResults['budget']['budgetCategories'],
  input: EventInput
): BudgetCategory[] {
  return calculateBudgetAllocations(input.totalBudget, input.currency, categories);
}

export function normalizeTimeline(
  tasks: RegenerateResults['timeline']['timelineTasks'],
  input: EventInput
): TimelineTask[] {
  const ids = tasks.map((_, index) => `task-${index}-${shortId()}`);

  const withDependencies = resolveDependencies(
    tasks.map((task) => ({
      ...task,
      daysBeforeEvent: Math.max(0, Math.round(task.daysBeforeEvent)),
      status: 'not_started' as const,
      dependsOnTitles: task.dependsOn ?? [],
    })),
    ids
  );

  const dated = calculateDueDates(
    withDependencies.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      phase: task.phase,
      daysBeforeEvent: task.daysBeforeEvent,
      priority: task.priority,
      status: 'not_started' as const,
      dependsOn: task.dependsOn,
    })),
    input.eventDate
  );

  return sortTasks(normalizeTasksForShortNotice(dated, input.eventDate));
}

export function normalizeVendors(
  vendors: RegenerateResults['vendors']['vendorEntries'],
  input: EventInput
): VendorEntry[] {
  return vendors.map((vendor, index) => ({
    id: `vendor-${index}-${shortId()}`,
    category: vendor.category,
    importance: vendor.importance,
    sourcingDeadline:
      vendor.daysBeforeEventDeadline !== undefined
        ? subtractDays(input.eventDate, vendor.daysBeforeEventDeadline)
        : undefined,
    questionsToAsk: vendor.questionsToAsk,
    budgetRange: vendor.budgetRange,
    requiredDeliverables: vendor.requiredDeliverables,
    checklist: vendor.checklistItems?.map((item) => ({ item, completed: false })),
    status: 'researching' as const,
    backupPlan: vendor.backupPlan,
  }));
}

export function normalizeIdeas(
  ideas: RegenerateResults['ideas']['celebrationIdeas']
): CelebrationIdea[] {
  return ideas.map((idea, index) => ({
    id: `idea-${index}-${shortId()}`,
    title: idea.title,
    description: idea.description,
    whyItFits: idea.whyItFits,
    expenseCategories: idea.expenseCategories,
    implementationSteps: idea.implementationSteps,
    estimatedCost: idea.estimatedCost,
    tradeoffs: idea.tradeoffs,
    saved: false,
  }));
}

export function normalizeSchedule(
  entries: RegenerateResults['schedule']['eventDaySchedule']
): ScheduleEntry[] {
  const withIds = entries.map((entry, index) => ({
    id: `schedule-${index}-${shortId()}`,
    time: entry.time,
    endTime: entry.endTime,
    activity: entry.activity,
    description: entry.description,
    responsible: entry.responsible,
    location: entry.location,
  }));

  return sortScheduleEntries(withIds);
}

/**
 * Assemble a complete, schema-shaped plan from validated model output and the
 * user's input. All identifiers, dates and monetary amounts are produced here,
 * never trusted from the model.
 */
export function buildPlanFromAI(ai: AIPlanResponse, input: EventInput): EventPlan {
  const now = new Date().toISOString();

  return {
    id: `plan-${createUuid()}`,
    createdAt: now,
    updatedAt: now,
    eventName: ai.eventName,
    eventSummary: ai.eventSummary,
    recommendedTheme: ai.recommendedTheme,
    themeExplanation: ai.themeExplanation,
    decorationIdeas: ai.decorationIdeas,
    venueIdeas: ai.venueIdeas,
    entertainmentSuggestions: ai.entertainmentSuggestions,
    foodConcepts: ai.foodConcepts,
    guestEngagement: ai.guestEngagement,
    budgetCategories: normalizeBudget(ai.budgetCategories, input),
    budgetAllocationRationale: ai.budgetAllocationRationale,
    timelineTasks: normalizeTimeline(ai.timelineTasks, input),
    vendorEntries: normalizeVendors(ai.vendorEntries, input),
    celebrationIdeas: normalizeIdeas(ai.celebrationIdeas),
    eventDaySchedule: normalizeSchedule(ai.eventDaySchedule),
    contingencyPlans: ai.contingencyPlans,
    assumptions: ai.assumptions,
    unresolvedQuestions: ai.unresolvedQuestions,
  };
}

/**
 * Normalized payload returned by the regeneration route. Only the requested
 * section is present and every entry is already typed, costed and dated.
 */
export type RegeneratedSectionPayload =
  | {
      section: 'budget';
      result: {
        budgetCategories: BudgetCategory[];
        budgetAllocationRationale?: string;
      };
    }
  | { section: 'timeline'; result: { timelineTasks: TimelineTask[] } }
  | { section: 'vendors'; result: { vendorEntries: VendorEntry[] } }
  | { section: 'ideas'; result: { celebrationIdeas: CelebrationIdea[] } }
  | { section: 'schedule'; result: { eventDaySchedule: ScheduleEntry[] } }
  | {
      section: 'theme';
      result: {
        eventName: string;
        recommendedTheme: string;
        themeExplanation: string;
        decorationIdeas?: string;
        venueIdeas?: string;
        entertainmentSuggestions?: string;
        foodConcepts?: string;
        guestEngagement?: string;
      };
    };

export function buildRegeneratedPayload(
  section: keyof RegenerateResults,
  raw: RegenerateResults[keyof RegenerateResults],
  input: EventInput
): RegeneratedSectionPayload {
  switch (section) {
    case 'budget': {
      const data = raw as RegenerateResults['budget'];
      return {
        section: 'budget',
        result: {
          budgetCategories: normalizeBudget(data.budgetCategories, input),
          budgetAllocationRationale: data.budgetAllocationRationale,
        },
      };
    }
    case 'timeline':
      return {
        section: 'timeline',
        result: { timelineTasks: normalizeTimeline((raw as RegenerateResults['timeline']).timelineTasks, input) },
      };
    case 'vendors':
      return {
        section: 'vendors',
        result: { vendorEntries: normalizeVendors((raw as RegenerateResults['vendors']).vendorEntries, input) },
      };
    case 'ideas':
      return {
        section: 'ideas',
        result: { celebrationIdeas: normalizeIdeas((raw as RegenerateResults['ideas']).celebrationIdeas) },
      };
    case 'schedule':
      return {
        section: 'schedule',
        result: { eventDaySchedule: normalizeSchedule((raw as RegenerateResults['schedule']).eventDaySchedule) },
      };
    case 'theme': {
      const data = raw as RegenerateResults['theme'];
      return {
        section: 'theme',
        result: {
          eventName: data.eventName,
          recommendedTheme: data.recommendedTheme,
          themeExplanation: data.themeExplanation,
          decorationIdeas: data.decorationIdeas,
          venueIdeas: data.venueIdeas,
          entertainmentSuggestions: data.entertainmentSuggestions,
          foodConcepts: data.foodConcepts,
          guestEngagement: data.guestEngagement,
        },
      };
    }
  }
}
