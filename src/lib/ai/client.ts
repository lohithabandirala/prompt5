import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  type GenerationConfig,
} from '@google/generative-ai';

let genAIInstance: GoogleGenerativeAI | null = null;
let cachedCredential: string | null = null;

export const DEFAULT_MODEL = 'gemini-3.8-flash';

/**
 * Models that Google has shut down. If one is still pinned in a deployment's
 * environment, fall back to the current default rather than failing every
 * generation with a provider 404. The override is logged for operators.
 */
const RETIRED_MODEL_IDS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
]);

export function resolveModelName(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (!configured) return DEFAULT_MODEL;

  if (RETIRED_MODEL_IDS.has(configured)) {
    console.warn(
      JSON.stringify({
        event: 'retired_model_configured',
        configured,
        using: DEFAULT_MODEL,
      })
    );
    return DEFAULT_MODEL;
  }

  return configured;
}
export const MODEL_REQUEST_TIMEOUT_MS = 50_000;

/**
 * Newer Flash models reason before producing structured output, which can
 * exceed serverless request budgets. Structured plan generation does not need
 * an extended reasoning pass, so request the minimum thinking budget.
 */
export const THINKING_CONFIG = { thinkingBudget: 0 } as const;

/** The installed SDK's types predate Gemini 3 thinking controls. */
export type FestivaGenerationConfig = GenerationConfig & {
  thinkingConfig?: { thinkingBudget?: number; includeThoughts?: boolean };
};

/**
 * True when a server-side provider credential is available. Never expose the
 * credential itself to callers.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Return a configured model client.
 *
 * Credentials are read from server-only environment variables. An optional
 * GEMINI_API_BASE_URL enables running against a local mock server in
 * automated end-to-end tests or an approved gateway/proxy.
 */
export function getModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!genAIInstance || cachedCredential !== apiKey) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
    cachedCredential = apiKey;
  }

  const baseUrl = process.env.GEMINI_API_BASE_URL?.trim();
  const modelName = resolveModelName();

  const generationConfig: FestivaGenerationConfig = {
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    thinkingConfig: THINKING_CONFIG,
  };

  return genAIInstance.getGenerativeModel(
    {
      model: modelName,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig,
    },
    {
      timeout: MODEL_REQUEST_TIMEOUT_MS,
      ...(baseUrl ? { baseUrl } : {}),
      apiVersion: 'v1beta',
    }
  );
}
