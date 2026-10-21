import {
  extractJsonObject,
  generateEventPlan,
  regenerateSection,
} from '@/lib/ai/generate-plan';
import { getModel } from '@/lib/ai/client';
import { validAIPlan, validInput } from './fixtures/ai-plan';

jest.mock('@/lib/ai/client', () => ({
  getModel: jest.fn(),
  isAiConfigured: jest.fn(() => true),
  DEFAULT_MODEL: 'test-model',
  MODEL_REQUEST_TIMEOUT_MS: 25_000,
  THINKING_CONFIG: { thinkingBudget: 0 },
}));

const mockGetModel = getModel as jest.Mock;
const generateContent = jest.fn();

function ok(text: string) {
  return { response: { text: () => text } };
}

beforeEach(() => {
  generateContent.mockReset();
  mockGetModel.mockReturnValue({ generateContent });
});

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown fences and surrounding prose', () => {
    expect(extractJsonObject('Here you go:\n```json\n{"a":2}\n```\nEnjoy')).toEqual({ a: 2 });
  });

  it('throws on non-JSON output', () => {
    expect(() => extractJsonObject('definitely not json')).toThrow();
  });
});

describe('generateEventPlan', () => {
  it('returns validated model output', async () => {
    generateContent.mockResolvedValue(ok(JSON.stringify(validAIPlan())));

    const plan = await generateEventPlan(validInput());
    expect(plan.eventName).toBe('A Garden Romance Wedding');
    expect(plan.budgetCategories).toHaveLength(5);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('retries once when the model returns invalid JSON, then succeeds', async () => {
    generateContent
      .mockResolvedValueOnce(ok('this is not json'))
      .mockResolvedValue(ok(JSON.stringify(validAIPlan())));

    const plan = await generateEventPlan(validInput());
    expect(plan.eventName).toBeTruthy();
    expect(generateContent).toHaveBeenCalledTimes(3);
  });

  it('fails with INVALID_JSON after the bounded retry', async () => {
    generateContent.mockResolvedValue(ok('never json'));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'INVALID_JSON',
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('fails with SCHEMA_VALIDATION_FAILED when the shape is wrong', async () => {
    generateContent.mockResolvedValue(ok(JSON.stringify({ eventName: 'Only a name' })));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('maps rate limiting and retries once', async () => {
    generateContent.mockRejectedValue(new Error('429 quota exceeded'));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryable: true,
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('maps authentication failures without retrying', async () => {
    generateContent.mockRejectedValue(new Error('401 API key not valid'));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'AUTH_FAILED',
      retryable: false,
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('maps a retired or unknown model to an actionable configuration error', async () => {
    generateContent.mockRejectedValue(
      new Error(
        '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent: [404 Not Found] models/gemini-2.0-flash is not found'
      )
    );

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'MODEL_UNAVAILABLE',
      retryable: false,
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('maps provider 500 errors and retries once', async () => {
    generateContent.mockRejectedValue(new Error('500 Internal Server Error'));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('does not mistake a port in the provider URL for an auth status', async () => {
    generateContent.mockRejectedValue(
      new Error(
        '[GoogleGenerativeAI Error]: Error fetching from http://127.0.0.1:4010/v1beta/models/gemini-2.0-flash:generateContent: [500 Internal Server Error] Simulated provider outage'
      )
    );

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      retryable: true,
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('maps timeouts', async () => {
    generateContent.mockRejectedValue(new Error('Request timeout'));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('fails on an empty response without inventing content', async () => {
    generateContent.mockResolvedValue(ok('   '));

    await expect(generateEventPlan(validInput())).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE',
    });
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('never includes raw provider diagnostics in the surfaced message', async () => {
    generateContent.mockRejectedValue(new Error('429 quota for project secret-project-123'));

    try {
      await generateEventPlan(validInput());
      throw new Error('Expected failure');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('secret-project-123');
      expect(message).not.toContain('quota for');
    }
  });
});

describe('regenerateSection', () => {
  it('validates and returns an ideas section', async () => {
    generateContent.mockResolvedValue(
      ok(JSON.stringify({ celebrationIdeas: validAIPlan().celebrationIdeas }))
    );

    const result = (await regenerateSection('ideas', validInput())) as {
      celebrationIdeas: unknown[];
    };
    expect(result.celebrationIdeas).toHaveLength(3);
  });

  it('validates and returns a theme section', async () => {
    const theme = validAIPlan();
    generateContent.mockResolvedValue(
      ok(
        JSON.stringify({
          eventName: theme.eventName,
          recommendedTheme: theme.recommendedTheme,
          themeExplanation: theme.themeExplanation,
        })
      )
    );

    const result = (await regenerateSection('theme', validInput())) as {
      recommendedTheme: string;
    };
    expect(result.recommendedTheme).toContain('Sage');
  });

  it('rejects a section response that does not match the schema', async () => {
    generateContent.mockResolvedValue(ok(JSON.stringify({ celebrationIdeas: [] })));

    await expect(regenerateSection('ideas', validInput())).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
