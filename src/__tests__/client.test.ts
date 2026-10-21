import { DEFAULT_MODEL, resolveModelName } from '@/lib/ai/client';

const originalModel = process.env.GEMINI_MODEL;

afterEach(() => {
  if (originalModel === undefined) {
    delete process.env.GEMINI_MODEL;
  } else {
    process.env.GEMINI_MODEL = originalModel;
  }
  jest.restoreAllMocks();
});

describe('resolveModelName', () => {
  it('uses the current default when no model is configured', () => {
    delete process.env.GEMINI_MODEL;
    expect(resolveModelName()).toBe(DEFAULT_MODEL);
  });

  it('honours a supported configured model', () => {
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
    expect(resolveModelName()).toBe('gemini-3.8-flash');
  });

  it('migrates a retired 2.0 model instead of failing every request', () => {
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveModelName()).toBe(DEFAULT_MODEL);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('retired_model_configured');
  });

  it('migrates a retired 3.1-flash-lite model', () => {
    process.env.GEMINI_MODEL = 'gemini-3.1-flash-lite';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(resolveModelName()).toBe(DEFAULT_MODEL);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('retired_model_configured');
  });
});
