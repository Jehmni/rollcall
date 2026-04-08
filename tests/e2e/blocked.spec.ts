/**
 * Blocked admin page — /blocked
 *
 * Covers:
 *  - Blocked admin sees "Access Suspended" heading
 *  - Block reason from AuthContext is displayed
 *  - Default reason shown when blockReason is null
 *  - "Sign out" button is visible and clickable
 *  - After sign-out, redirects to /admin/login
 *  - Unauthenticated visit redirects to /admin/login (no session = immediate redirect)
 */
import { test, expect } from '@playwright/test'
import { SUPABASE_URL, IDS, silenceRealtime } from './helpers'

const PROJECT_REF = 'rlqbnohpepimietldrdj'

function makeBlockedSession(userId: string, email: string) {
  return {
    access_token: `mock-blocked-${userId}`,
    refresh_token: `mock-refresh-${userId}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId, aud: 'authenticated', role: 'authenticated', email,
      user_metadata: {},
      app_metadata: { provider: 'email' },
      created_at: '2024-01-01T00:00:00Z',
    },
  }
}

/**
 * Set up a session where the admin is blocked.
 * AuthContext checks blocked_admins table and sets isBlocked=true.
 */
async function asBlockedAdmin(
  page: import('@playwright/test').Page,
  reason: string | null = 'Violating terms of service.',
) {
  const session = makeBlockedSession(IDS.unitAdmin, 'blocked@example.com')
  await page.addInitScript(
    ({ key, val }) => localStorage.setItem(key, JSON.stringify(val)),
    { key: `sb-${PROJECT_REF}-auth-token`, val: session },
  )
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) }),
  )
  // super_admins: not super
  await page.route(`${SUPABASE_URL}/rest/v1/super_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  // blocked_admins: this admin is blocked
  await page.route(`${SUPABASE_URL}/rest/v1/blocked_admins*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        user_id: IDS.unitAdmin,
        reason,
        blocked_at: '2026-03-01T00:00:00Z',
      }]),
    }),
  )
  // unit_admins: empty — doesn't matter for blocked flow
  await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
}

test.describe('Blocked page: renders for blocked admin', () => {
  test('shows "Access Suspended" heading', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page)
    await page.goto('/blocked')
    await expect(page.getByRole('heading', { name: /Access Suspended/i })).toBeVisible()
  })

  test('shows the block reason from DB', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page, 'Repeated policy violations.')
    await page.goto('/blocked')
    await expect(page.getByText('Repeated policy violations.')).toBeVisible()
  })

  test('shows default message when blockReason is not set', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page, null)
    await page.goto('/blocked')
    // When reason is null, the default message is shown
    await expect(page.getByText(/suspended|administrator/i).first()).toBeVisible()
  })

  test('shows "Sign out" button', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page)
    await page.goto('/blocked')
    await expect(page.getByRole('button', { name: /Sign out/i })).toBeVisible()
  })

  test('shows contact admin guidance text', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page)
    await page.goto('/blocked')
    await expect(page.getByText(/contact.*administrator|Rollcally support/i)).toBeVisible()
  })
})

test.describe('Blocked page: sign-out flow', () => {
  test('"Sign out" calls logout and redirects to /admin/login', async ({ page }) => {
    silenceRealtime(page)
    await asBlockedAdmin(page)
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route =>
      route.fulfill({ status: 204, body: '' }),
    )
    await page.goto('/blocked')
    await page.getByRole('button', { name: /Sign out/i }).click()
    await expect(page).toHaveURL('/admin/login')
  })
})

test.describe('Blocked page: unauthenticated access', () => {
  test('unauthenticated user visiting /blocked is redirected to /admin/login', async ({ page }) => {
    silenceRealtime(page)
    // No session injected — AuthContext will have session=null
    await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_jwt' }) }),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/super_admins*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/blocked')
    // Without a session the Blocked component navigates to /admin/login
    await expect(page).toHaveURL('/admin/login')
  })
})
