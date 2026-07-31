import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'http://127.0.0.1:4175/api',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'playwright-publishable-key',
    },
    reuseExistingServer: !process.env.CI,
  },
})
