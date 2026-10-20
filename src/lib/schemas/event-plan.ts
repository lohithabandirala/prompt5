import { z } from 'zod';

// ── Budget Category Schema ─────────────────────────────────────
export const BudgetCategorySchema = z.object({
  id: z.string(),
  name: z.string().max(100),
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
  id: z.string(),
  title: z.string().max(200),
  description: z.string().max(500).optional(),
  phase: z.string().max(100),
  daysBeforeEvent: z.number().int(),
  dueDate: z.string().optional(), // ISO date string, calculated
  priority: TaskPriority,
  status: TaskStatus.default('not_started'),
  dependsOn: z.array(z.string()).optional(),
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

export const VendorEntrySchema = z.object({
  id: z.string(),
  category: z.string().max(100),
  importance: z.string().max(200).optional(),
  sourcingDeadline: z.string().optional(),
  questionsToAsk: z.array(z.string().max(300)).optional(),
  budgetRange: z.string().max(200).optional(),
  requiredDeliverables: z.array(z.string().max(300)).optional(),
  checklist: z.array(z.object({
    item: z.string().max(300),
    completed: z.boolean().default(false),
  })).optional(),
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
  id: z.string(),
  title: z.string().max(200),
  description: z.string().max(1000),
  whyItFits: z.string().max(500),
  expenseCategories: z.array(z.string().max(100)).optional(),
  implementationSteps: z.array(z.string().max(300)).optional(),
  estimatedCost: z.string().max(200).optional(),
  tradeoffs: z.string().max(500).optional(),
  saved: z.boolean().default(false),
});
export type CelebrationIdea = z.infer<typeof CelebrationIdeaSchema>;

// ── Event Day Schedule Entry ───────────────────────────────────
export const ScheduleEntrySchema = z.object({
  id: z.string(),
  time: z.string().max(20),
  endTime: z.string().max(20).optional(),
  activity: z.string().max(200),
  description: z.string().max(500).optional(),
  responsible: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

// ── Full Event Plan Schema ─────────────────────────────────────
export const EventPlanSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Event overview
  eventName: z.string().max(200),
  eventSummary: z.string().max(2000),

  // Theme & ideas
  recommendedTheme: z.string().max(500),
  themeExplanation: z.string().max(1000),
  decorationIdeas: z.string().max(1000).optional(),
  venueIdeas: z.string().max(1000).optional(),
  entertainmentSuggestions: z.string().max(1000).optional(),
  foodConcepts: z.string().max(1000).optional(),
  guestEngagement: z.string().max(1000).optional(),

  // Budget
  budgetCategories: z.array(BudgetCategorySchema),
  budgetAllocationRationale: z.string().max(1000).optional(),

  // Timeline
  timelineTasks: z.array(TimelineTaskSchema),

  // Vendors
  vendorEntries: z.array(VendorEntrySchema),

  // Ideas
  celebrationIdeas: z.array(CelebrationIdeaSchema),

  // Event day schedule
  eventDaySchedule: z.array(ScheduleEntrySchema),

  // Risks & assumptions
  contingencyPlans: z.array(z.string().max(500)).optional(),
  assumptions: z.array(z.string().max(500)).optional(),
  unresolvedQuestions: z.array(z.string().max(500)).optional(),
});

export type EventPlan = z.infer<typeof EventPlanSchema>;

// ── Saved Event (includes input + plan) ────────────────────────
export const SavedEventSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: z.any(), // EventInput
  plan: EventPlanSchema.optional(),
  userEdits: z.record(z.string(), z.unknown()).optional(),
});
export type SavedEvent = z.infer<typeof SavedEventSchema>;

// ── AI Response Schema (what we expect from the model) ─────────
export const AIPlanResponseSchema = z.object({
  eventName: z.string(),
  eventSummary: z.string(),
  recommendedTheme: z.string(),
  themeExplanation: z.string(),
  decorationIdeas: z.string().optional(),
  venueIdeas: z.string().optional(),
  entertainmentSuggestions: z.string().optional(),
  foodConcepts: z.string().optional(),
  guestEngagement: z.string().optional(),

  budgetCategories: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    allocatedPercentage: z.number(),
    isContingency: z.boolean().optional(),
  })),
  budgetAllocationRationale: z.string().optional(),

  timelineTasks: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    phase: z.string(),
    daysBeforeEvent: z.number(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    dependsOn: z.array(z.string()).optional(),
  })),

  vendorEntries: z.array(z.object({
    category: z.string(),
    importance: z.string().optional(),
    daysBeforeEventDeadline: z.number().optional(),
    questionsToAsk: z.array(z.string()).optional(),
    budgetRange: z.string().optional(),
    requiredDeliverables: z.array(z.string()).optional(),
    checklistItems: z.array(z.string()).optional(),
    backupPlan: z.string().optional(),
  })),

  celebrationIdeas: z.array(z.object({
    title: z.string(),
    description: z.string(),
    whyItFits: z.string(),
    expenseCategories: z.array(z.string()).optional(),
    implementationSteps: z.array(z.string()).optional(),
    estimatedCost: z.string().optional(),
    tradeoffs: z.string().optional(),
  })),

  eventDaySchedule: z.array(z.object({
    time: z.string(),
    endTime: z.string().optional(),
    activity: z.string(),
    description: z.string().optional(),
    responsible: z.string().optional(),
    location: z.string().optional(),
  })),

  contingencyPlans: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  unresolvedQuestions: z.array(z.string()).optional(),
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
