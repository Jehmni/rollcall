/**
 * Security tests — P0 and P1 priority.
 *
 * Covers:
 *  SEC-009 — Super admin cannot be spoofed via signup user_metadata
 *  SEC-001 — Route guards: unauthenticated access, wrong role
 *  SEC-002 — /__rc_super is super-admin-only
 *  SEC-003 — Signup form does not inject role metadata
 *  SEC-004 — Session lifecycle: logout clears credentials
 *  SEC-005 — Password reset flow
 *  SEC-006 — Admin signup validation
 *  SEC-007 — super_admins table is queried, not JWT metadata
 */
import { test, expect } from '@playwright/test'
import {
  SUPABASE_URL, IDS, STORAGE_KEY,
  asSuperAdmin, asUnitAdmin,
  mockOrgs,
  silenceRealtime,
} from './helpers'

// ── SEC-009: Super admin via DB table, not metadata ───────────────────────────

test.describe('SEC-009: super admin determined by DB table, not metadata', () => {
  test('user with superadmin metadata but NOT in super_admins table is not elevated', async ({ page }) => {
    silenceRealtime(page)
    const spoofedSession = {
      access_token: 'spoof-token',
      refresh_token: 'spoof-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: IDS.unitAdmin,
        aud: 'authenticated', role: 'authenticated',
        email: 'attacker@example.com',
        user_metadata: { role: 'superadmin' }, // spoofed metadata
        app_metadata: { provider: 'email' },
        created_at: '2024-01-01T00:00:00Z',
      },
    }
    await page.addInitScript(
      ({ key, val }) => localStorage.setItem(key, JSON.stringify(val)),
      { key: STORAGE_KEY, val: spoofedSession },
    )
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(spoofedSession) }),
    )
    await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(spoofedSession.user) }),
    )
    // super_admins table returns EMPTY — this user is NOT actually super
    await page.route(`${SUPABASE_URL}/rest/v1/super_admins*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    )

    await page.goto('/__rc_super')
    // Without super_admins row, isSuper is false → SuperRoute redirects to /
    await expect(page).toHaveURL('/')
  })

  test('legitimate super admin with DB row can access /__rc_super', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)  // mocks super_admins returning [{ user_id }]
    await mockOrgs(page)
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/__rc_super')
    // Super admin lands on the super dashboard, not redirected
    await expect(page).not.toHaveURL('/')
  })

  test('super_admins table is queried on auth context init', async ({ page }) => {
    silenceRealtime(page)
    // Track whether super_admins was queried via response interception (more reliable than route handler)
    const superAdminsPromise = page.waitForResponse(
      resp => resp.url().includes('/rest/v1/super_admins') && resp.status() === 200,
      { timeout: 15000 },
    )
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.goto('/admin')
    const superAdminsResp = await superAdminsPromise
    expect(superAdminsResp.status()).toBe(200)
  })

  test('unit admin is NOT granted super access even with correct metadata', async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page)
    await page.goto('/__rc_super')
    // unit admin → isSuper=false → redirect to /
    await expect(page).toHaveURL('/')
  })
})

// ── SEC-001: Route guards ─────────────────────────────────────────────────────

test.describe('SEC-001: Route guards — unauthenticated access', () => {
  test('/admin redirects unauthenticated user to /admin/login', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login')
  })

  test('/admin/orgs/:id redirects unauthenticated', async ({ page }) => {
    silenceRealtime(page)
    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page).toHaveURL('/admin/login')
  })

  test('/admin/units/:id redirects unauthenticated', async ({ page }) => {
    silenceRealtime(page)
    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page).toHaveURL('/admin/login')
  })

  test('/admin/units/:id/members redirects unauthenticated', async ({ page }) => {
    silenceRealtime(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await expect(page).toHaveURL('/admin/login')
  })

  test('/admin/units/:id/events/:id redirects unauthenticated', async ({ page }) => {
    silenceRealtime(page)
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page).toHaveURL('/admin/login')
  })

  test('/__rc_super redirects unauthenticated user to /', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/__rc_super')
    await expect(page).toHaveURL('/')
  })
})

// ── SEC-002: Super admin route ────────────────────────────────────────────────

test.describe('SEC-002: /__rc_super is super-admin-only', () => {
  test('unit admin visiting /__rc_super is redirected to /', async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page)
    await page.goto('/__rc_super')
    await expect(page).toHaveURL('/')
  })

  test('unknown route redirects via catch-all', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/admin/__rc_super') // wrong path — user had this confusion
    // /admin/__rc_super is NOT matched by any specific admin route → catch-all → /
    // (Then Landing page renders; unauthenticated users just see the marketing page)
    await expect(page).toHaveURL('/')
  })

  test('super admin stays on /__rc_super after navigation', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/__rc_super')
    await expect(page).toHaveURL('/__rc_super')
  })
})

// ── SEC-003: Signup does not set role metadata ────────────────────────────────

test.describe('SEC-003: Admin signup — no role metadata injected', () => {
  test('signup form fields are email, password, confirm (no role field)', async ({ page }) => {
    await page.goto('/admin/signup')
    await expect(page.getByLabel('Email Address')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Confirm Password')).toBeVisible()
    // No role select or hidden role field
    await expect(page.locator('select[name="role"]')).not.toBeVisible()
    await expect(page.locator('input[name="role"]')).not.toBeVisible()
  })

  test('signup POST body does not include role in user_metadata', async ({ page }) => {
    let capturedBody: Record<string, unknown> = {}
    await page.route(`${SUPABASE_URL}/auth/v1/signup*`, async route => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'new-user', email: 'test@test.com' } }),
      })
    })
    // Mock signOut called after signup
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route =>
      route.fulfill({ status: 204, body: '' }),
    )
    await page.goto('/admin/signup')
    await page.getByLabel('Email Address').fill('newadmin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm Password').fill('password123')
    await page.getByRole('button', { name: /Get Started/i }).click()
    // Verify no role in data payload
    const data = capturedBody.data as Record<string, unknown> | undefined
    expect(data?.role).toBeUndefined()
  })

  test('signup with mismatched passwords shows error without calling API', async ({ page }) => {
    let signupCalled = false
    await page.route(`${SUPABASE_URL}/auth/v1/signup*`, () => { signupCalled = true })
    await page.goto('/admin/signup')
    await page.getByLabel('Email Address').fill('test@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm Password').fill('different456')
    await page.getByRole('button', { name: /Get Started/i }).click()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
    expect(signupCalled).toBe(false)
  })

  test('signup with password < 6 chars shows error without calling API', async ({ page }) => {
    let signupCalled = false
    await page.route(`${SUPABASE_URL}/auth/v1/signup*`, () => { signupCalled = true })
    await page.goto('/admin/signup')
    await page.getByLabel('Email Address').fill('test@example.com')
    await page.getByLabel('Password', { exact: true }).fill('abc')
    await page.getByLabel('Confirm Password').fill('abc')
    await page.getByRole('button', { name: /Get Started/i }).click()
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible()
    expect(signupCalled).toBe(false)
  })

  test('successful signup redirects to /admin/login with success message', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/signup*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: 'new-user', email: 'new@example.com' } }),
      }),
    )
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route =>
      route.fulfill({ status: 204, body: '' }),
    )
    await page.goto('/admin/signup')
    await page.getByLabel('Email Address').fill('new@example.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByLabel('Confirm Password').fill('password123')
    await page.getByRole('button', { name: /Get Started/i }).click()
    await expect(page).toHaveURL('/admin/login')
  })

  test('signup page already-signed-in admin redirects to /admin', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.goto('/admin/signup')
    await expect(page).toHaveURL('/admin')
  })
})

// ── SEC-004: Session lifecycle ────────────────────────────────────────────────

test.describe('SEC-004: Session lifecycle', () => {
  test('signing out clears session and redirects to /admin/login', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route =>
      route.fulfill({ status: 204, body: '' }),
    )
    await page.goto('/admin')
    // Click the sign-out button (last button in header)
    await page.locator('header').getByRole('button').last().click()
    await expect(page).toHaveURL('/admin/login')
  })

  test('localStorage session token is present when logged in', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.goto('/admin')
    const token = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
    expect(token).not.toBeNull()
  })
})

// ── SEC-005: Password reset flow ──────────────────────────────────────────────

test.describe('SEC-005: Forgot password flow', () => {
  test('forgot password page renders email input', async ({ page }) => {
    await page.goto('/admin/forgot-password')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send/i })).toBeVisible()
  })

  test('submitting email shows success message', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/recover*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/admin/forgot-password')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByRole('button', { name: /send/i }).click()
    // Success screen: "Check Your Inbox" heading appears
    await expect(page.getByText(/Check Your Inbox/i).first()).toBeVisible()
  })

  test('submitting unknown email still shows success (no enumeration)', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/recover*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/admin/forgot-password')
    await page.getByLabel(/email/i).fill('unknown@nowhere.com')
    await page.getByRole('button', { name: /send/i }).click()
    // Same success message regardless of whether email exists — no enumeration
    await expect(page.getByText(/Check Your Inbox/i).first()).toBeVisible()
  })

  test('forgot password API error shows error message', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/recover*`, route =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate_limit', message: 'Too many requests' }),
      }),
    )
    await page.goto('/admin/forgot-password')
    await page.getByLabel(/email/i).fill('admin@example.com')
    await page.getByRole('button', { name: /send/i }).click()
    // Error is shown in the form — any text indicating a problem
    await expect(page.locator('[class*="bg-red"], [class*="text-red"]').first()).toBeVisible()
  })

  test('back to login button navigates to /admin/login', async ({ page }) => {
    await page.goto('/admin/forgot-password')
    // The header has a "sign in" button (not a link) that goes back to login
    await page.getByRole('button', { name: /sign in/i }).first().click()
    await expect(page).toHaveURL('/admin/login')
  })
})
