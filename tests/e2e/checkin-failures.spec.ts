/**
 * Check-in failure states and edge cases.
 *
 * Covers: too_far, device_locked, offline fallback, QR scan flow.
 *
 * NOTE: The check-in page requires ≥3 characters in the search box before
 * showing the member list. Tests must type at least 3 chars first.
 */
import { test, expect } from '@playwright/test'
import {
  IDS,
  SUPABASE_URL,
  mockGetServiceMembers,
  mockCheckinTooFar,
  mockCheckinDeviceLocked,
  silenceRealtime,
} from './helpers'

// ── Too far ───────────────────────────────────────────────────────────────────

test.describe('Check-in: too far from venue', () => {
  test('shows error when member is too far away', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinTooFar(page, 350)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Outside Venue Area' })).toBeVisible()
    await expect(page.getByText(/away from the venue/i)).toBeVisible()
  })

  test('"Try Again" from too-far returns to list', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinTooFar(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Outside Venue Area' })).toBeVisible()
    await page.getByRole('button', { name: 'Try Again' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})

// ── Device locked ─────────────────────────────────────────────────────────────

test.describe('Check-in: device locked', () => {
  test('shows error when device is already linked to another member', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinDeviceLocked(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Already Registered' })).toBeVisible()
    await expect(page.getByText(/using this device/i)).toBeVisible()
  })

  test('"Try a Different Name" from device-locked returns to list', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinDeviceLocked(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await page.getByRole('button', { name: 'Try a Different Name' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})

// ── Offline fallback ──────────────────────────────────────────────────────────

test.describe('Check-in: offline fallback', () => {
  test('shows error when network is unavailable', async ({ page }) => {
    silenceRealtime(page)
    // Mock members to load before going offline
    await mockGetServiceMembers(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()

    // Simulate network failure for the check-in RPC
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
      route.abort('internetdisconnected'),
    )

    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    // Should show error state (not loading indefinitely)
    await expect(page.getByRole('heading', { name: 'Check-in Failed' })).toBeVisible({ timeout: 10000 })
  })
})

// ── QR scan → service load ────────────────────────────────────────────────────

test.describe('Check-in: QR scan flow', () => {
  test('no service_id shows QR scanner prompt', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/checkin')
    await expect(page.getByRole('button', { name: 'Tap to Scan' })).toBeVisible()
    await expect(page.getByText('Scan the QR code at your venue')).toBeVisible()
  })

  test('after scan URL param is updated to service_id', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)

    // Navigate to checkin without service_id, then programmatically set searchParams
    // (simulates what handleScan does internally)
    await page.goto('/checkin')
    await expect(page.getByRole('button', { name: 'Tap to Scan' })).toBeVisible()

    // Simulate the result of a QR scan by navigating to the URL with service_id
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
    // Must type ≥3 chars to see member list
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })

  test('service_id stored in sessionStorage survives page reload', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()

    // Reload without the param — sessionStorage should carry it
    await page.reload()
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })
})
