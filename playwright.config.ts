import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 12000 },
  use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
  // O servidor local serve o site já compilado (rode `pnpm build` antes) e a API.
  webServer: {
    command: 'node --import tsx apps/local-server/src/index.ts',
    url: 'http://localhost:4174/api/health',
    reuseExistingServer: !process.env.CI,
    env: { PORT: '4174', ROOM_CREATE_LIMIT: '1000' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? { channel: 'chrome' } : {}) },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...(process.env.CI ? { channel: 'chrome' } : {}) },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
});
