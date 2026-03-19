/**
 * Admin authentication — password login.
 *
 * Users: super admin, unit admins (choir director, youth leader, etc.)
 * Both use the same login page with email + password.
 */
import { test, expect } from '@playwright/test'
import {
  SUPABASE_URL, IDS,
  asSuperAdmin, asUnitAdmin,
  mockOrgs, mockUnitLookup, mockServices,
  silenceRealtime,
} from './helpers'

test.describe('Login page', () => {
  test('renders the admin login form', async ({ page }) => {
    await page.goto('/admin/login')
    await expect(page.getByText('Admin Portal').first()).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('PASSWORD')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('wrong credentials shows error message', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      }),
    )
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('wrong@example.com')
    await page.getByLabel('PASSWORD').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('password visibility toggle reveals the password', async ({ page }) => {
    await page.goto('/admin/login')
    const passwordField = page.getByLabel('PASSWORD')
    await passwordField.fill('mysecret')
    await expect(passwordField).toHaveAttribute('type', 'password')
    // Toggle visibility button (eye icon)
    await page.locator('button[type="button"]').last().click()
    await expect(passwordField).toHaveAttribute('type', 'text')
  })
})

test.describe('Auth-based redirects', () => {
  test('unauthenticated access to /admin redirects to login', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login')
  })

  test('unauthenticated access to a unit page redirects to login', async ({ page }) => {
    silenceRealtime(page)
    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page).toHaveURL('/admin/login')
  })

  test('super admin already logged in is redirected from login to /admin', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.goto('/admin/login')
    await expect(page).toHaveURL('/admin')
  })

  test('unit admin (single unit) is redirected from login directly to their unit', async ({ page }) => {
    silenceRealtime(page)
    // asUnitAdmin mocks unit_admins — DO NOT call mockUnitAdmins after this (LIFO would override)
    await asUnitAdmin(page, 1)
    // Unit admin has no org memberships — AdminDashboard uses this to decide on redirect
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await mockUnitLookup(page)
    await mockServices(page)
    await page.goto('/admin/login')
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })
})

test.describe('Sign out', () => {
  test('super admin can sign out and lands on login', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    await page.route(`${SUPABASE_URL}/auth/v1/logout*`, route =>
      route.fulfill({ status: 204, body: '' }),
    )
    await page.goto('/admin')
    await page.locator('header').getByRole('button').last().click()
    await expect(page).toHaveURL('/admin/login')
  })
})
