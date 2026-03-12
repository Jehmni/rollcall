/**
 * Admin authentication — magic link login.
 *
 * Users: super admin, unit admins (choir director, youth leader, etc.)
 * Both use the same login page. Role is determined by Supabase user_metadata after sign-in.
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
    await expect(page.getByText('Admin Login')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send sign-in link' })).toBeVisible()
  })

  test('submitting a valid email shows "check your email" screen', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/otp*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('admin@example.com')
    await page.getByRole('button', { name: 'Send sign-in link' }).click()
    await expect(page.getByText('Check your email')).toBeVisible()
    await expect(page.getByText('admin@example.com')).toBeVisible()
    await expect(page.getByText('Use a different email')).toBeVisible()
  })

  test('"Use a different email" returns to the email form', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/otp*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    )
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('admin@example.com')
    await page.getByRole('button', { name: 'Send sign-in link' }).click()
    await page.getByText('Use a different email').click()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send sign-in link' })).toBeVisible()
  })

  test('unregistered email shows error message', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/auth/v1/otp*`, route =>
      route.fulfill({ status: 422, contentType: 'application/json',
        body: JSON.stringify({ error: 'Signup disabled' }) }),
    )
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill('unknown@example.com')
    await page.getByRole('button', { name: 'Send sign-in link' }).click()
    await expect(page.getByText('Could not send link')).toBeVisible()
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
