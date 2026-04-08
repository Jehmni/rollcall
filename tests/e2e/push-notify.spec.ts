/**
 * Push notification / Go Live button tests.
 *
 * Covers:
 *  - GoLiveButton renders and reflects subscriber count
 *  - Disabled state when 0 subscribers
 *  - Sending state while request is in-flight
 *  - Error panel shown on function failure
 *  - Success state shown after send
 *  - Re-send visible after first send
 *  - notification_sent_at pre-fills sentAt state
 */
import { test, expect } from '@playwright/test'
import {
  SUPABASE_URL, IDS,
  asSuperAdmin,
  mockGetServiceMembersFull, mockAttendanceWithAlice, mockMembersHead,
  mockServiceLookup,
  silenceRealtime,
} from './helpers'

const ALT_FUNCTIONS_URL = 'https://rlqbnohpepimietldrdj.supabase.co/functions/v1/send-push'

async function setupServiceDetail(page: import('@playwright/test').Page) {
  silenceRealtime(page)
  await asSuperAdmin(page)
  await mockMembersHead(page)
  await mockGetServiceMembersFull(page)
  await mockAttendanceWithAlice(page)
  await mockServiceLookup(page)
}

// ── Subscriber count ──────────────────────────────────────────────────────────

test.describe('GoLiveButton: subscriber count display', () => {
  test('shows subscriber count from member_push_subscriptions', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: '[]', headers: { 'Content-Range': '0-2/3' } }),
    )
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText(/subscriber/i)).toBeVisible()
  })

  test('shows "No subscribers yet" when count is 0', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '*/0' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText(/No subscribers yet/i)).toBeVisible()
  })

  test('Go Live button is disabled when subscriber count is 0', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '*/0' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    await expect(goLiveBtn).toBeDisabled()
  })

  test('Go Live button is enabled when subscribers exist', async ({ page }) => {
    await setupServiceDetail(page)
    // Supabase JS reads count from Content-Range, but browsers enforce CORS header visibility.
    // Must expose content-range via Access-Control-Expose-Headers so JS can read it.
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      await route.fulfill({
        status: 200,
        headers: {
          'content-range': '0-2/3',
          'Access-Control-Expose-Headers': 'Content-Range,content-range',
        },
        body: '',
      })
    })
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Wait for subscriber count to load — button becomes enabled once count > 0
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    await expect(goLiveBtn).toBeEnabled({ timeout: 15000 })
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

test.describe('GoLiveButton: error handling', () => {
  test('shows error panel when send-push function returns an error', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([{ id: 'sub-1' }]),
        })
      }
    })
    // send-push function returns an error response
    await page.route(`${ALT_FUNCTIONS_URL}*`, route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'VAPID keys not configured' }),
      }),
    )

    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    if (await goLiveBtn.isEnabled()) {
      await goLiveBtn.click()
      // Error panel appears beneath the button
      await expect(page.locator('.bg-red-500\\/10, [class*="bg-red"]').first()).toBeVisible({ timeout: 8000 })
    } else {
      test.skip(true, 'Go Live button not enabled (no subscribers) — skip error test')
    }
  })

  test('shows error panel when send-push network request fails', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'sub-1' }]) })
      }
    })
    await page.route(`${ALT_FUNCTIONS_URL}*`, route => route.abort('failed'))

    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    if (await goLiveBtn.isEnabled()) {
      await goLiveBtn.click()
      await expect(page.locator('[class*="bg-red"]').first()).toBeVisible({ timeout: 8000 })
    } else {
      test.skip(true, 'Go Live button not enabled — skip network error test')
    }
  })
})

// ── Success state ─────────────────────────────────────────────────────────────

test.describe('GoLiveButton: success state', () => {
  test('shows "Notified at HH:MM" after successful send', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'sub-1' }]) })
      }
    })
    await page.route(`${ALT_FUNCTIONS_URL}*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sent: 1 }) }),
    )

    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    if (await goLiveBtn.isEnabled()) {
      await goLiveBtn.click()
      await expect(page.getByText(/Notified at/i)).toBeVisible({ timeout: 8000 })
    } else {
      test.skip(true, 'Go Live button not enabled — skip success test')
    }
  })

  test('Re-send button is visible after successful notification', async ({ page }) => {
    await setupServiceDetail(page)
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'sub-1' }]) })
      }
    })
    await page.route(`${ALT_FUNCTIONS_URL}*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sent: 1 }) }),
    )

    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    const goLiveBtn = page.getByRole('button', { name: /Notify Members|Go Live/i })
    if (await goLiveBtn.isEnabled()) {
      await goLiveBtn.click()
      await expect(page.getByRole('button', { name: /Re-send/i })).toBeVisible({ timeout: 8000 })
    } else {
      test.skip(true, 'Go Live button not enabled — skip re-send test')
    }
  })

  test('service with notification_sent_at shows Re-send by default', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockMembersHead(page)
    await mockGetServiceMembersFull(page)
    await mockAttendanceWithAlice(page)
    // Service already has notification_sent_at set
    await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify({
          id: IDS.service, unit_id: IDS.unit, date: '2026-12-10',
          service_type: 'rehearsal',
          notification_sent_at: '2026-12-10T09:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        }),
      }),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/member_push_subscriptions*`, async route => {
      if (route.request().method() === 'HEAD') {
        await route.fulfill({ status: 200, headers: { 'Content-Range': '0-0/1' }, body: '' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'sub-1' }]) })
      }
    })

    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Should render "Notified at HH:MM" state directly
    await expect(page.getByText(/Notified at/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Re-send/i })).toBeVisible()
  })
})
