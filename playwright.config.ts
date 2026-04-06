import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  // Per-test timeout — generous to handle slow Supabase cold-start in dev
  timeout: 60_000,
  // Assertion timeout — how long expect(...).toBeVisible() retries
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // Don't fail on console errors from Supabase realtime WS
    ignoreHTTPSErrors: true,
    // Use domcontentloaded so external fonts/icons don't block goto()
    // React mounts after JS bundle executes; assertions retry until ready
    navigationTimeout: 30_000,
    waitForLoadState: 'domcontentloaded',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Provide stub Supabase vars so the client initialises without throwing.
    // All actual network calls are intercepted by route mocks in each test.
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'https://rlqbnohpepimietldrdj.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature-for-e2e-only',
    },
  },
})
