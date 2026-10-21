import {
  mergeBudgetRegeneration,
  mergeIdeasRegeneration,
  mergeRegeneratedSection,
  mergeScheduleRegeneration,
  mergeTimelineRegeneration,
  mergeVendorRegeneration,
} from '@/lib/plan/merge';
import { buildPlanFromAI } from '@/lib/plan/build-plan';
import { validateBudgetTotal } from '@/lib/budget/calculate';
import { validAIPlan, validInput } from './fixtures/ai-plan';

function plans() {
  const input = validInput();
  const previous = buildPlanFromAI(validAIPlan(), input);
  const next = buildPlanFromAI(validAIPlan(), input);
  return { input, previous, next };
}

describe('buildPlanFromAI', () => {
  it('normalises ids, dates and budget maths', () => {
    const input = validInput();
    const plan = buildPlanFromAI(validAIPlan(), input);

    expect(plan.id).toMatch(/^plan-/);
    expect(plan.budgetCategories.every((category) => category.id.startsWith('budget-'))).toBe(true);
    expect(validateBudgetTotal(plan.budgetCategories, input.totalBudget, input.currency).valid).toBe(
      true
    );
    expect(plan.timelineTasks.every((task) => task.dueDate)).toBe(true);
    expect(plan.timelineTasks.every((task) => task.status === 'not_started')).toBe(true);
    expect(plan.celebrationIdeas.every((idea) => idea.saved === false)).toBe(true);
  });

  it('resolves model dependency titles to real task ids', () => {
    const plan = buildPlanFromAI(validAIPlan(), validInput());
    const invites = plan.timelineTasks.find((task) => task.title === 'Send invitations');
    const caterer = plan.timelineTasks.find((task) => task.title === 'Confirm caterer');
    const venue = plan.timelineTasks.find((task) => task.title === 'Book venue');

    expect(invites?.dependsOn).toEqual([caterer?.id]);
    expect(caterer?.dependsOn).toEqual([venue?.id]);
  });

  it('sorts the run sheet chronologically', () => {
    const plan = buildPlanFromAI(validAIPlan(), validInput());
    const times = plan.eventDaySchedule.map((entry) => entry.time);
    expect(times).toEqual([...times].sort());
  });
});

describe('regeneration merges', () => {
  it('keeps user-entered budget quotes, actuals, status and notes', () => {
    const { previous, next } = plans();
    const catering = previous.budgetCategories.find((category) => category.name === 'Catering')!;
    catering.quotedAmount = 120_000;
    catering.actualAmount = 118_000;
    catering.status = 'paid';
    catering.notes = 'Deposit paid';

    const merged = mergeBudgetRegeneration(previous.budgetCategories, next.budgetCategories);
    const mergedCatering = merged.find((category) => category.name === 'Catering')!;

    expect(mergedCatering.id).toBe(catering.id);
    expect(mergedCatering.quotedAmount).toBe(120_000);
    expect(mergedCatering.actualAmount).toBe(118_000);
    expect(mergedCatering.status).toBe('paid');
    expect(mergedCatering.notes).toBe('Deposit paid');
    expect(mergedCatering.allocatedAmount).toBe(
      next.budgetCategories.find((category) => category.name === 'Catering')!.allocatedAmount
    );
  });

  it('keeps task status, notes and owner by title', () => {
    const { previous, next } = plans();
    const venue = previous.timelineTasks.find((task) => task.title === 'Book venue')!;
    venue.status = 'completed';
    venue.notes = 'Contract signed';
    venue.assignee = 'Sam';

    const merged = mergeTimelineRegeneration(previous.timelineTasks, next.timelineTasks);
    const mergedVenue = merged.find((task) => task.title === 'Book venue')!;

    expect(mergedVenue.status).toBe('completed');
    expect(mergedVenue.notes).toBe('Contract signed');
    expect(mergedVenue.assignee).toBe('Sam');
    expect(mergedVenue.id).toBe(venue.id);
  });

  it('keeps vendor details and checklist progress by category', () => {
    const { previous, next } = plans();
    const venue = previous.vendorEntries.find((vendor) => vendor.category === 'Venue')!;
    venue.status = 'booked';
    venue.vendorName = 'Garden House';
    venue.vendorContact = 'owner@example.test';
    venue.quoteAmount = 165_000;
    venue.notes = 'Deposit paid';
    if (venue.checklist) venue.checklist[0].completed = true;

    const merged = mergeVendorRegeneration(previous.vendorEntries, next.vendorEntries);
    const mergedVenue = merged.find((vendor) => vendor.category === 'Venue')!;

    expect(mergedVenue.id).toBe(venue.id);
    expect(mergedVenue.status).toBe('booked');
    expect(mergedVenue.vendorName).toBe('Garden House');
    expect(mergedVenue.quoteAmount).toBe(165_000);
    expect(mergedVenue.notes).toBe('Deposit paid');
    expect(mergedVenue.checklist?.find((item) => item.item === 'Visit the venue')?.completed).toBe(
      true
    );
  });

  it('keeps saved ideas and their identity', () => {
    const { previous, next } = plans();
    const idea = previous.celebrationIdeas[0];
    idea.saved = true;

    const merged = mergeIdeasRegeneration(previous.celebrationIdeas, next.celebrationIdeas);
    const mergedIdea = merged.find((item) => item.title === idea.title)!;

    expect(mergedIdea.saved).toBe(true);
    expect(mergedIdea.id).toBe(idea.id);
  });

  it('keeps run-sheet notes for matching activities', () => {
    const { previous, next } = plans();
    const ceremony = previous.eventDaySchedule.find((entry) => entry.activity === 'Ceremony')!;
    ceremony.notes = 'Celebrant arrives at 15:30';

    const merged = mergeScheduleRegeneration(previous.eventDaySchedule, next.eventDaySchedule);
    expect(merged.find((entry) => entry.activity === 'Ceremony')?.notes).toBe(
      'Celebrant arrives at 15:30'
    );
  });

  it('merges a normalised theme payload into only the theme fields', () => {
    const { previous } = plans();
    const merged = mergeRegeneratedSection(previous, {
      section: 'theme',
      result: {
        eventName: 'New name',
        recommendedTheme: 'Modern minimal',
        themeExplanation: 'A calmer palette.',
        decorationIdeas: 'Candles',
      },
    });

    expect(merged.eventName).toBe('New name');
    expect(merged.recommendedTheme).toBe('Modern minimal');
    expect(merged.budgetCategories).toBeUndefined();
  });

  it('merges a budget payload without dropping the new allocation rationale', () => {
    const { previous, next } = plans();
    const merged = mergeRegeneratedSection(previous, {
      section: 'budget',
      result: {
        budgetCategories: next.budgetCategories,
        budgetAllocationRationale: 'New rationale',
      },
    });

    expect(merged.budgetAllocationRationale).toBe('New rationale');
    expect(merged.budgetCategories).toHaveLength(next.budgetCategories.length);
  });
});
