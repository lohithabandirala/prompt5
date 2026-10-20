import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────
export const EventCategory = z.enum(['wedding', 'birthday', 'community']);
export type EventCategory = z.infer<typeof EventCategory>;

export const EventStyle = z.enum([
  'formal',
  'casual',
  'traditional',
  'contemporary',
  'minimalist',
  'bohemian',
  'rustic',
  'glamorous',
  'other',
]);
export type EventStyle = z.infer<typeof EventStyle>;

export const VenuePreference = z.enum(['indoor', 'outdoor', 'flexible']);
export type VenuePreference = z.infer<typeof VenuePreference>;

export const PlanningGoal = z.enum([
  'low_cost',
  'memorable_experience',
  'elegance',
  'sustainability',
  'guest_engagement',
  'cultural_authenticity',
  'family_friendly',
  'unique_theme',
]);
export type PlanningGoal = z.infer<typeof PlanningGoal>;

// ── Currency codes (ISO 4217 subset) ───────────────────────────
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY',
  'BRL', 'MXN', 'ZAR', 'AED', 'SGD', 'CHF', 'SEK', 'NZD',
  'KRW', 'THB', 'PHP', 'MYR', 'IDR', 'NGN', 'KES', 'EGP',
] as const;

export const CurrencyCode = z.enum(SUPPORTED_CURRENCIES);
export type CurrencyCode = z.infer<typeof CurrencyCode>;

// Currencies with 0 decimal places
export const ZERO_DECIMAL_CURRENCIES: string[] = ['JPY', 'KRW'];

export function getCurrencyPrecision(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2;
}

// ── Max field lengths ──────────────────────────────────────────
export const MAX_TEXT_LENGTH = 500;
export const MAX_NOTES_LENGTH = 2000;
export const MAX_LOCATION_LENGTH = 200;
export const MAX_GUEST_COUNT = 100000;
export const MAX_BUDGET = 100_000_000; // 100 million in any currency
export const MIN_BUDGET = 1;
export const MAX_COLORS = 5;
export const MAX_GOALS = 5;
export const MAX_DIETARY = 20;

// ── Event Input Schema ─────────────────────────────────────────
export const EventInputSchema = z.object({
  // Required fields
  category: EventCategory,
  eventDate: z
    .string()
    .min(1, 'Event date is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
  location: z
    .string()
    .min(1, 'Location is required')
    .max(MAX_LOCATION_LENGTH, `Location must be at most ${MAX_LOCATION_LENGTH} characters`),
  currency: CurrencyCode,
  totalBudget: z
    .number()
    .positive('Budget must be a positive number')
    .min(MIN_BUDGET, `Budget must be at least ${MIN_BUDGET}`)
    .max(MAX_BUDGET, `Budget must be at most ${MAX_BUDGET.toLocaleString()}`),
  guestCount: z
    .number()
    .int('Guest count must be a whole number')
    .positive('Guest count must be at least 1')
    .max(MAX_GUEST_COUNT, `Guest count must be at most ${MAX_GUEST_COUNT.toLocaleString()}`),

  // Personalization (optional)
  theme: z
    .string()
    .max(MAX_TEXT_LENGTH, `Theme must be at most ${MAX_TEXT_LENGTH} characters`)
    .optional()
    .default(''),
  style: EventStyle.optional().default('casual'),
  venuePreference: VenuePreference.optional().default('flexible'),
  foodPreferences: z
    .string()
    .max(MAX_TEXT_LENGTH, `Food preferences must be at most ${MAX_TEXT_LENGTH} characters`)
    .optional()
    .default(''),
  culturalTraditions: z
    .string()
    .max(MAX_TEXT_LENGTH, `Cultural traditions must be at most ${MAX_TEXT_LENGTH} characters`)
    .optional()
    .default(''),
  dietaryRequirements: z
    .array(z.string().max(100))
    .max(MAX_DIETARY, `At most ${MAX_DIETARY} dietary requirements`)
    .optional()
    .default([]),
  accessibilityNeeds: z
    .string()
    .max(MAX_TEXT_LENGTH, `Accessibility needs must be at most ${MAX_TEXT_LENGTH} characters`)
    .optional()
    .default(''),
  colorPalette: z
    .array(z.string().max(50))
    .max(MAX_COLORS, `At most ${MAX_COLORS} colors`)
    .optional()
    .default([]),
  goals: z
    .array(PlanningGoal)
    .max(MAX_GOALS, `At most ${MAX_GOALS} goals`)
    .optional()
    .default([]),
  additionalNotes: z
    .string()
    .max(MAX_NOTES_LENGTH, `Notes must be at most ${MAX_NOTES_LENGTH} characters`)
    .optional()
    .default(''),
});

export type EventInput = z.infer<typeof EventInputSchema>;

// ── Server-side validation (stricter) ──────────────────────────
export const ServerEventInputSchema = EventInputSchema.superRefine((data, ctx) => {
  const eventDate = new Date(data.eventDate);
  const now = new Date();

  // Allow past dates but flag them
  if (eventDate < now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event date is in the past. Planning timelines will not be generated for past events.',
      path: ['eventDate'],
    });
  }

  // Max date: 5 years from now
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 5);
  if (eventDate > maxDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Event date must be within the next 5 years.',
      path: ['eventDate'],
    });
  }
});

export type ServerEventInput = z.infer<typeof ServerEventInputSchema>;
