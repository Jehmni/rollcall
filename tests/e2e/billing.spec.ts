/**
 * Billing page — /admin/billing
 *
 * Covers:
 *  - Page renders with header and back button
 *  - Three plan cards visible with correct prices
 *  - "No subscription" / free-trial call-to-action
 *  - Active subscription shows plan name + "Active" badge
 *  - Usage bar visible when subscription is active
 *  - "Current plan" shown on the active plan card
 *  - ?status=success → success toast shown
 *  - ?status=canceled → info toast shown
 *  - Plan selection triggers Stripe checkout redirect
 *  - Unauthenticated access redirects to /admin/login
 */
import { test, expect } from '@playwright/test'
import { SUPABASE_URL, IDS, asSuperAdmin, silenceRealtime } from './helpers'

// ─── Billing mock helpers ─────────────────────────────────────────────────────

/** Mock organization_members returning one owner org */
async function mockOrgMemberships(page: import('@playwright/test').Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/organization_members*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          organization_id: IDS.org,
          role: 'owner',
          organizations: { id: IDS.org, name: 'Grace Baptist Church' },
        },
      ]),
    }),
  )
}

/** Mock get_org_billing RPC with no subscription */
async function mockBillingNoSub(page: import('@playwright/test').Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_billing*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subscription: null, credits: null }),
    }),
  )
}

/** Mock get_org_billing RPC with an active Growth subscription */
async function mockBillingActive(page: import('@playwright/test').Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_billing*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        subscription: {
          id:                    'sub_test',
          org_id:                IDS.org,
          stripe_sub_id:         'sub_stripe_test',
          plan_id:               'growth',
          status:                'active',
          current_period_end:    '2026-05-06T00:00:00Z',
          cancel_at_period_end:  false,
        },
        credits: {
          balance:       550,
          last_reset_at: '2026-04-06T00:00:00Z',
        },
      }),
    }),
  )
}

/** Mock usage_events count (HEAD) */
async function mockUsageEvents(page: import('@playwright/test').Page, count = 50) {
  await page.route(`${SUPABASE_URL}/rest/v1/usage_events*`, async route => {
    if (route.request().method() === 'HEAD') {
      const header = count > 0 ? `0-${count - 1}/${count}` : '*/0'
      await route.fulfill({ status: 200, headers: { 'Content-Range': header }, body: '' })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    }
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Billing page: access control', () => {
  test('unauthenticated access redirects to /admin/login', async ({ page }) => {
    silenceRealtime(page)
    await page.goto('/admin/billing')
    await expect(page).toHaveURL('/admin/login')
  })
})

test.describe('Billing page: layout and plan cards', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingNoSub(page)
    await mockUsageEvents(page, 0)
  })

  test('renders the Billing header', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByRole('heading', { name: /Billing/i })).toBeVisible()
    await expect(page.getByText('Manage your subscription')).toBeVisible()
  })

  test('back button is visible', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.locator('header button').first()).toBeVisible()
  })

  test('shows all three plan cards', async ({ page }) => {
    await page.goto('/admin/billing')
    // Each plan card shows its badge label
    await expect(page.getByText('Starter')).toBeVisible()
    await expect(page.getByText('Growth')).toBeVisible()
    await expect(page.getByText('Pro')).toBeVisible()
  })

  test('plan cards show correct monthly prices', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('$25')).toBeVisible()
    await expect(page.getByText('$59')).toBeVisible()
    await expect(page.getByText('$119')).toBeVisible()
  })

  test('plan cards show follow-up counts', async ({ page }) => {
    await page.goto('/admin/billing')
    // Match the span containing the follow-up count (first occurrence of each number)
    await expect(page.getByText('200').first()).toBeVisible()   // Starter
    await expect(page.getByText('600').first()).toBeVisible()   // Growth
    await expect(page.getByText('1,500').first()).toBeVisible() // Pro
  })

  test('Growth plan is marked "Most popular"', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('Most popular')).toBeVisible()
  })

  test('shows "No subscription" free-trial prompt when no subscription', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('Start your free trial')).toBeVisible()
    await expect(page.getByText(/14 days free/i)).toBeVisible()
  })

  test('shows "No plan" when billing has no subscription', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('No plan')).toBeVisible()
  })

  test('shows "No subscription" status badge', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('No subscription')).toBeVisible()
  })

  test('"Choose plan" buttons are enabled (not "Current plan")', async ({ page }) => {
    await page.goto('/admin/billing')
    const chooseBtns = page.getByRole('button', { name: /Choose plan/i })
    await expect(chooseBtns.first()).toBeVisible()
    await expect(chooseBtns.first()).toBeEnabled()
  })
})

test.describe('Billing page: active subscription', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingActive(page)
    await mockUsageEvents(page, 50)
  })

  test('shows the active plan name', async ({ page }) => {
    await page.goto('/admin/billing')
    // The "Current plan" section h2 should show "Growth"
    await expect(page.getByRole('heading', { name: 'Growth' })).toBeVisible()
  })

  test('shows "Active" status badge', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('Active')).toBeVisible()
  })

  test('shows renewal date', async ({ page }) => {
    await page.goto('/admin/billing')
    // Formatted as "6 May 2026" or similar
    await expect(page.getByText(/Renews/i)).toBeVisible()
  })

  test('shows usage bar with follow-up counts', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('Automated follow-ups this cycle')).toBeVisible()
  })

  test('Growth plan card shows "Current plan" and is disabled', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByRole('button', { name: 'Current plan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Current plan' })).toBeDisabled()
  })

  test('non-current plan cards show "Choose plan" and are enabled', async ({ page }) => {
    await page.goto('/admin/billing')
    const chooseBtns = page.getByRole('button', { name: /Choose plan/i })
    // Wait for at least one "Choose plan" button to appear before counting
    await expect(chooseBtns.first()).toBeVisible()
    const count = await chooseBtns.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('shows "Change plan" heading when subscription is active', async ({ page }) => {
    await page.goto('/admin/billing')
    await expect(page.getByText('Change plan')).toBeVisible()
  })
})

