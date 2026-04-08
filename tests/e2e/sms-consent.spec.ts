/**
 * SMS consent flow — shown after successful check-in when unit has SMS enabled.
 *
 * Covers:
 *  - No consent prompt when unit has SMS disabled
 *  - Consent prompt appears after successful check-in when SMS enabled
 *  - "Yes, that's fine" calls set_member_sms_consent RPC
 *  - "No thanks" dismisses the prompt without calling RPC
 *  - Prompt is not shown again once answered (localStorage key set)
 *  - Prompt shows unit name in the copy
 */
import { test, expect } from '@playwright/test'
import {
  IDS,
  SUPABASE_URL,
  mockGetServiceMembers,
  mockCheckinSuccess,
  silenceRealtime,
} from './helpers'

// ─── Shared service mocks ─────────────────────────────────────────────────────

/** Mock services endpoint — returns require_location + the unit join */
async function mockServiceInfo(
  page: import('@playwright/test').Page,
  opts: { smsEnabled?: boolean } = {},
) {
  const { smsEnabled = false } = opts

  // Service lookup (useServiceInfo calls .from('services').select('unit_id, require_location, units(name)'))
  await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.pgrst.object+json',
      body: JSON.stringify({
        unit_id: IDS.unit,
        require_location: false,
        units: { name: 'Main Choir' },
      }),
    }),
  )

  // unit_messaging_settings — controls smsEnabled flag
  await page.route(`${SUPABASE_URL}/rest/v1/unit_messaging_settings*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(smsEnabled ? [{ enabled: true }] : []),
    }),
  )
}

/** Mock the set_member_sms_consent RPC */
async function mockSmsConsentRpc(page: import('@playwright/test').Page) {
  let called = false
  let calledWith: Record<string, unknown> | null = null

  await page.route(`${SUPABASE_URL}/rest/v1/rpc/set_member_sms_consent*`, route => {
    called = true
    try { calledWith = JSON.parse(route.request().postData() ?? '{}') } catch { /* ignore */ }
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })

  return { getCalled: () => called, getCalledWith: () => calledWith }
}

/** Run through the check-in flow to reach the success screen */
async function doCheckin(page: import('@playwright/test').Page) {
  await page.goto(`/checkin?service_id=${IDS.service}`)
  await page.getByPlaceholder('Search your name…').fill('Ali')
  await page.getByText('Alice Johnson').click()
  await page.getByRole('button', { name: 'Yes, check me in' }).click()
  // Wait for success screen
  await expect(page.getByText("You're in!")).toBeVisible()
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('SMS consent: disabled (unit has SMS off)', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinSuccess(page)
    await mockServiceInfo(page, { smsEnabled: false })
  })

  test('no SMS consent prompt shown when unit SMS is disabled', async ({ page }) => {
    await doCheckin(page)
    await expect(page.getByText(/Stay in the loop/i)).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Yes, that's fine/i })).not.toBeVisible()
  })
})

test.describe('SMS consent: enabled (unit has SMS on)', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinSuccess(page)
    await mockServiceInfo(page, { smsEnabled: true })
    // Push notifications not supported in test environment — keep pushOptIn resolved
    await page.addInitScript(() => {
      // Stub Notification API so push prompt is skipped
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'denied' },
        writable: true,
      })
    })
  })

  test('SMS consent prompt appears after successful check-in', async ({ page }) => {
    await mockSmsConsentRpc(page)
    await doCheckin(page)
    // The SMS consent card copy
    await expect(page.getByText(/Stay in the loop/i)).toBeVisible({ timeout: 5000 })
  })

  test('consent prompt shows unit name in the copy', async ({ page }) => {
    await mockSmsConsentRpc(page)
    await doCheckin(page)
    // "Main Choir" appears in the SMS consent prompt (may appear multiple times on page)
    await expect(page.getByText(/Main Choir/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('"Yes, that\'s fine" calls set_member_sms_consent with consent=true', async ({ page }) => {
    const { getCalled } = await mockSmsConsentRpc(page)
    await doCheckin(page)
    const yesBtn = page.getByRole('button', { name: /Yes, that's fine/i })
    await yesBtn.waitFor({ timeout: 5000 })
    await yesBtn.click()
    // RPC should have been called
    await page.waitForTimeout(500)
    expect(getCalled()).toBe(true)
  })

  test('"Yes, that\'s fine" dismisses the prompt', async ({ page }) => {
    await mockSmsConsentRpc(page)
    await doCheckin(page)
    const yesBtn = page.getByRole('button', { name: /Yes, that's fine/i })
    await yesBtn.waitFor({ timeout: 5000 })
    await yesBtn.click()
    await expect(page.getByText(/Stay in the loop/i)).not.toBeVisible({ timeout: 3000 })
  })

  test('"No thanks" dismisses the prompt (calls RPC with consent=false)', async ({ page }) => {
    const { getCalled, getCalledWith } = await mockSmsConsentRpc(page)
    await doCheckin(page)
    const noBtn = page.getByRole('button', { name: /No thanks/i })
    await noBtn.waitFor({ timeout: 5000 })
    await noBtn.click()
    await page.waitForTimeout(800)
    // RPC is called with consent=false to record the decline
    expect(getCalled()).toBe(true)
    const payload = getCalledWith()
    expect(payload).toMatchObject({ p_consent: false })
    await expect(page.getByText(/Stay in the loop/i)).not.toBeVisible()
  })

  test('"No thanks" dismisses without crashing the page', async ({ page }) => {
    await mockSmsConsentRpc(page)
    await doCheckin(page)
    const noBtn = page.getByRole('button', { name: /No thanks/i })
    await noBtn.waitFor({ timeout: 5000 })
    await noBtn.click()
    // Success screen still shown, Done button visible
    await expect(page.getByRole('button', { name: /Done/i })).toBeVisible()
  })

  test('consent prompt not shown again when localStorage key already set', async ({ page }) => {
    // Pre-set the "already asked" key in localStorage
    await page.addInitScript(() => {
      // member id from the mock is IDS.member1, unit id is IDS.unit
      const memberId = 'eeeeeeee-0000-0000-0000-000000000001'
      const unitId   = 'cccccccc-0000-0000-0000-000000000001'
      localStorage.setItem(`rollcally_sms_asked_${memberId}_${unitId}`, '1')
    })
    await mockSmsConsentRpc(page)
    await doCheckin(page)
    // Prompt should be skipped
    await expect(page.getByText(/Stay in the loop/i)).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('SMS consent: consent prompt legal copy', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await mockGetServiceMembers(page)
    await mockCheckinSuccess(page)
    await mockServiceInfo(page, { smsEnabled: true })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Notification', {
        value: { permission: 'denied' }, writable: true,
      })
    })
  })

  test('prompt mentions standard message rates', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/set_member_sms_consent*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    )
    await doCheckin(page)
    const prompt = page.getByText(/Stay in the loop/i)
    await prompt.waitFor({ timeout: 5000 })
    await expect(page.getByText(/Standard message rates/i)).toBeVisible()
  })

  test('prompt mentions ability to change consent at any time', async ({ page }) => {
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/set_member_sms_consent*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    )
    await doCheckin(page)
    await page.getByText(/Stay in the loop/i).waitFor({ timeout: 5000 })
    await expect(page.getByText(/You can change this at any time/i)).toBeVisible()
  })
})
