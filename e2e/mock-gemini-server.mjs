/**
 * Deterministic mock of the Gemini generateContent endpoint.
 *
 * Used only by the Playwright end-to-end suite. The application talks to it
 * through GEMINI_API_BASE_URL, so the real /api/plan and /api/regenerate routes,
 * schemas, retries and UI are exercised without contacting Google.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_GEMINI_PORT ?? 4010);
const HOST = '127.0.0.1';

const plan = {
  eventName: 'A Garden Romance Wedding',
  eventSummary:
    'A relaxed outdoor wedding for 50 guests with local, seasonal food and shared family traditions.',
  recommendedTheme: 'Sage and gold garden romance',
  themeExplanation:
    'Soft greenery and warm gold accents suit the outdoor venue and keep decoration costs manageable.',
  decorationIdeas: 'Reusable potted herbs, borrowed lanterns and seasonal flowers.',
  venueIdeas: 'A garden lawn with a covered backup area for rain.',
  entertainmentSuggestions: 'An acoustic duo during the ceremony and a family playlist later.',
  foodConcepts: 'Vegetarian thali stations with local seasonal produce.',
  guestEngagement: 'A guest photo wall and a handwritten wish tree.',
  budgetCategories: [
    { name: 'Venue & ceremony', description: 'Lawn hire and seating', allocatedPercentage: 30 },
    { name: 'Catering', description: 'Vegetarian meal service', allocatedPercentage: 25 },
    { name: 'Photography', description: 'Half-day coverage', allocatedPercentage: 20 },
    { name: 'Decor & flowers', description: 'Reusable and seasonal decor', allocatedPercentage: 15 },
    {
      name: 'Contingency',
      description: 'Buffer for surprises',
      allocatedPercentage: 10,
      isContingency: true,
    },
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
      budgetRange: '1,500-1,800 USD',
      requiredDeliverables: ['Signed contract', 'Access times'],
      checklistItems: ['Visit the venue', 'Read the contract'],
      backupPlan: 'Community hall with a garden.',
    },
    {
      category: 'Catering',
      importance: 'Largest guest-experience cost.',
      daysBeforeEventDeadline: 90,
      questionsToAsk: ['Can you handle 50 vegetarian meals?', 'Is a tasting included?'],
      budgetRange: '1,100-1,400 USD',
      requiredDeliverables: ['Menu confirmation', 'Service timeline'],
      checklistItems: ['Request a tasting', 'Confirm dietary handling'],
      backupPlan: 'A second caterer with a simpler menu.',
    },
    {
      category: 'Photography',
      importance: 'Captures the family moments.',
      daysBeforeEventDeadline: 75,
      questionsToAsk: ['How many hours are included?', 'When are photos delivered?'],
      budgetRange: '800-1,100 USD',
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
      estimatedCost: '80-120 USD',
      tradeoffs: 'Needs a volunteer to assemble them.',
    },
    {
      title: 'Family recipe table',
      description: 'Serve two family recipes alongside the caterer menu.',
      whyItFits: 'Adds meaning without replacing the main meal.',
      expenseCategories: ['Catering'],
      implementationSteps: ['Choose two recipes', 'Confirm food-safety handling'],
      estimatedCost: '50-90 USD',
      tradeoffs: 'Requires coordination with the caterer.',
    },
    {
      title: 'Acoustic ceremony',
      description: 'Ask two musician friends to play during the ceremony.',
      whyItFits: 'Fits the garden setting and reduces DJ costs.',
      expenseCategories: ['Entertainment'],
      implementationSteps: ['Confirm availability', 'Agree a short set list'],
      estimatedCost: '0-150 USD',
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
  assumptions: ['The venue allows outside catering.', 'The guest list stays near 50.'],
  unresolvedQuestions: ['Is the venue accessible for elderly guests?'],
};

function sectionPayload(section) {
  switch (section) {
    case 'theme':
      return {
        eventName: plan.eventName,
        recommendedTheme: 'Modern minimal garden',
        themeExplanation: 'A calmer palette with fewer props and more greenery.',
        decorationIdeas: plan.decorationIdeas,
        venueIdeas: plan.venueIdeas,
        entertainmentSuggestions: plan.entertainmentSuggestions,
        foodConcepts: plan.foodConcepts,
        guestEngagement: plan.guestEngagement,
      };
    case 'budget':
      return {
        budgetCategories: plan.budgetCategories,
        budgetAllocationRationale: plan.budgetAllocationRationale,
      };
    case 'timeline':
      return { timelineTasks: plan.timelineTasks };
    case 'vendors':
      return { vendorEntries: plan.vendorEntries };
    case 'ideas':
      return { celebrationIdeas: plan.celebrationIdeas };
    case 'schedule':
      return { eventDaySchedule: plan.eventDaySchedule };
    default:
      return plan;
  }
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function sendText(response, text) {
  sendJson(response, 200, {
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 100,
      totalTokenCount: 200,
    },
  });
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true, service: 'mock-gemini' });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  let raw = '';
  for await (const chunk of request) raw += chunk;

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(response, 400, { error: 'Invalid request JSON' });
    return;
  }

  const prompt = body?.contents?.[0]?.parts?.[0]?.text ?? '';

  if (prompt.includes('SIMULATE_PROVIDER_FAILURE')) {
    sendJson(response, 500, {
      error: { code: 500, message: 'Simulated provider outage', status: 'INTERNAL' },
    });
    return;
  }

  if (prompt.includes('SIMULATE_INVALID_OUTPUT')) {
    sendText(response, JSON.stringify({ eventName: 'broken' }));
    return;
  }

  const sectionMatch = /Section to regenerate:\s*(\w+)/.exec(prompt);
  if (sectionMatch) {
    sendText(response, JSON.stringify(sectionPayload(sectionMatch[1])));
    return;
  }

  sendText(response, JSON.stringify(plan));
});

server.listen(PORT, HOST, () => {
  console.log(`Mock Gemini listening on http://${HOST}:${PORT}`);
});