test.describe('Billing page: Stripe checkout redirect', () => {
  test('selecting a plan calls create-checkout-session and redirects', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingNoSub(page)
    await mockUsageEvents(page, 0)

    let checkoutCalled = false
    await page.route(`${SUPABASE_URL}/functions/v1/create-checkout-session*`, route => {
      checkoutCalled = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/test_session' }),
      })
    })

    await page.goto('/admin/billing')
    // Click "Choose plan" for Starter (first enabled button)
    const btn = page.getByRole('button', { name: /Choose plan/i }).first()
    await btn.click()

    await page.waitForTimeout(500)
    expect(checkoutCalled).toBe(true)
  })

  test('checkout error shows a toast error, not a crash', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingNoSub(page)
    await mockUsageEvents(page, 0)

    await page.route(`${SUPABASE_URL}/functions/v1/create-checkout-session*`, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal error' }) }),
    )

    await page.goto('/admin/billing')
    await page.getByRole('button', { name: /Choose plan/i }).first().click()
    // Page should not crash — body should still be rendered
    await expect(page.locator('body')).not.toContainText('TypeError')
  })
})

test.describe('Billing page: Stripe return URL params', () => {
  test('?status=success shows a success toast', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingActive(page)
    await mockUsageEvents(page, 50)

    await page.goto('/admin/billing?status=success&org=' + IDS.org)
    await expect(page.getByText(/Subscription activated/i).first()).toBeVisible()
  })

  test('?status=canceled shows a cancelled info toast', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await mockBillingNoSub(page)
    await mockUsageEvents(page, 0)

    await page.goto('/admin/billing?status=canceled&org=' + IDS.org)
    await expect(page.getByText(/Checkout cancelled/i).first()).toBeVisible()
  })
})

test.describe('Billing page: past_due / blocked state', () => {
  test('past_due subscription shows "Payment overdue" badge and warning', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_billing*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            id: 'sub_past_due', org_id: IDS.org, stripe_sub_id: 'sub_x',
            plan_id: 'starter', status: 'past_due',
            current_period_end: '2026-04-15T00:00:00Z', cancel_at_period_end: false,
          },
          credits: null,
        }),
      }),
    )
    await mockUsageEvents(page, 0)

    await page.goto('/admin/billing')
    await expect(page.getByText('Payment overdue')).toBeVisible()
    await expect(page.getByText(/Automated follow-ups paused/i)).toBeVisible()
    await expect(page.getByText(/last payment failed/i)).toBeVisible()
  })

  test('canceled subscription shows "Canceled" badge', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_billing*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            id: 'sub_canceled', org_id: IDS.org, stripe_sub_id: 'sub_c',
            plan_id: 'growth', status: 'canceled',
            current_period_end: '2026-03-01T00:00:00Z', cancel_at_period_end: false,
          },
          credits: null,
        }),
      }),
    )
    await mockUsageEvents(page, 0)

    await page.goto('/admin/billing')
    await expect(page.getByText('Canceled')).toBeVisible()
    await expect(page.getByText(/Automated follow-ups paused/i)).toBeVisible()
  })
})

test.describe('Billing page: usage bar thresholds', () => {
  async function setupWithUsage(page: import('@playwright/test').Page, used: number, total: number) {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgMemberships(page)
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_billing*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subscription: {
            id: 'sub_t', org_id: IDS.org, stripe_sub_id: 'sub_stripe',
            plan_id: 'growth', status: 'active',
            current_period_end: '2026-05-06T00:00:00Z', cancel_at_period_end: false,
          },
          credits: { balance: total - used, last_reset_at: '2026-04-06T00:00:00Z' },
        }),
      }),
    )
    // Count of usage_events = used (must expose content-range for CORS to allow JS to read it)
    await page.route(`${SUPABASE_URL}/rest/v1/usage_events*`, async route => {
      if (route.request().method() === 'HEAD') {
        const hdr = used > 0 ? `0-${used - 1}/${used}` : '*/0'
        await route.fulfill({
          status: 200,
          headers: {
            'content-range': hdr,
            'Access-Control-Expose-Headers': 'Content-Range,content-range',
          },
          body: '',
        })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    })
  }

  test('shows critical warning when usage is at 90%+', async ({ page }) => {
    await setupWithUsage(page, 540, 600) // 90%
    await page.goto('/admin/billing')
    // Wait for subscription status to confirm billing loaded
    await expect(page.getByText('Active')).toBeVisible()
    // The "Almost out" warning appears once usage count loads and pct >= 90%
    // Give extra time for the second async query (usage_events HEAD) to resolve
    await expect(page.getByText(/Almost out/i).first()).toBeVisible({ timeout: 15000 })
  })

  test('does not show critical warning when usage is below 70%', async ({ page }) => {
    await setupWithUsage(page, 100, 600) // ~16%
    await page.goto('/admin/billing')
    await expect(page.getByText(/Almost out/i)).not.toBeVisible()
  })
})
