import { NextRequest } from 'next/server';
import { POST } from '@/app/api/regenerate/route';
import { regenerateSection, AIGenerationError } from '@/lib/ai/generate-plan';
import { validateBudgetTotal } from '@/lib/budget/calculate';
import { resetRateLimit } from '@/lib/security/rate-limit';
import { validAIPlan, validInput } from '../fixtures/ai-plan';

jest.mock('@/lib/ai/generate-plan', () => {
  const actual = jest.requireActual('@/lib/ai/generate-plan');
  return { ...actual, regenerateSection: jest.fn() };
});

const mockRegenerate = regenerateSection as jest.MockedFunction<typeof regenerateSection>;

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function makeRequest(body: unknown, ip: string = nextIp()): NextRequest {
  return new NextRequest('http://localhost/api/regenerate', {
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
  mockRegenerate.mockReset();
  process.env.GEMINI_API_KEY = 'test-key';
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POST /api/regenerate', () => {
  it('returns a normalised ideas section', async () => {
    mockRegenerate.mockResolvedValue({
      celebrationIdeas: validAIPlan().celebrationIdeas,
    });

    const response = await POST(
      makeRequest({ section: 'ideas', input: validInput(), currentSummary: 'Old ideas' })
    );
    expect(response.status).toBe(200);

    const body = (await readBody(response)) as {
      section: string;
      result: { celebrationIdeas: Array<{ id: string; saved: boolean; title: string }> };
    };

    expect(body.section).toBe('ideas');
    expect(body.result.celebrationIdeas).toHaveLength(3);
    expect(body.result.celebrationIdeas[0].id).toMatch(/^idea-/);
    expect(body.result.celebrationIdeas[0].saved).toBe(false);
    expect(mockRegenerate).toHaveBeenCalledWith('ideas', expect.any(Object), 'Old ideas');
  });

  it('returns a budget section whose amounts balance exactly', async () => {
    const input = validInput();
    mockRegenerate.mockResolvedValue({
      budgetCategories: validAIPlan().budgetCategories,
      budgetAllocationRationale: 'Keep it balanced.',
    });

    const response = await POST(makeRequest({ section: 'budget', input }));
    expect(response.status).toBe(200);

    const body = (await readBody(response)) as {
      section: string;
      result: {
        budgetCategories: Array<{ id: string; allocatedAmount: number }>;
        budgetAllocationRationale: string;
      };
    };

    expect(body.section).toBe('budget');
    expect(body.result.budgetAllocationRationale).toBe('Keep it balanced.');
    expect(body.result.budgetCategories.every((category) => category.id.startsWith('budget-'))).toBe(
      true
    );
    expect(
      validateBudgetTotal(
        body.result.budgetCategories as never,
        input.totalBudget,
        input.currency
      ).valid
    ).toBe(true);
  });

  it('returns a timeline section with ids, dates and dependencies resolved', async () => {
    mockRegenerate.mockResolvedValue({
      timelineTasks: validAIPlan().timelineTasks,
    });

    const response = await POST(makeRequest({ section: 'timeline', input: validInput() }));
    expect(response.status).toBe(200);

    const body = (await readBody(response)) as {
      result: { timelineTasks: Array<{ id: string; dueDate: string; dependsOn?: string[] }> };
    };

    expect(body.result.timelineTasks.every((task) => task.id && task.dueDate)).toBe(true);
    expect(body.result.timelineTasks.some((task) => (task.dependsOn?.length ?? 0) > 0)).toBe(true);
  });

  it('rejects an unknown section without calling the provider', async () => {
    const response = await POST(makeRequest({ section: 'guest-list', input: validInput() }));
    expect(response.status).toBe(400);
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('rejects extra top-level properties', async () => {
    const response = await POST(
      makeRequest({ section: 'ideas', input: validInput(), context: 'not allowed' })
    );
    expect(response.status).toBe(400);
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('rejects an oversized current summary', async () => {
    const response = await POST(
      makeRequest({ section: 'ideas', input: validInput(), currentSummary: 'x'.repeat(2001) })
    );
    expect(response.status).toBe(400);
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('rejects invalid output instead of merging it', async () => {
    mockRegenerate.mockResolvedValue({ celebrationIdeas: [] });

    const response = await POST(makeRequest({ section: 'ideas', input: validInput() }));
    expect(response.status).toBe(502);
    expect((await readBody(response)).code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('fails clearly when the server has no provider credential', async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(makeRequest({ section: 'ideas', input: validInput() }));

    expect(response.status).toBe(503);
    expect((await readBody(response)).code).toBe('NOT_CONFIGURED');
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('maps provider timeouts to 504 without leaking diagnostics', async () => {
    mockRegenerate.mockRejectedValue(
      new AIGenerationError('The AI request timed out. Please try again.', 'TIMEOUT', true)
    );

    const response = await POST(makeRequest({ section: 'ideas', input: validInput() }));
    expect(response.status).toBe(504);

    const text = JSON.stringify(await readBody(response));
    expect(text).not.toContain('test-key');
    expect(text).not.toContain('stack');
  });

  it('enforces the per-client rate limit', async () => {
    const ip = '203.0.113.77';
    mockRegenerate.mockResolvedValue({ celebrationIdeas: validAIPlan().celebrationIdeas });

    for (let index = 0; index < 10; index += 1) {
      const response = await POST(makeRequest({ section: 'ideas', input: validInput() }, ip));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(makeRequest({ section: 'ideas', input: validInput() }, ip));
    expect(blocked.status).toBe(429);
    expect((await readBody(blocked)).code).toBe('RATE_LIMITED');
  });
});
