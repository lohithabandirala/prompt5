import type { EventInput } from '@/lib/schemas/event-input';
import type { AIPlanResponse } from '@/lib/schemas/event-plan';

export function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export function validInput(overrides: Partial<EventInput> = {}): EventInput {
  return {
    category: 'wedding',
    eventDate: futureDate(120),
    location: 'Mumbai',
    currency: 'INR',
    totalBudget: 500_000,
    guestCount: 120,
    theme: 'Garden romance',
    style: 'rustic',
    venuePreference: 'outdoor',
    foodPreferences: 'Vegetarian',
    culturalTraditions: '',
    dietaryRequirements: ['vegetarian'],
    accessibilityNeeds: '',
    colorPalette: ['sage', 'gold'],
    goals: ['memorable_experience', 'low_cost'],
    additionalNotes: 'Family-friendly afternoon celebration.',
    ...overrides,
  };
}

export function validAIPlan(overrides: Partial<AIPlanResponse> = {}): AIPlanResponse {
  return {
    eventName: 'A Garden Romance Wedding',
    eventSummary:
      'A relaxed outdoor wedding for 120 guests with a focus on local, seasonal food and shared family traditions.',
    recommendedTheme: 'Sage and gold garden romance',
    themeExplanation:
      'Soft greenery and warm gold accents suit the outdoor venue and keep decoration costs manageable.',
    decorationIdeas: 'Reusable potted herbs, borrowed lanterns and seasonal flowers.',
    venueIdeas: 'A garden lawn with a covered backup area for rain.',
    entertainmentSuggestions: 'An acoustic duo during the ceremony and a family-led playlist later.',
    foodConcepts: 'Vegetarian thali stations with local seasonal produce.',
    guestEngagement: 'A guest photo wall and a handwritten wish tree.',
    budgetCategories: [
      { name: 'Venue & ceremony', description: 'Lawn hire and seating', allocatedPercentage: 30 },
      { name: 'Catering', description: 'Vegetarian meal service', allocatedPercentage: 25 },
      { name: 'Photography', description: 'Half-day coverage', allocatedPercentage: 20 },
      { name: 'Decor & flowers', description: 'Reusable and seasonal decor', allocatedPercentage: 15 },
      { name: 'Contingency', description: 'Buffer for surprises', allocatedPercentage: 10, isContingency: true },
    ],
    budgetAllocationRationale:
      'Venue and food take priority for guest comfort; decor favours reusable elements to protect the contingency.',
    timelineTasks: [
      {
        title: 'Book venue',
        description: 'Confirm the lawn and wet-weather backup.',
        phase: 'Early planning',
        daysBeforeEvent: 120,
        priority: 'critical',
      },
      {
        title: 'Confirm caterer',
        description: 'Agree a vegetarian menu and guest-count deadline.',
        phase: 'Early planning',
        daysBeforeEvent: 90,
        priority: 'high',
        dependsOn: ['Book venue'],
      },
      {
        title: 'Send invitations',
        description: 'Share digital invitations and collect dietary notes.',
        phase: 'Mid planning',
        daysBeforeEvent: 60,
        priority: 'high',
        dependsOn: ['Confirm caterer'],
      },
      {
        title: 'Confirm final headcount',
        description: 'Lock the caterer count and seating plan.',
        phase: 'Final week',
        daysBeforeEvent: 7,
        priority: 'critical',
        dependsOn: ['Send invitations'],
      },
    ],
    vendorEntries: [
      {
        category: 'Venue',
        importance: 'Protects the date and provides wet-weather cover.',
        daysBeforeEventDeadline: 120,
        questionsToAsk: ['Is there a wet-weather backup?', 'What are the noise limits?'],
        budgetRange: '150,000-180,000 INR',
        requiredDeliverables: ['Signed contract', 'Access times'],
        checklistItems: ['Visit the venue', 'Read the contract'],
        backupPlan: 'Community hall with a garden.',
      },
      {
        category: 'Catering',
        importance: 'Largest guest-experience cost.',
        daysBeforeEventDeadline: 90,
        questionsToAsk: ['Can you handle 120 vegetarian meals?', 'Is a tasting included?'],
        budgetRange: '110,000-140,000 INR',
        requiredDeliverables: ['Menu confirmation', 'Service timeline'],
        checklistItems: ['Request a tasting', 'Confirm dietary handling'],
        backupPlan: 'A second caterer with a simpler menu.',
      },
      {
        category: 'Photography',
        importance: 'Captures the family moments.',
        daysBeforeEventDeadline: 75,
        questionsToAsk: ['How many hours are included?', 'When are photos delivered?'],
        budgetRange: '80,000-110,000 INR',
        requiredDeliverables: ['Edited gallery'],
        checklistItems: ['Review a full gallery'],
        backupPlan: 'A local photographer with a shorter package.',
      },
    ],
    celebrationIdeas: [
      {
        title: 'Herb favours',
        description: 'Give each household a potted herb with a handwritten tag.',
        whyItFits: 'Reusable, local and inexpensive at scale.',
        expenseCategories: ['Decor & flowers'],
        implementationSteps: ['Buy herbs in bulk', 'Write tags', 'Arrange on a tray'],
        estimatedCost: '8,000-12,000 INR',
        tradeoffs: 'Needs a volunteer to assemble them.',
      },
      {
        title: 'Family recipe table',
        description: 'Serve two family recipes alongside the caterer menu.',
        whyItFits: 'Adds meaning without replacing the main meal.',
        expenseCategories: ['Catering'],
        implementationSteps: ['Choose two recipes', 'Confirm food-safety handling'],
        estimatedCost: '5,000-9,000 INR',
        tradeoffs: 'Requires coordination with the caterer.',
      },
      {
        title: 'Acoustic ceremony',
        description: 'Ask two musician friends to play during the ceremony.',
        whyItFits: 'Fits the garden setting and reduces DJ costs.',
        expenseCategories: ['Entertainment'],
        implementationSteps: ['Confirm availability', 'Agree a short set list'],
        estimatedCost: '0-15,000 INR',
        tradeoffs: 'Depends on guest availability.',
      },
    ],
    eventDaySchedule: [
      {
        time: '15:00',
        endTime: '15:45',
        activity: 'Guest arrival',
        description: 'Welcome drinks and seating.',
        responsible: 'Cousin Aarti',
        location: 'Garden lawn',
      },
      {
        time: '16:00',
        endTime: '16:45',
        activity: 'Ceremony',
        description: 'Vows and family blessings.',
        responsible: 'Celebrant',
        location: 'Garden lawn',
      },
      {
        time: '17:00',
        endTime: '18:30',
        activity: 'Dinner service',
        description: 'Vegetarian thali stations.',
        responsible: 'Catering lead',
        location: 'Dining tent',
      },
      {
        time: '18:45',
        endTime: '20:00',
        activity: 'Music and farewell',
        description: 'Acoustic set and thank-you speech.',
        responsible: 'Cousin Aarti',
        location: 'Garden lawn',
      },
    ],
    contingencyPlans: ['Move the ceremony under the covered area if it rains.'],
    assumptions: ['The venue allows outside catering.', 'The guest list stays near 120.'],
    unresolvedQuestions: ['Is the venue accessible for elderly guests?'],
    ...overrides,
  };
}
