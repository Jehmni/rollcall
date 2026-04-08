/**
 * Integration test config — runs against real Supabase.
 *
 * Required env vars:
 *   VITE_SUPABASE_URL          — your Supabase project URL
 *   VITE_SUPABASE_ANON_KEY     — anon/public key
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (setup/teardown only)
 *   INTEGRATION_ADMIN_ID       — UUID of a pre-existing test admin in auth.users
 *
 * Run:
 *   npm run test:integration
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,   // sequential — tests share seeded data
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report-integration' }], ['list']],
  globalSetup:    './tests/integration/global-setup.ts',
  globalTeardown: './tests/integration/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    navigationTimeout: 30_000,
    waitForLoadState: 'domcontentloaded',
    actionTimeout: 20_000,
    // No route mocking — all requests go to real Supabase
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL:      process.env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
  },
})
