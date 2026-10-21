import type { EventPlan, RegenerateSection } from '../schemas/event-plan';

const MAX_CONTEXT_LENGTH = 1500;

/**
 * Build a small, section-specific context string for regeneration. This keeps
 * provider requests bounded and avoids sending the entire plan when only one
 * section changes.
 */
export function buildRegenerationContext(plan: EventPlan, section: RegenerateSection): string {
  let context = '';

  switch (section) {
    case 'budget':
      context = `Current budget categories: ${plan.budgetCategories
        .map((category) => `${category.name} ${category.allocatedPercentage.toFixed(0)}%`)
        .join('; ')}`;
      break;
    case 'timeline':
      context = `Current tasks: ${plan.timelineTasks.map((task) => task.title).join('; ')}`;
      break;
    case 'vendors':
      context = `Current vendor categories: ${plan.vendorEntries
        .map((vendor) => vendor.category)
        .join('; ')}`;
      break;
    case 'ideas':
      context = `Current idea titles: ${plan.celebrationIdeas.map((idea) => idea.title).join('; ')}`;
      break;
    case 'schedule':
      context = `Current schedule: ${plan.eventDaySchedule
        .map((entry) => `${entry.time} ${entry.activity}`)
        .join('; ')}`;
      break;
    case 'theme':
      context = `Current theme: ${plan.recommendedTheme}. ${plan.themeExplanation}`;
      break;
    default:
      context = '';
  }

  return context.slice(0, MAX_CONTEXT_LENGTH);
}
