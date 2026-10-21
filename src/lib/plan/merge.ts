import type {
  BudgetCategory,
  CelebrationIdea,
  EventPlan,
  ScheduleEntry,
  TimelineTask,
  VendorEntry,
} from '../schemas/event-plan';
import type { RegeneratedSectionPayload } from './build-plan';

function key(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * When a section is regenerated, generated recommendations are replaced but
 * user-entered data must survive. These helpers merge new AI output with the
 * user's previous edits.
 */
export function mergeBudgetRegeneration(
  previous: BudgetCategory[],
  next: BudgetCategory[]
): BudgetCategory[] {
  const previousByName = new Map(previous.map((category) => [key(category.name), category]));

  return next.map((category) => {
    const old = previousByName.get(key(category.name));
    if (!old) return category;
    return {
      ...category,
      id: old.id,
      estimatedAmount: old.estimatedAmount,
      quotedAmount: old.quotedAmount,
      actualAmount: old.actualAmount,
      status: old.status,
      notes: old.notes,
    };
  });
}

export function mergeTimelineRegeneration(
  previous: TimelineTask[],
  next: TimelineTask[]
): TimelineTask[] {
  const previousByTitle = new Map(previous.map((task) => [key(task.title), task]));

  return next.map((task) => {
    const old = previousByTitle.get(key(task.title));
    if (!old) return task;
    return {
      ...task,
      id: old.id,
      status: old.status,
      notes: old.notes,
      assignee: old.assignee,
    };
  });
}

export function mergeVendorRegeneration(
  previous: VendorEntry[],
  next: VendorEntry[]
): VendorEntry[] {
  const previousByCategory = new Map<string, VendorEntry[]>();
  for (const vendor of previous) {
    const list = previousByCategory.get(key(vendor.category)) ?? [];
    list.push(vendor);
    previousByCategory.set(key(vendor.category), list);
  }

  return next.map((vendor) => {
    const candidates = previousByCategory.get(key(vendor.category));
    const old = candidates?.shift();
    if (!old) return vendor;

    const completedItems = new Set(
      (old.checklist ?? []).filter((item) => item.completed).map((item) => key(item.item))
    );

    return {
      ...vendor,
      id: old.id,
      status: old.status,
      vendorName: old.vendorName,
      vendorContact: old.vendorContact,
      quoteAmount: old.quoteAmount,
      notes: old.notes,
      checklist: vendor.checklist?.map((item) => ({
        ...item,
        completed: completedItems.has(key(item.item)),
      })),
    };
  });
}

export function mergeIdeasRegeneration(
  previous: CelebrationIdea[],
  next: CelebrationIdea[]
): CelebrationIdea[] {
  const previousByTitle = new Map(previous.map((idea) => [key(idea.title), idea]));

  return next.map((idea) => {
    const old = previousByTitle.get(key(idea.title));
    if (!old) return idea;
    return { ...idea, id: old.id, saved: old.saved };
  });
}

export function mergeScheduleRegeneration(
  previous: ScheduleEntry[],
  next: ScheduleEntry[]
): ScheduleEntry[] {
  // Schedule entries are positional, so generated content is replaced.
  // User-authored notes are preserved by matching the activity text.
  const previousByActivity = new Map(previous.map((entry) => [key(entry.activity), entry]));
  return next.map((entry) => {
    const old = previousByActivity.get(key(entry.activity));
    return old ? { ...entry, id: old.id, notes: old.notes } : entry;
  });
}

export interface MergedSection {
  budgetCategories?: BudgetCategory[];
  budgetAllocationRationale?: string;
  timelineTasks?: TimelineTask[];
  vendorEntries?: VendorEntry[];
  celebrationIdeas?: CelebrationIdea[];
  eventDaySchedule?: ScheduleEntry[];
  recommendedTheme?: string;
  themeExplanation?: string;
  decorationIdeas?: string;
  venueIdeas?: string;
  entertainmentSuggestions?: string;
  foodConcepts?: string;
  guestEngagement?: string;
  eventName?: string;
}

/**
 * Merge one regenerated section into the existing plan without regenerating
 * or discarding the other sections.
 */
export function mergeRegeneratedSection(
  plan: EventPlan,
  payload: RegeneratedSectionPayload
): MergedSection {
  switch (payload.section) {
    case 'budget':
      return {
        budgetCategories: mergeBudgetRegeneration(plan.budgetCategories, payload.result.budgetCategories),
        budgetAllocationRationale: payload.result.budgetAllocationRationale,
      };
    case 'timeline':
      return { timelineTasks: mergeTimelineRegeneration(plan.timelineTasks, payload.result.timelineTasks) };
    case 'vendors':
      return { vendorEntries: mergeVendorRegeneration(plan.vendorEntries, payload.result.vendorEntries) };
    case 'ideas':
      return { celebrationIdeas: mergeIdeasRegeneration(plan.celebrationIdeas, payload.result.celebrationIdeas) };
    case 'schedule':
      return { eventDaySchedule: mergeScheduleRegeneration(plan.eventDaySchedule, payload.result.eventDaySchedule) };
    case 'theme': {
      const data = payload.result;
      return {
        eventName: data.eventName,
        recommendedTheme: data.recommendedTheme,
        themeExplanation: data.themeExplanation,
        decorationIdeas: data.decorationIdeas,
        venueIdeas: data.venueIdeas,
        entertainmentSuggestions: data.entertainmentSuggestions,
        foodConcepts: data.foodConcepts,
        guestEngagement: data.guestEngagement,
      };
    }
    default:
      return {};
  }
}
