import { defineConfig, devices } from '@playwright/test';

const APP_PORT = 3100;
const MOCK_PORT = 4010;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-gemini-server.mjs',
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { MOCK_GEMINI_PORT: String(MOCK_PORT) },
    },
    {
      command: `npm run dev -- --port ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        GEMINI_API_KEY: 'e2e-test-key',
        GEMINI_API_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        GEMINI_MODEL: 'gemini-2.0-flash',
      },
    },
  ],
});
