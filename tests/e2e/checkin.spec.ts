/**
 * Check-in flow — public page, no auth required.
 *
 * Users: ordinary members (choristers, youth group, etc.)
 * Flow:  scan QR → pick name → confirm → result
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
  test('shows "No active service" when QR has no service_id', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/checkin')
    await expect(page.getByText('No active service')).toBeVisible()
    await expect(page.getByText('Ask your leader for a fresh code')).toBeVisible()
  })
})

test.describe('Check-in: member list', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('loads and shows the member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('groups members by section with section headers', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    // Section labels are uppercase <p> elements (distinct from the per-member badges)
    await expect(page.locator('p.uppercase').filter({ hasText: 'Soprano' })).toBeVisible()
    await expect(page.locator('p.uppercase').filter({ hasText: 'Bass' })).toBeVisible()
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
    await expect(page.getByText('No members match your search.')).toBeVisible()
  })
})

test.describe('Check-in: confirmation flow', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('clicking a name shows the confirmation card', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Is this you?')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, check me in' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'No, go back' })).toBeVisible()
  })

  test('confirmation card shows the selected member name', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    // Name in the large card heading
    await expect(page.locator('p.font-bold').filter({ hasText: 'Alice Johnson' })).toBeVisible()
  })

  test('confirmation card shows section label', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Soprano')).toBeVisible()
  })

  test('"No, go back" returns to the member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'No, go back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })

  test('back arrow on header returns to member list', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.locator('header button').click()
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
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByText("You're in!")).toBeVisible()
    await expect(page.getByText('Attendance recorded. Enjoy the service.')).toBeVisible()
  })

  test('already checked in shows correct screen', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByText('Already checked in')).toBeVisible()
    await expect(page.getByText('already recorded')).toBeVisible()
  })

  test('"Go back" from already-checked-in returns to list', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByText('Already checked in')).toBeVisible()
    await page.getByRole('button', { name: 'Go back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })

  test('invalid service shows error screen', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('"Try again" from error returns to list', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, check me in' }).click()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})
