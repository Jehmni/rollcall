/**
 * Admin QR code + member check-in — real Supabase, no route mocks.
 *
 * Full end-to-end flow:
 *  1. Admin logs in and navigates to the service detail page
 *  2. Admin expands the QR code section — canvas is rendered
 *  3. The QR download button is visible (proves the QR URL is non-empty)
 *  4. A member navigates to the check-in URL (simulates QR scan) and checks in
 *  5. Success state is confirmed ("You're in!")
 *  6. Admin service detail shows the member as present
 */

import { test, expect } from '@playwright/test'
import { loadIds, asIntegrationAdmin } from './helpers'

test.describe('QR code + check-in (real Supabase)', () => {
  test('admin sees QR code on service detail page', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto(`/admin/units/${ids.unitId}/events/${ids.serviceId}`)

    // Locate the QR section button specifically by its "Attendance QR Code" heading
    const qrSectionBtn = page.getByRole('button', { name: /Attendance QR Code/i })
    await expect(qrSectionBtn).toBeVisible({ timeout: 20_000 })
    await qrSectionBtn.click()

    // After expansion the QR canvas should render (id set by qrcode.react)
    const canvas = page.locator('canvas#service-qr')
    await expect(canvas).toBeVisible({ timeout: 10_000 })
  })

  test('QR code section shows Download button', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    await page.goto(`/admin/units/${ids.unitId}/events/${ids.serviceId}`)

    // Expand QR section
    await page.getByRole('button', { name: /Attendance QR Code/i }).click()
    await expect(page.locator('canvas#service-qr')).toBeVisible({ timeout: 10_000 })

    // The Download button only renders when qrUrl is non-empty, confirming
    // the QR encodes a real check-in URL
    const downloadBtn = page.getByRole('button', { name: /download qr/i })
    await expect(downloadBtn).toBeVisible()
  })

  test('member scans QR → checks in → success shown', async ({ browser }) => {
    const ids = loadIds()

    // Use a fresh browser context (no admin session) to simulate a member device.
    // Bob Integration hasn't been checked in yet (Alice is checked in by
    // checkin.spec.ts which runs in parallel — use Bob to avoid conflict).
    const memberCtx  = await browser.newContext()
    const memberPage = await memberCtx.newPage()

    try {
      // Navigate to the URL that the QR code encodes
      await memberPage.goto(`/checkin?service_id=${ids.serviceId}`)
      await expect(memberPage.getByPlaceholder(/search/i)).toBeVisible({ timeout: 20_000 })

      // Search for Bob and check him in
      await memberPage.getByPlaceholder(/search/i).fill('Bob')
      await expect(memberPage.getByText('Bob Integration')).toBeVisible()
      await memberPage.getByText('Bob Integration').click()

      const confirmBtn = memberPage.getByRole('button', { name: /yes.*check me in/i })
      await expect(confirmBtn).toBeVisible()
      await confirmBtn.click()

      // Success state
      await expect(memberPage.getByText(/you.re in/i)).toBeVisible({ timeout: 20_000 })
    } finally {
      await memberCtx.close()
    }
  })

  test('admin service detail reflects the new attendance', async ({ page }) => {
    const ids = loadIds()
    await asIntegrationAdmin(page, ids)

    // Bob was checked in by the previous test (tests run sequentially within this file)
    await page.goto(`/admin/units/${ids.unitId}/events/${ids.serviceId}`)

    // Bob Integration should appear in the members list
    await expect(page.getByText('Bob Integration')).toBeVisible({ timeout: 20_000 })
  })
})
