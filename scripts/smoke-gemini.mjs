/**
 * Opt-in live-provider smoke test.
 *
 * Requires a running Festiva AI server that has a real GEMINI_API_KEY, e.g.
 *   npm run build && npm start
 * then:
 *   npm run smoke:gemini -- http://localhost:3000
 *
 * This is deliberately separate from `npm test`: CI has no live credential,
 * and the automated suites must stay deterministic.
 */
const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const input = {
  category: 'wedding',
  eventDate: futureDate(120),
  location: 'Pune, India',
  currency: 'INR',
  totalBudget: 500000,
  guestCount: 80,
  style: 'relaxed',
  venuePreference: 'outdoor',
  dietaryRequirements: ['vegetarian'],
  goals: ['keep it personal', 'stay within budget'],
  colorPalette: ['sage', 'gold'],
  additionalNotes: 'Family-focused ceremony with a short reception.',
};

async function main() {
  console.log(`Checking live generation through ${baseUrl}/api/plan ...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  let response;
  try {
    response = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch (error) {
    console.error('FAILED: could not reach the server.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  } finally {
    clearTimeout(timeout);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`FAILED: HTTP ${response.status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exitCode = 1;
    return;
  }

  const plan = body?.plan;
  if (
    !plan?.eventName ||
    !Array.isArray(plan.budgetCategories) ||
    !Array.isArray(plan.timelineTasks) ||
    !Array.isArray(plan.eventDaySchedule)
  ) {
    console.error('FAILED: the response did not contain a complete plan.');
    process.exitCode = 1;
    return;
  }

  console.log('PASSED');
  console.log(`  Event:    ${plan.eventName}`);
  console.log(`  Budget:   ${plan.budgetCategories.length} categories`);
  console.log(`  Timeline: ${plan.timelineTasks.length} tasks`);
  console.log(`  Run sheet:${plan.eventDaySchedule.length} entries`);
}

await main();
