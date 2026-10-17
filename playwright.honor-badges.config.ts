import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/honor-badge-delivery.spec.ts',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4181',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181/Castlegame/',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
