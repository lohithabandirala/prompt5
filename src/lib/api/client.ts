interface ApiErrorBody {
  error?: string;
  code?: string;
  fieldErrors?: Array<{ path: string; message: string }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fieldErrors?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;

async function request<T>(
  path: string,
  init: RequestInit,
  options: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort);

  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    const text = await response.text();

    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(
          'The server returned an unreadable response. Please try again.',
          response.status,
          'INVALID_RESPONSE'
        );
      }
    }

    if (!response.ok) {
      const body = (data ?? {}) as ApiErrorBody;
      throw new ApiError(
        body.error ?? `Request failed (HTTP ${response.status}).`,
        response.status,
        body.code ?? 'ERROR',
        body.fieldErrors
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if ((error as Error)?.name === 'AbortError') {
      if (options.signal?.aborted) {
        throw new ApiError('Request cancelled.', 0, 'CANCELLED');
      }
      if (timedOut) {
        throw new ApiError(
          'The request took too long. Please try again with a stable connection.',
          0,
          'TIMEOUT'
        );
      }
      throw new ApiError('Request cancelled.', 0, 'CANCELLED');
    }

    throw new ApiError(
      'Could not reach the planning service. Check your connection and try again.',
      0,
      'NETWORK'
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

export function postJson<T>(path: string, payload: unknown, options?: RequestOptions): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options
  );
}

export function getJson<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>(path, { method: 'GET' }, options);
}
