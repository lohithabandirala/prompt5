import { z } from 'zod';
import { EventInputSchema } from './event-input';

// ── Budget Category Schema ─────────────────────────────────────
export const BudgetCategorySchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allocatedPercentage: z.number().min(0).max(100),
  allocatedAmount: z.number().min(0),
  estimatedAmount: z.number().min(0).optional(),
  quotedAmount: z.number().min(0).optional(),
  actualAmount: z.number().min(0).optional(),
  status: z.enum(['planned', 'quoted', 'paid']).default('planned'),
  notes: z.string().max(500).optional(),
  isContingency: z.boolean().default(false),
});
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

// ── Timeline Task Schema ───────────────────────────────────────
export const TaskPriority = z.enum(['critical', 'high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const TaskStatus = z.enum(['not_started', 'in_progress', 'completed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TimelineTaskSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  phase: z.string().min(1).max(100),
  daysBeforeEvent: z.number().int().min(0).max(3650),
  dueDate: z.string().max(20).optional(),
  priority: TaskPriority,
  status: TaskStatus.default('not_started'),
  dependsOn: z.array(z.string().max(120)).max(20).optional(),
  assignee: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});
export type TimelineTask = z.infer<typeof TimelineTaskSchema>;

// ── Vendor Category Schema ─────────────────────────────────────
export const VendorStatus = z.enum([
  'researching',
  'contacted',
  'quote_received',
  'selected',
  'booked',
  'completed',
]);
export type VendorStatus = z.infer<typeof VendorStatus>;

export const VendorChecklistItemSchema = z.object({
  item: z.string().min(1).max(300),
  completed: z.boolean().default(false),
});

export const VendorEntrySchema = z.object({
  id: z.string().min(1).max(120),
  category: z.string().min(1).max(100),
  importance: z.string().max(300).optional(),
  sourcingDeadline: z.string().max(20).optional(),
  questionsToAsk: z.array(z.string().max(300)).max(30).optional(),
  budgetRange: z.string().max(200).optional(),
  requiredDeliverables: z.array(z.string().max(300)).max(30).optional(),
  checklist: z.array(VendorChecklistItemSchema).max(30).optional(),
  status: VendorStatus.default('researching'),
  vendorName: z.string().max(200).optional(),
  vendorContact: z.string().max(200).optional(),
  quoteAmount: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
  backupPlan: z.string().max(500).optional(),
});
export type VendorEntry = z.infer<typeof VendorEntrySchema>;

// ── Celebration Idea Schema ────────────────────────────────────
export const CelebrationIdeaSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  whyItFits: z.string().max(500),
  expenseCategories: z.array(z.string().max(100)).max(10).optional(),
  implementationSteps: z.array(z.string().max(300)).max(15).optional(),
  estimatedCost: z.string().max(200).optional(),
  tradeoffs: z.string().max(500).optional(),
  saved: z.boolean().default(false),
});
export type CelebrationIdea = z.infer<typeof CelebrationIdeaSchema>;

// ── Event Day Schedule Entry ───────────────────────────────────
export const ScheduleEntrySchema = z.object({
  id: z.string().min(1).max(120),
  time: z.string().max(20),
  endTime: z.string().max(20).optional(),
  activity: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  responsible: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

// ── Full Event Plan Schema ─────────────────────────────────────
export const EventPlanSchema = z.object({
  id: z.string().min(1).max(120),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),

  // Event overview
  eventName: z.string().min(1).max(200),
  eventSummary: z.string().min(1).max(2000),

  // Theme & ideas
  recommendedTheme: z.string().min(1).max(500),
  themeExplanation: z.string().max(1000),
  decorationIdeas: z.string().max(1000).optional(),
  venueIdeas: z.string().max(1000).optional(),
  entertainmentSuggestions: z.string().max(1000).optional(),
  foodConcepts: z.string().max(1000).optional(),
  guestEngagement: z.string().max(1000).optional(),

  // Budget
  budgetCategories: z.array(BudgetCategorySchema).min(1).max(20),
  budgetAllocationRationale: z.string().max(1000).optional(),

  // Timeline
  timelineTasks: z.array(TimelineTaskSchema).min(1).max(80),

  // Vendors
  vendorEntries: z.array(VendorEntrySchema).min(1).max(30),

  // Ideas
  celebrationIdeas: z.array(CelebrationIdeaSchema).min(1).max(15),

  // Event day schedule
  eventDaySchedule: z.array(ScheduleEntrySchema).min(1).max(50),

  // Risks & assumptions
  contingencyPlans: z.array(z.string().max(500)).max(20).optional(),
  assumptions: z.array(z.string().max(500)).max(20).optional(),
  unresolvedQuestions: z.array(z.string().max(500)).max(20).optional(),
});

export type EventPlan = z.infer<typeof EventPlanSchema>;

// ── Saved Event (includes input + plan) ────────────────────────
export const SavedEventSchema = z.object({
  id: z.string().min(1).max(120),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
  input: EventInputSchema,
  plan: EventPlanSchema.optional(),
});
export type SavedEvent = z.infer<typeof SavedEventSchema>;

// ── AI response schemas (untrusted model output) ───────────────
const AIBudgetCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allocatedPercentage: z.number().min(0).max(100),
  isContingency: z.boolean().optional(),
});

const AITimelineTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  phase: z.string().min(1).max(100),
  daysBeforeEvent: z.number().min(0).max(3650),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  dependsOn: z.array(z.string().max(200)).max(10).optional(),
});

const AIVendorEntrySchema = z.object({
  category: z.string().min(1).max(100),
  importance: z.string().max(300).optional(),
  daysBeforeEventDeadline: z.number().min(0).max(3650).optional(),
  questionsToAsk: z.array(z.string().max(300)).max(20).optional(),
  budgetRange: z.string().max(200).optional(),
  requiredDeliverables: z.array(z.string().max(300)).max(20).optional(),
  checklistItems: z.array(z.string().max(300)).max(20).optional(),
  backupPlan: z.string().max(500).optional(),
});

const AICelebrationIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  whyItFits: z.string().max(500),
  expenseCategories: z.array(z.string().max(100)).max(10).optional(),
  implementationSteps: z.array(z.string().max(300)).max(10).optional(),
  estimatedCost: z.string().max(200).optional(),
  tradeoffs: z.string().max(500).optional(),
});

const AIScheduleEntrySchema = z.object({
  time: z.string().min(1).max(20),
  endTime: z.string().max(20).optional(),
  activity: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  responsible: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
});

const AThemeSchema = z.object({
  eventName: z.string().min(1).max(200),
  recommendedTheme: z.string().min(1).max(500),
  themeExplanation: z.string().min(1).max(1000),
  decorationIdeas: z.string().max(1000).optional(),
  venueIdeas: z.string().max(1000).optional(),
  entertainmentSuggestions: z.string().max(1000).optional(),
  foodConcepts: z.string().max(1000).optional(),
  guestEngagement: z.string().max(1000).optional(),
});

export const AIPlanResponseSchema = z.object({
  eventName: z.string().min(1).max(200),
  eventSummary: z.string().min(1).max(2000),
  recommendedTheme: z.string().min(1).max(500),
  themeExplanation: z.string().min(1).max(1000),
  decorationIdeas: z.string().max(1000).optional(),
  venueIdeas: z.string().max(1000).optional(),
  entertainmentSuggestions: z.string().max(1000).optional(),
  foodConcepts: z.string().max(1000).optional(),
  guestEngagement: z.string().max(1000).optional(),

  budgetCategories: z.array(AIBudgetCategorySchema).min(1).max(20),
  budgetAllocationRationale: z.string().max(1000).optional(),

  timelineTasks: z.array(AITimelineTaskSchema).min(1).max(60),

  vendorEntries: z.array(AIVendorEntrySchema).min(1).max(25),

  celebrationIdeas: z.array(AICelebrationIdeaSchema).min(1).max(12),

  eventDaySchedule: z.array(AIScheduleEntrySchema).min(1).max(40),

  contingencyPlans: z.array(z.string().max(500)).max(20).optional(),
  assumptions: z.array(z.string().max(500)).max(20).optional(),
  unresolvedQuestions: z.array(z.string().max(500)).max(20).optional(),
});

export type AIPlanResponse = z.infer<typeof AIPlanResponseSchema>;

// ── Partial regeneration schemas ───────────────────────────────
export const RegenerateSectionSchema = z.enum([
  'ideas',
  'budget',
  'timeline',
  'vendors',
  'schedule',
  'theme',
]);
export type RegenerateSection = z.infer<typeof RegenerateSectionSchema>;

export const RegenerateResultSchemas = {
  ideas: z.object({
    celebrationIdeas: z.array(AICelebrationIdeaSchema).min(1).max(8),
  }),
  budget: z.object({
    budgetCategories: z.array(AIBudgetCategorySchema).min(1).max(20),
    budgetAllocationRationale: z.string().max(1000).optional(),
  }),
  timeline: z.object({
    timelineTasks: z.array(AITimelineTaskSchema).min(1).max(40),
  }),
  vendors: z.object({
    vendorEntries: z.array(AIVendorEntrySchema).min(1).max(20),
  }),
  schedule: z.object({
    eventDaySchedule: z.array(AIScheduleEntrySchema).min(1).max(30),
  }),
  theme: AThemeSchema,
} as const;

export type RegenerateResults = {
  [K in RegenerateSection]: z.infer<(typeof RegenerateResultSchemas)[K]>;
};

export type RegenerateResponse =
  | { section: 'ideas'; result: RegenerateResults['ideas'] }
  | { section: 'budget'; result: RegenerateResults['budget'] }
  | { section: 'timeline'; result: RegenerateResults['timeline'] }
  | { section: 'vendors'; result: RegenerateResults['vendors'] }
  | { section: 'schedule'; result: RegenerateResults['schedule'] }
  | { section: 'theme'; result: RegenerateResults['theme'] };
