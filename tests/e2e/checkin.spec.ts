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
    await expect(page.getByRole('button', { name: 'Yes, Check Me In' })).toBeVisible()
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

/**
 * Regression: the glow overlay (absolute inset-0) must have pointer-events-none
 * so that tapping the search input on mobile actually focuses it.
 * These tests use click() + pressSequentially() instead of fill() to catch the
 * invisible-overlay-intercepts-tap class of bug.
 */
test.describe('Check-in: search input is tappable and typeable', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('search input can be focused by clicking it', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await expect(input).toBeFocused()
  })

  test('search input accepts typed characters after clicking', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await input.pressSequentially('Ali')
    await expect(input).toHaveValue('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })

  test('full QR-scan-simulated flow: navigate with service_id, click input, type, select, confirm', async ({ page }) => {
    await mockCheckinSuccess(page)
    // Simulate arriving from a QR scan: page opens with service_id in URL
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    // Must be clickable (the invisible glow div must not intercept the click)
    await input.click()
    await expect(input).toBeFocused()
    // Type the query character by character (as a real user would on mobile keyboard)
    await input.pressSequentially('Alice')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    // Select the member
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Is this you?')).toBeVisible()
    // Confirm check-in
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByText("You're in!")).toBeVisible()
  })

  test('duplicate check-in still shows correct error after tap-and-type flow', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await expect(input).toBeFocused()
    await input.pressSequentially('Alice')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Already Checked In' })).toBeVisible()
    await expect(page.getByText(/already checked in/i)).toBeVisible()
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
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByText("You're in!")).toBeVisible()
    await expect(page.getByText('Attendance confirmed')).toBeVisible()
  })

  test('already checked in shows error screen', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Already Checked In' })).toBeVisible()
    await expect(page.getByText(/already checked in/i)).toBeVisible()
  })

  test('"Go Back" from error returns to list', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Already Checked In' })).toBeVisible()
    await page.getByRole('button', { name: 'Go Back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })

  test('invalid service shows error screen', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Invalid Event' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible()
  })

  test('"Go Back" from invalid service returns to list', async ({ page }) => {
    await mockCheckinInvalidService(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await page.getByRole('button', { name: 'Go Back' }).click()
    await expect(page.getByPlaceholder('Search your name…')).toBeVisible()
  })
})

/**
 * Mobile viewport suite (iPhone 14 — 390×844).
 *
 * At this width the bottom nav renders (sm:hidden hides it above 640 px) and the
 * mobile software keyboard is what a real user would get. Running these tests at
 * mobile dimensions means:
 *   • The pointer-events regression is exercised in the exact layout where it bites.
 *   • The full QR-scan → success → Done → landing flow is covered end-to-end.
 *
 * test.use() scoped inside describe applies only to this block.
 */
test.describe('Check-in: mobile viewport (390×844 — iPhone 14)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
  })

  test('search input is focusable by tap on mobile layout', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await expect(input).toBeFocused()
  })

  test('typing after tap shows matching members on mobile layout', async ({ page }) => {
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await input.pressSequentially('Alice')
    await expect(input).toHaveValue('Alice')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })

  /**
   * Full end-to-end flow as a real mobile user experiences it:
   *   QR scan (simulated via URL) → tap search bar → type name →
   *   select member → confirm → success screen → Done → landing page
   */
  test('full flow: QR scan → tap → type → select → confirm → success screen → Done → landing', async ({ page }) => {
    await mockCheckinSuccess(page)

    // Step 1 — arrive at check-in without a service (as the device would before scanning)
    await page.goto('/checkin')
    await expect(page.getByRole('button', { name: 'Tap to Scan' })).toBeVisible()

    // Step 2 — simulate the QR scan result: scanner calls handleScan() which sets
    //           service_id in the URL, matching exactly what the real app does
    await page.goto(`/checkin?service_id=${IDS.service}`)

    // Step 3 — tap the search input (the core mobile regression under test)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await expect(input).toBeFocused()

    // Step 4 — type name character-by-character (as a mobile keyboard would send it)
    await input.pressSequentially('Alice')
    await expect(page.getByText('Alice Johnson')).toBeVisible()

    // Step 5 — select the member
    await page.getByText('Alice Johnson').click()
    await expect(page.getByText('Is this you?')).toBeVisible()

    // Step 6 — confirm check-in
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()

    // Step 7 — success screen
    await expect(page.getByText("You're in!")).toBeVisible()
    await expect(page.getByText('Attendance confirmed')).toBeVisible()

    // Step 8 — Done button navigates back to landing page
    await page.getByRole('button', { name: /done/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('duplicate check-in handled correctly on mobile layout', async ({ page }) => {
    await mockCheckinAlreadyIn(page)
    await page.goto(`/checkin?service_id=${IDS.service}`)
    const input = page.getByPlaceholder('Search your name…')
    await input.click()
    await expect(input).toBeFocused()
    await input.pressSequentially('Alice')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: 'Yes, Check Me In' }).click()
    await expect(page.getByRole('heading', { name: 'Already Checked In' })).toBeVisible()
    await expect(page.getByText(/already checked in/i)).toBeVisible()
  })
})

/**
 * sessionStorage isolation — regression suite for the service_id handoff fix.
 *
 * Previously the app fell back to sessionStorage.getItem('pending_service_id')
 * when the URL contained no service_id param.  This created two risks:
 *   1. A stale entry from a previous session could silently bind users to the
 *      wrong (or a dead) service.
 *   2. Writing the same key from multiple tabs could corrupt the stored ID.
 *
 * After the fix, service_id comes exclusively from the URL.  These tests
 * verify that sessionStorage can no longer influence the check-in flow.
 */
test.describe('Check-in: service_id comes from URL only (no sessionStorage fallback)', () => {
  test('no service_id in URL → shows QR scanner, even if sessionStorage has a stale ID', async ({ page }) => {
    silenceRealtime(page)
    // Pre-seed sessionStorage with what a stale previous session would leave.
    await page.goto('/checkin')
    await page.evaluate(id => sessionStorage.setItem('pending_service_id', id), IDS.service)
    // Hard reload to simulate coming back to the page without a URL param.
    await page.goto('/checkin')
    // Should see the "no service" prompt, NOT a member search.
    await expect(page.getByText('Scan the QR code at your venue')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tap to Scan' })).toBeVisible()
    // The search input must NOT be present (it only renders when serviceId is set).
    await expect(page.getByPlaceholder('Search your name…')).not.toBeVisible()
  })

  test('service_id in URL is used regardless of sessionStorage content', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    // Seed a different (wrong) service_id into sessionStorage.
    await page.goto('/checkin')
    await page.evaluate(() => sessionStorage.setItem('pending_service_id', 'stale-wrong-id'))
    // Navigate with the correct service_id in the URL.
    await page.goto(`/checkin?service_id=${IDS.service}`)
    // The search input should appear (URL param is honoured).
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })

  test('scanner flow puts service_id in URL and shows search (no sessionStorage needed)', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    // Navigate first, then clear sessionStorage to ensure it is empty.
    await page.goto('/checkin')
    await page.evaluate(() => sessionStorage.removeItem('pending_service_id'))
    // Now navigate with service_id in URL — should work without any sessionStorage entry.
    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Ali')
    await expect(page.getByText('Alice Johnson')).toBeVisible()
  })
})
