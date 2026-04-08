/**
 * Location toggle — per-event geofence control.
 *
 * Admin scenarios:
 *   - Event form shows location toggle defaulting to off (online)
 *   - Toggle can be switched to on (in-person) before creating
 *   - Service detail page shows current location mode and allows quick-toggle
 *
 * Member (check-in) scenarios:
 *   - When require_location = false, geolocation is NOT requested
 *   - When require_location = true and location denied, error is shown
 *   - When require_location = true and member is too far, error is shown
 */
import { test, expect } from '@playwright/test'
import {
  SUPABASE_URL, IDS,
  asUnitAdmin,
  mockOrgs, mockUnitLookup, mockServices,
  mockGetServiceMembers, mockCheckinSuccess,
  silenceRealtime,
} from './helpers'

// ── Shared service mocks ──────────────────────────────────────────────────────

const SERVICE_ONLINE = {
  id: IDS.service, unit_id: IDS.unit, date: '2026-12-10',
  service_type: 'rehearsal', require_location: false,
  notification_sent_at: null, created_at: '2024-01-01T00:00:00Z',
}

const SERVICE_IN_PERSON = { ...SERVICE_ONLINE, require_location: true }

function mockServiceDetail(page: Parameters<typeof silenceRealtime>[0], service: typeof SERVICE_ONLINE) {
  return page.route(`${SUPABASE_URL}/rest/v1/services*`, route => {
    const url = route.request().url()
    if (url.includes(IDS.service)) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(service) })
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([service]) })
    }
  })
}

// ── Admin: event creation form ────────────────────────────────────────────────

test.describe('Admin — event creation form location toggle', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page)
    await mockOrgs(page)
    await mockUnitLookup(page)
    await mockServices(page)
  })

  test('location toggle defaults to online (off)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await page.getByRole('button', { name: /schedule event|new event|add event/i }).first().click()
    // Toggle should show "Online — No location check" by default
    await expect(page.getByText('Online — No location check')).toBeVisible()
  })

  test('toggling switches between online and in-person labels', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await page.getByRole('button', { name: /schedule event|new event|add event/i }).first().click()
    await expect(page.getByText('Online — No location check')).toBeVisible()
    // The toggle is a button that contains the location text — find the button ancestor
    const toggleBtn = page.locator('button').filter({ hasText: /Online — No location check|In-person — Location required/ })
    await toggleBtn.click()
    await expect(page.getByText('In-person — Location required')).toBeVisible()
    await toggleBtn.click()
    await expect(page.getByText('Online — No location check')).toBeVisible()
  })
})

// ── Admin: service detail quick-toggle ────────────────────────────────────────

test.describe('Admin — service detail location quick-toggle', () => {
  test('shows online mode when require_location is false', async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page)
    await mockOrgs(page)
    await mockUnitLookup(page)
    await mockServiceDetail(page, SERVICE_ONLINE)
    await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/members*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText('Online — No location check')).toBeVisible()
  })

  test('shows in-person mode when require_location is true', async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page)
    await mockOrgs(page)
    await mockUnitLookup(page)
    await mockServiceDetail(page, SERVICE_IN_PERSON)
    await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/members*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText('In-person — Location enforced')).toBeVisible()
  })
})

// ── Member: check-in — location not required ──────────────────────────────────

test.describe('Check-in — online event (no location required)', () => {
  test('does not trigger geolocation permission when require_location is false', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)

    // Mock useServiceInfo returning require_location: false
    await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_ONLINE) }),
    )
    await mockCheckinSuccess(page)

    let geolocationRequested = false
    await page.context().grantPermissions([])
    await page.addInitScript(() => {
      const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
      navigator.geolocation.getCurrentPosition = (...args) => {
        // @ts-expect-error — injecting test flag onto window
        window.__geoRequested = true
        return original(...args)
      }
    })

    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Alice')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: /confirm|yes.*me/i }).click()

    geolocationRequested = await page.evaluate(() => !!(window as unknown as Record<string, unknown>).__geoRequested)
    expect(geolocationRequested).toBe(false)
  })
})

// ── Member: check-in — location required, denied ──────────────────────────────

test.describe('Check-in — in-person event (location required)', () => {
  test('shows location error when RPC returns location_required', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)

    await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_IN_PERSON) }),
    )

    // RPC returns location_required error
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'location_required' }),
      }),
    )

    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Alice')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: /confirm|yes.*me/i }).click()
    await expect(page.getByText(/location access is required/i)).toBeVisible()
  })

  test('shows distance error when RPC returns too_far', async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)

    await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_IN_PERSON) }),
    )

    await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'too_far', distance: 450 }),
      }),
    )

    await page.goto(`/checkin?service_id=${IDS.service}`)
    await page.getByPlaceholder('Search your name…').fill('Alice')
    await page.getByText('Alice Johnson').click()
    await page.getByRole('button', { name: /confirm|yes.*me/i }).click()
    await expect(page.getByText(/too far from the venue/i)).toBeVisible()
    await expect(page.getByText(/450m/i)).toBeVisible()
  })
})
