import { NextRequest } from 'next/server';
import { POST } from '@/app/api/plan/route';
import { generateEventPlan, AIGenerationError } from '@/lib/ai/generate-plan';
import { EventPlanSchema } from '@/lib/schemas/event-plan';
import { validateBudgetTotal } from '@/lib/budget/calculate';
import { resetRateLimit } from '@/lib/security/rate-limit';
import { validAIPlan, validInput } from '../fixtures/ai-plan';

jest.mock('@/lib/ai/generate-plan', () => {
  const actual = jest.requireActual('@/lib/ai/generate-plan');
  return { ...actual, generateEventPlan: jest.fn() };
});

const mockGenerate = generateEventPlan as jest.MockedFunction<typeof generateEventPlan>;

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

function makeRequest(body: unknown, ip: string = nextIp()): NextRequest {
  return new NextRequest('http://localhost/api/plan', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  resetRateLimit();
  mockGenerate.mockReset();
  process.env.GEMINI_API_KEY = 'test-key';
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/plan', () => {
  it('returns a validated plan for a valid event', async () => {
    const input = validInput();
    mockGenerate.mockResolvedValue(validAIPlan());

    const response = await POST(makeRequest(input));
    expect(response.status).toBe(200);

    const body = await readBody(response);
    const plan = EventPlanSchema.parse(body.plan);

    expect(plan.eventName).toBeTruthy();
    expect(plan.budgetCategories).toHaveLength(5);
    expect(plan.timelineTasks.every((task) => Boolean(task.dueDate))).toBe(true);
    expect(validateBudgetTotal(plan.budgetCategories, input.totalBudget, input.currency).valid).toBe(
      true
    );
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('rejects an invalid payload without calling the provider', async () => {
    const response = await POST(makeRequest({ category: 'wedding' }));
    expect(response.status).toBe(400);

    const body = await readBody(response);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(body.fieldErrors)).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects a past event date before calling the provider', async () => {
    const response = await POST(makeRequest(validInput({ eventDate: '2020-01-01' })));
    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with a controlled 400', async () => {
    const response = await POST(makeRequest('{not valid json'));
    expect(response.status).toBe(400);
    expect((await readBody(response)).code).toBe('INVALID_JSON');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies with 413', async () => {
    const response = await POST(makeRequest('x'.repeat(50 * 1024 + 1)));
    expect(response.status).toBe(413);
    expect((await readBody(response)).code).toBe('REQUEST_TOO_LARGE');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('fails clearly when the server has no provider credential', async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(makeRequest(validInput()));

    expect(response.status).toBe(503);
    const body = await readBody(response);
    expect(body.code).toBe('NOT_CONFIGURED');
    expect(String(body.error)).toContain('GEMINI_API_KEY');
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('maps a provider rate limit to 429 without leaking diagnostics', async () => {
    mockGenerate.mockRejectedValue(
      new AIGenerationError('The AI service is busy right now.', 'RATE_LIMITED', true)
    );

    const response = await POST(makeRequest(validInput()));
    expect(response.status).toBe(429);

    const text = JSON.stringify(await readBody(response));
    expect(text).toContain('RATE_LIMITED');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('test-key');
  });

  it('maps provider failures to a controlled 502', async () => {
    mockGenerate.mockRejectedValue(
      new AIGenerationError('The AI service is temporarily unavailable.', 'UNAVAILABLE', true)
    );

    const response = await POST(makeRequest(validInput()));
    expect(response.status).toBe(502);
    expect((await readBody(response)).code).toBe('UNAVAILABLE');
  });

  it('does not leak unexpected error details', async () => {
    mockGenerate.mockRejectedValue(new Error('boom: secret sk-live-12345'));

    const response = await POST(makeRequest(validInput()));
    expect(response.status).toBe(500);

    const text = JSON.stringify(await readBody(response));
    expect(text).toContain('An unexpected error occurred');
    expect(text).not.toContain('sk-live-12345');
    expect(text).not.toContain('boom');
    expect(text).not.toContain('at ');
  });

  it('enforces the per-client rate limit', async () => {
    const ip = '203.0.113.9';
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(makeRequest('{bad json', ip));
      expect(response.status).toBe(400);
    }

    const blocked = await POST(makeRequest(validInput(), ip));
    expect(blocked.status).toBe(429);
    expect((await readBody(blocked)).code).toBe('RATE_LIMITED');
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
