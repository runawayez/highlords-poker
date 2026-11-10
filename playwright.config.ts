import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 12000 },
  use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/dev.mjs --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: '3001',
      DATA_PATH: '.data/e2e.sqlite',
      ALLOWED_ORIGINS: 'http://localhost:4174',
      HIGHLORDS_E2E: '1',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: [['list'], ['html', { open: 'never' }]],
});
