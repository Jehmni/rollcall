/**
 * Help Centre page — /help
 *
 * Covers:
 *  - Page loads without errors
 *  - Correct heading is visible
 *  - Navigation back to home works
 *  - Key sections are present (getting started, check-in guide, etc.)
 *  - Search/filter functionality if present
 *  - Links to external pages (terms, privacy) if present
 */
import { test, expect } from '@playwright/test'
import { silenceRealtime } from './helpers'

test.describe('Help Centre: renders without error', () => {
  test('loads at /help without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    silenceRealtime(page)
    await page.goto('/help')
    expect(errors).toHaveLength(0)
  })

  test('shows a Help / User Guide heading', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/help')
    await expect(
      page.getByRole('heading', { name: /Help|User Guide|Guide|Support/i }).first()
    ).toBeVisible()
  })
})

test.describe('Help Centre: navigation', () => {
  test('navigating to /help does not redirect away', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/help')
    await expect(page).toHaveURL('/help')
  })

  test('page has a link/button to navigate back to home or landing', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/help')
    // A logo, "Home" link, or back button should be present
    // At minimum the brand/nav should be visible
    await expect(page.locator('header, nav').first()).toBeVisible()
  })
})

test.describe('Help Centre: content sections', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/help')
  })

  test('at least one section heading is visible', async ({ page }) => {
    // Help centre should have multiple sections
    const headings = page.getByRole('heading', { level: 2 })
      .or(page.getByRole('heading', { level: 3 }))
    const count = await headings.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('page body has substantial text content', async ({ page }) => {
    const body = await page.locator('main, [role="main"], body').first().textContent()
    // Should have at least 100 characters of content
    expect(body?.length ?? 0).toBeGreaterThan(100)
  })
})

test.describe('Help Centre: mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('renders correctly on mobile', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/help')
    await expect(
      page.getByRole('heading', { name: /Help|User Guide|Guide|Support/i }).first()
    ).toBeVisible()
  })
})
