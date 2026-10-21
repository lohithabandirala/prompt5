import { z } from 'zod';
import {
  BudgetCategorySchema,
  CelebrationIdeaSchema,
  ScheduleEntrySchema,
  TimelineTaskSchema,
  VendorEntrySchema,
} from './event-plan';

/**
 * Runtime schema for the normalized payload returned by /api/regenerate.
 * The client validates it before touching the current plan, so malformed or
 * mismatched responses cannot corrupt a saved event.
 */
export const RegeneratedSectionPayloadSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('budget'),
    result: z.object({
      budgetCategories: z.array(BudgetCategorySchema).min(1).max(20),
      budgetAllocationRationale: z.string().max(1000).optional(),
    }),
  }),
  z.object({
    section: z.literal('timeline'),
    result: z.object({ timelineTasks: z.array(TimelineTaskSchema).min(1).max(60) }),
  }),
  z.object({
    section: z.literal('vendors'),
    result: z.object({ vendorEntries: z.array(VendorEntrySchema).min(1).max(25) }),
  }),
  z.object({
    section: z.literal('ideas'),
    result: z.object({ celebrationIdeas: z.array(CelebrationIdeaSchema).min(1).max(12) }),
  }),
  z.object({
    section: z.literal('schedule'),
    result: z.object({ eventDaySchedule: z.array(ScheduleEntrySchema).min(1).max(40) }),
  }),
  z.object({
    section: z.literal('theme'),
    result: z.object({
      eventName: z.string().min(1).max(200),
      recommendedTheme: z.string().min(1).max(500),
      themeExplanation: z.string().max(1000),
      decorationIdeas: z.string().max(1000).optional(),
      venueIdeas: z.string().max(1000).optional(),
      entertainmentSuggestions: z.string().max(1000).optional(),
      foodConcepts: z.string().max(1000).optional(),
      guestEngagement: z.string().max(1000).optional(),
    }),
  }),
]);

export type RegeneratedSectionPayloadInput = z.infer<typeof RegeneratedSectionPayloadSchema>;
