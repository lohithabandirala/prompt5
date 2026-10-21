import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

let genAIInstance: GoogleGenerativeAI | null = null;
let cachedCredential: string | null = null;

export const DEFAULT_MODEL = 'gemini-3.6-flash';
export const MODEL_REQUEST_TIMEOUT_MS = 25_000;

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
  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

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
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    },
    {
      timeout: MODEL_REQUEST_TIMEOUT_MS,
      ...(baseUrl ? { baseUrl } : {}),
      apiVersion: 'v1beta',
    }
  );
}
