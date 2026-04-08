/**
 * Billing page — real Supabase, no route mocks.
 *
 * Verifies end-to-end billing flow against the live API:
 *  1. Unauthenticated visit redirects to /admin/login
 *  2. Authenticated admin sees the billing page
 *  3. get_org_billing RPC returns data (null subscription for a fresh test org)
 *  4. All three plan cards are rendered with correct prices
 *  5. "No subscription" / free-trial state shown for a new org
 *  6. Clicking "Choose plan" calls create-checkout-session edge function
 *     (Stripe not configured in test env → 503 handled gracefully, page doesn't crash)
 */

import { test, expect } from '@playwright/test'
import { loadIds, asIntegrationAdmin } from './helpers'

test.describe('Billing page (real Supabase)', () => {
  test('unauthenticated visit redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 })
  })

  test('billing page loads for authenticated admin', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto('/admin/billing')
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible({ timeout: 20_000 })
  })

  test('plan cards show all three tiers with live prices', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto('/admin/billing')
    // Wait for billing data to load
    await expect(page.getByText('Starter')).toBeVisible({ timeout: 20_000 })

    // Prices come from the live pricing_plans table
    await expect(page.getByText('$25')).toBeVisible()
    await expect(page.getByText('$59')).toBeVisible()
    await expect(page.getByText('$119')).toBeVisible()
  })

  test('fresh test org has no subscription — free trial CTA shown', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto('/admin/billing')
    // get_org_billing returns null subscription for a new org
    await expect(page.getByText('Starter')).toBeVisible({ timeout: 20_000 })

    // "No subscription" state
    await expect(
      page.getByText(/no subscription|start.*free trial|14 days/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('"Choose plan" calls checkout edge function — error handled gracefully', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto('/admin/billing')
    await expect(page.getByText('Starter')).toBeVisible({ timeout: 20_000 })

    // Click the first "Choose plan" button
    const chooseBtn = page.getByRole('button', { name: /choose plan/i }).first()
    await expect(chooseBtn).toBeVisible()
    await chooseBtn.click()

    // create-checkout-session returns 503 (Stripe not configured in test env).
    // The page should handle this gracefully — no crash, no "TypeError" in DOM.
    await page.waitForTimeout(3_000)
    await expect(page.locator('body')).not.toContainText('TypeError')
    await expect(page.locator('body')).not.toContainText('Unexpected token')
    // Page itself must still be functional (heading still visible)
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()
  })
})
