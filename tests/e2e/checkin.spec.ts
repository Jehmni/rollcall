/**
 * Check-in flow — public page, no auth required.
 *
 * Users: ordinary members (choristers, youth group, etc.)
 * Flow:  scan QR → pick name → confirm → result
 *
 * NOTE: The check-in page requires ≥3 characters in the search box before
 * showing the member list (security: restrict public roster exposure).
 * Tests must type at least 3 chars to trigger the member list.
 */
import { test, expect } from '@playwright/test'
import {
  IDS,
  mockGetServiceMembers,
  mockCheckinSuccess,
  mockCheckinAlreadyIn,
  mockCheckinInvalidService,
  silenceRealtime,
} from './helpers'

test.describe('Check-in: no service ID', () => {
  test('shows QR scanner prompt when no service_id is in URL', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/checkin')
    await expect(page.getByText('Scan the QR code at your venue')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tap to Scan' })).toBeVisible()
  })
})

test.describe('Check-in: member list', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('loads and shows the member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    // Must type ≥3 chars to trigger the member list display
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('groups members by section with section headers', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    // Section labels are in h3 elements
    await expect(page.locator('h3').filter({ hasText: 'Soprano' })).toBeVisible()
    await expect(page.locator('h3').filter({ hasText: 'Bass' })).toBeVisible()
  })

  test('search filters the list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Alice')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).not.toBeVisible()
  })

  test('search shows "no members" message when no match', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('zzzzz')
    await expect(page.getByText(/No members match/)).toBeVisible()
  })
})

test.describe('Check-in: confirmation flow', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('clicking a name shows the confirmation card', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Is this you?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, check me in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No, go back' })).toBeVisible()
  })

  test('confirmation card shows the selected member name', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    // Name appears in the large card
    await expect(page.getByText('Alice Johnson').last()).toBeVisible()
  })

  test('confirmation card shows section label', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Soprano')).toBeVisible()
  })

  test('"No, go back" returns to the member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'No, go back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })

  test('back arrow on header returns to member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'arrow_back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})

test.describe('Check-in: result screens', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('successful check-in shows success screen', async ({ page }) => {
    await mockCheckinSuccess(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByText("You're in!")).toBeVisible()
    await expect(page.getByText('Check-in Successful')).toBeVisible()
  })

  test('already checked in shows error screen', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByRole('heading', { name: 'Sync Denied' })).toBeVisible()
    await expect(page.getByText(/Already checked in/)).toBeVisible()
  })

  test('"Re-verify Identity" from error returns to list', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByRole('heading', { name: 'Sync Denied' })).toBeVisible()
    await page.getByRole('button', { name: 'Re-verify Identity' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })

  test('invalid service shows error screen', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByRole('heading', { name: 'Sync Denied' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Re-verify Identity' })).toBeVisible()
  })

  test('"Re-verify Identity" from invalid service returns to list', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await page.getByRole('button', { name: 'Re-verify Identity' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})
