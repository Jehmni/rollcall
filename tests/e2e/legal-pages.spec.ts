/**
 * Legal pages — Terms of Service and Privacy Policy.
 *
 * Covers:
 *  - /terms and /privacy load without error
 *  - Correct page titles and headings
 *  - Table of contents present
 *  - Cross-linking between terms/privacy
 *  - Links from AdminSignup to /terms and /privacy
 *  - Logo/brand present on both pages
 */
import { test, expect } from '@playwright/test'

test.describe('Terms of Service page', () => {
  test('loads at /terms without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/terms')
    expect(errors).toHaveLength(0)
  })

  test('displays correct H1 heading', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeVisible()
  })

  test('displays effective date', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByText(/Effective date/i).first()).toBeVisible()
  })

  test('has a table of contents with numbered sections', async ({ page }) => {
    await page.goto('/terms')
    // At least 10 TOC entries
    const tocLinks = page.locator('nav a[href^="#"]')
    const count = await tocLinks.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('contains acceptance section', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: /Acceptance of Terms/i })).toBeVisible()
  })

  test('contains limitation of liability section', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: /Limitation of Liability/i })).toBeVisible()
  })

  test('links to Privacy Policy page', async ({ page }) => {
    await page.goto('/terms')
    await page.getByRole('link', { name: /Privacy Policy/i }).first().click()
    await expect(page).toHaveURL('/privacy')
  })

  test('Rollcally logo is visible', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('header img[src="/logo.png"]')).toBeVisible()
  })

  test('footer links to /terms, /privacy and /', async ({ page }) => {
    await page.goto('/terms')
    const footer = page.locator('footer')
    await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible()
    await expect(footer.getByRole('link', { name: 'Home' })).toBeVisible()
  })

  test('back navigation to home works from Terms page', async ({ page }) => {
    await page.goto('/terms')
    await page.locator('footer').getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Privacy Policy page', () => {
  test('loads at /privacy without error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/privacy')
    expect(errors).toHaveLength(0)
  })

  test('displays correct H1 heading', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeVisible()
  })

  test('displays effective date', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByText(/Effective date/i).first()).toBeVisible()
  })

  test('has a table of contents with numbered sections', async ({ page }) => {
    await page.goto('/privacy')
    const tocLinks = page.locator('nav a[href^="#"]')
    const count = await tocLinks.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('contains data collection section', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /Data We Collect/i })).toBeVisible()
  })

  test('contains GDPR legal basis section', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /Legal Basis/i })).toBeVisible()
  })

  test('contains California / CCPA section', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /California/i })).toBeVisible()
  })

  test('contains your rights section', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: /Your Rights/i })).toBeVisible()
  })

  test('links to Terms of Service page', async ({ page }) => {
    await page.goto('/privacy')
    await page.getByRole('link', { name: /Terms of Service/i }).first().click()
    await expect(page).toHaveURL('/terms')
  })

  test('Rollcally logo is visible', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('header img[src="/logo.png"]')).toBeVisible()
  })
})

test.describe('AdminSignup: legal links', () => {
  test('Terms of Service link is present and navigates to /terms', async ({ page }) => {
    await page.goto('/admin/signup')
    await page.getByRole('link', { name: /Terms of Service/i }).click()
    await expect(page).toHaveURL('/terms')
  })

  test('Privacy Policy link is present and navigates to /privacy', async ({ page }) => {
    await page.goto('/admin/signup')
    await page.getByRole('link', { name: /Privacy Policy/i }).click()
    await expect(page).toHaveURL('/privacy')
  })

  test('both legal links open inline (no target=_blank causing blank page)', async ({ page }) => {
    await page.goto('/admin/signup')
    const termsLink = page.getByRole('link', { name: /Terms of Service/i })
    const target = await termsLink.getAttribute('target')
    // Should NOT open in new tab — use React Router Link component
    expect(target).not.toBe('_blank')
  })
})
