/**
 * Check-in integration test — real Supabase, no route mocks.
 *
 * Verifies the full public check-in flow against the live API:
 *  1. Page loads with a valid service_id
 *  2. Member search returns real results (get_service_members RPC)
 *  3. Selecting a member and confirming calls checkin_by_id
 *  4. Success state is displayed
 *  5. Re-checking the same member shows the "already checked in" state
 *
 * Test data is seeded by global-setup.ts and torn down by global-teardown.ts.
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

interface TestIds {
  orgId: string
  unitId: string
  serviceId: string
  aliceId: string
  bobId: string
  today: string
}

const IDS_FILE = join(fileURLToPath(new URL('.', import.meta.url)), '.test-ids.json')

function loadIds(): TestIds {
  return JSON.parse(readFileSync(IDS_FILE, 'utf8'))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function goToCheckin(page: import('@playwright/test').Page, serviceId: string) {
  await page.goto(`/checkin?service_id=${serviceId}`)
  // Wait for the member search input — confirms the page loaded and the RPC succeeded
  await expect(page.getByPlaceholder(/search/i)).toBeVisible({ timeout: 20_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Check-in (real Supabase)', () => {
  test('page loads and member search returns results', async ({ page }) => {
    const { serviceId } = loadIds()
    await goToCheckin(page, serviceId)

    // Search for "Integration" — both Alice and Bob should appear
    await page.getByPlaceholder(/search/i).fill('Integration')
    await expect(page.getByText('Alice Integration')).toBeVisible()
    await expect(page.getByText('Bob Integration')).toBeVisible()
  })

  test('check-in succeeds and shows success state', async ({ page }) => {
    const { serviceId } = loadIds()

    // Capture all console output to help diagnose failures
    const logs: string[] = []
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))

    await goToCheckin(page, serviceId)

    await page.getByPlaceholder(/search/i).fill('Alice')
    await expect(page.getByText('Alice Integration')).toBeVisible()
    await page.getByText('Alice Integration').click()

    // Confirm step — button text is "Yes, check me in"
    const confirmBtn = page.getByRole('button', { name: /yes.*check me in/i })
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    // Take a screenshot after 5s to see what state the page is in
    await page.waitForTimeout(5_000)
    await page.screenshot({ path: 'test-results/checkin-after-confirm.png', fullPage: true })

    // Success screen shows "You're in!" headline
    await expect(page.getByText(/you.re in/i)).toBeVisible({ timeout: 20_000 })
    console.log('Console logs:', logs.join('\n'))
  })

  test('duplicate check-in shows already-checked-in state', async ({ page }) => {
    // Alice was checked in by the previous test (tests run sequentially)
    const { serviceId } = loadIds()
    await goToCheckin(page, serviceId)

    await page.getByPlaceholder(/search/i).fill('Alice')
    await expect(page.getByText('Alice Integration')).toBeVisible()
    await page.getByText('Alice Integration').click()

    // Confirm step — button text is "Yes, check me in"
    const confirmBtn = page.getByRole('button', { name: /yes.*check me in/i })
    await expect(confirmBtn).toBeVisible()
    await confirmBtn.click()

    // Error screen shows "Already checked in" message
    await expect(page.getByText(/already checked in/i)).toBeVisible({ timeout: 20_000 })
  })

  test('invalid service_id shows error or empty state', async ({ page }) => {
    await page.goto('/checkin?service_id=00000000-0000-0000-0000-000000000000')
    // Should show no-service error or redirect — not crash
    await expect(page.locator('body')).not.toContainText('undefined')
    // The page should not be blank
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('missing service_id shows no-service state', async ({ page }) => {
    await page.goto('/checkin')
    await expect(page.getByText(/scan the qr code|scan.*venue/i)).toBeVisible({ timeout: 15_000 })
  })
})
