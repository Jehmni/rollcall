/**
 * Admin dashboard — organization and unit management.
 *
 * Super admin: sees all orgs → drills into units → creates services.
 * Unit admin:  goes directly to their unit dashboard.
 */
import { test, expect } from '@playwright/test'
import {
  SUPABASE_URL, IDS,
  asSuperAdmin, asUnitAdmin,
  mockOrgs, mockUnits, mockUnitsAll, mockUnitLookup, mockUnitName, mockUnitAdmins,
  mockServicesAll, mockServiceLookup, mockServicesWithPast,
  mockMembers, mockMembersAll, mockMemberSingle, mockGetServiceMembersFull,
  mockGetServiceMembersBothPresent,
  mockAttendanceWithAlice, mockAttendanceByMember,
  mockMembersHead,
  mockIsSuperAdminRpc,
  silenceRealtime,
} from './helpers'

// ─── Super admin: organization list ──────────────────────────────────────────

test.describe('Super admin: AdminDashboard', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
  })

  test('shows org list with organization name', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('Grace Baptist Church')).toBeVisible()
  })

  test('shows "System Overview" for super admin', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.getByText('System Overview')).toBeVisible()
  })

  test('shows "New" button to create organization', async ({ page }) => {
    await page.goto('/admin')
    // The button text is "New" with an icon span; use substring match
    await expect(page.getByRole('button', { name: /New/i }).first()).toBeVisible()
  })

  test('clicking org card navigates to org detail', async ({ page }) => {
    await mockUnits(page)
    await page.goto('/admin')
    await page.getByText('Grace Baptist Church').click()
    await expect(page).toHaveURL(`/admin/orgs/${IDS.org}`)
  })

  test('"New" button toggles the create form', async ({ page }) => {
    await page.goto('/admin')
    // Click the "New" button (icon + text); first() avoids FAB ambiguity
    await page.getByRole('button', { name: /New/i }).first().click()
    await expect(page.getByLabel('Name of Organization')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('cancel hides the create form', async ({ page }) => {
    await page.goto('/admin')
    await page.getByRole('button', { name: /New/i }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByLabel('Name of Organization')).not.toBeVisible()
  })
})

// ─── Super admin: org detail (unit list) ─────────────────────────────────────

test.describe('Super admin: OrgDetail', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgs(page)
    // mockUnitsAll handles both list (OrgDetail) and single (UnitDashboard after nav)
    await mockUnitsAll(page)
  })

  test('shows the org name and unit list', async ({ page }) => {
    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page.getByText('Grace Baptist Church').first()).toBeVisible()
    await expect(page.getByText('Main Choir')).toBeVisible()
  })

  test('shows "Create New Unit" button', async ({ page }) => {
    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page.getByRole('button', { name: /Create New Unit/i })).toBeVisible()
  })

  test('clicking "Create New Unit" shows create form', async ({ page }) => {
    await page.goto(`/admin/orgs/${IDS.org}`)
    await page.getByRole('button', { name: /Create New Unit/i }).click()
    await expect(page.getByLabel('Unit name')).toBeVisible()
    await expect(page.getByLabel(/Description/i)).toBeVisible()
  })

  test('clicking unit card navigates to unit dashboard', async ({ page }) => {
    // mockUnitsAll already set in beforeEach — no need to add more mocks;
    // URL check passes before UnitDashboard finishes loading.
    await mockUnitAdmins(page)
    await mockServicesAll(page)
    await page.goto(`/admin/orgs/${IDS.org}`)
    await page.getByText('Main Choir').first().click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })

  test('back arrow returns to super admin dashboard', async ({ page }) => {
    await page.goto(`/admin/orgs/${IDS.org}`)
    await page.locator('header button').first().click()
    await expect(page).toHaveURL('/admin')
  })
})

// ─── Unit admin: redirects ────────────────────────────────────────────────────

test.describe('Unit admin: single unit auto-redirect', () => {
  test('unit admin with one unit is redirected straight to their unit', async ({ page }) => {
    silenceRealtime(page)
    await mockServicesAll(page)
    // Mock organizations as empty (unit admin has no org memberships)
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    // asUnitAdmin registered LAST → highest priority for unit_admins (LIFO)
    await asUnitAdmin(page, 1)
    await page.goto('/admin')
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })
})

test.describe('Unit admin: multiple units — unit picker', () => {
  test('unit admin with multiple units sees a unit picker', async ({ page }) => {
    silenceRealtime(page)
    await asUnitAdmin(page, 2)
    await page.goto('/admin')
    await expect(page.getByText('Main Choir')).toBeVisible()
    await expect(page.getByText('Youth Choir')).toBeVisible()
    await expect(page.getByText('Direct Unit Access')).toBeVisible()
  })
})

// ─── UnitDashboard ────────────────────────────────────────────────────────────

test.describe('UnitDashboard', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockUnitAdmins(page)
    // mockServicesAll handles both list (UnitDashboard) and single (AdminServiceDetail)
    await mockServicesAll(page)
    // mockUnitLookup LAST → highest priority for units* (LIFO)
    await mockUnitLookup(page)
  })

  test('shows unit name', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page.getByText('Main Choir')).toBeVisible()
  })

  test('shows org name', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page.getByText('Grace Baptist Church')).toBeVisible()
  })

  test('shows upcoming services', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    // service_type is now displayed as-is (free-form text)
    await expect(page.getByText('rehearsal')).toBeVisible()
  })

  test('"New Event" button toggles create form', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await page.getByRole('button', { name: /New Event/i }).click()
    await expect(page.getByText('Schedule Event')).toBeVisible()
    await expect(page.getByLabel('Event Date')).toBeVisible()
    await expect(page.getByLabel('Event Type')).toBeVisible()
  })

  test('cancel hides service create form', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}`)
    await page.getByRole('button', { name: /New Event/i }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Schedule Event')).not.toBeVisible()
  })

  test('Members button in action bar navigates to members page', async ({ page }) => {
    await mockIsSuperAdminRpc(page)
    await mockUnitName(page)
    await mockMembers(page)
    await page.goto(`/admin/units/${IDS.unit}`)
    // The "Members" button is in the sticky action bar (not the header)
    await page.getByRole('button', { name: /Members/i }).click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}/members`)
  })

  test('clicking service card navigates to service detail', async ({ page }) => {
    // mockServicesAll in beforeEach already handles the single-service lookup
    await mockGetServiceMembersFull(page)
    await mockAttendanceWithAlice(page)
    await page.goto(`/admin/units/${IDS.unit}`)
    await page.getByText('rehearsal').click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}/events/${IDS.service}`)
  })
})

// ─── UnitMembers ──────────────────────────────────────────────────────────────

test.describe('UnitMembers', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockMembers(page)
    // mockUnitName LAST → highest priority for units* (LIFO)
    await mockUnitName(page)
  })

  test('shows member list', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('shows section headers (uppercase labels)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await expect(page.locator('p.uppercase').filter({ hasText: 'Soprano' })).toBeVisible()
    await expect(page.locator('p.uppercase').filter({ hasText: 'Bass' })).toBeVisible()
  })

  test('shows active member count in header', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await expect(page.getByText(/2 active/)).toBeVisible()
  })

  test('search filters members', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members`)
    // Override members mock (LIFO priority) to filter by search term
    await page.route(`${SUPABASE_URL}/rest/v1/members*`, async route => {
      const url = route.request().url().toLowerCase()
      if (url.includes('alice')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
          { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' },
        ]) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
          { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' },
          { id: IDS.member2, unit_id: IDS.unit, name: 'Bob Smith', phone: null, section: 'Bass', status: 'active', created_at: '2024-01-01T00:00:00Z' },
        ]) })
      }
    })
    await page.getByPlaceholder('Search members by name or section…').fill('Alice')
    await page.waitForTimeout(500) // wait for 400ms debounce + refetch
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).not.toBeVisible()
  })

  test('"Add Member" button shows the add member form', async ({ page }) => {
    await mockIsSuperAdminRpc(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    // "Add Member" button is in the action bar below the header (not in header)
    await page.getByRole('button', { name: /Add Member/i }).click()
    await expect(page.getByRole('heading', { name: 'Add Member' })).toBeVisible()
    await expect(page.getByLabel('Full name')).toBeVisible()
    await expect(page.getByLabel('Phone')).toBeVisible()
    await expect(page.getByLabel('Status')).toBeVisible()
  })

  test('cancel hides the add member form', async ({ page }) => {
    await mockIsSuperAdminRpc(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await page.getByRole('button', { name: /Add Member/i }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    // Check the form heading is gone (the action bar button remains visible)
    await expect(page.getByRole('heading', { name: 'Add Member' })).not.toBeVisible()
  })

  test('edit icon pre-fills the form with member data', async ({ page }) => {
    await mockIsSuperAdminRpc(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    // Click the edit button on Alice's row specifically
    await page.locator('.group').filter({ has: page.getByText('Alice Johnson', { exact: true }) }).locator('button[title="Edit"]').click()
    await expect(page.getByText('Edit Member')).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue('Alice Johnson')
    await expect(page.getByLabel('Phone')).toHaveValue('+2348001234567')
    await expect(page.getByLabel(/Section/)).toHaveValue('Soprano')
  })

  test('back arrow navigates to unit dashboard', async ({ page }) => {
    await mockUnitAdmins(page)
    await mockServicesAll(page)
    await mockUnitLookup(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await page.locator('header button').first().click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })
})

// ─── AdminServiceDetail ───────────────────────────────────────────────────────

test.describe('AdminServiceDetail', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockAttendanceWithAlice(page) // Alice present, Bob absent
    await mockMembersHead(page)         // total = 2 for attendance rate
    await mockGetServiceMembersFull(page)
    // mockServiceLookup LAST → highest priority for services* (LIFO)
    await mockServiceLookup(page)
  })

  test('shows service type and formatted date', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // service_type now displays as-is (free-form); date 2026-12-10 → "DECEMBER 10, 2026"
    await expect(page.getByText('rehearsal')).toBeVisible()
    await expect(page.getByText(/December/i)).toBeVisible()
  })

  test('shows attendance stat cards', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Stat card labels: Total, Present, Absent, Rate
    await expect(page.getByText('Total')).toBeVisible()
    await expect(page.getByText('Rate')).toBeVisible()
  })

  test('shows correct attendance rate (1 present, 1 absent = 50%)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText('50%')).toBeVisible()
  })

  test('QR code section is collapsed by default', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Button shows "Expand" when collapsed; QR canvas hidden
    await expect(page.getByRole('button', { name: /Expand/i })).toBeVisible()
    await expect(page.locator('#service-qr')).not.toBeVisible()
  })

  test('clicking QR section header expands and shows the QR canvas', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.getByRole('button', { name: /Expand/i }).click()
    await expect(page.locator('#service-qr')).toBeVisible()
    await expect(page.getByText('Download QR PNG')).toBeVisible()
  })

  test('clicking QR section again collapses it', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.getByRole('button', { name: /Expand/i }).click()
    await expect(page.locator('#service-qr')).toBeVisible()
    // After expand, button text becomes "Collapse"
    await page.getByRole('button', { name: /Collapse/i }).click()
    await expect(page.locator('#service-qr')).not.toBeVisible()
  })

  test('absent tab shows Bob (absent), not Alice (present)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Default tab is "all" — must click Absent tab first
    await page.getByRole('button', { name: /Absent/i }).click()
    await expect(page.getByText('Bob Smith')).toBeVisible()
    await expect(page.getByText('Alice Johnson')).not.toBeVisible()
  })

  test('present tab shows Alice (present)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.getByRole('button', { name: /Present/i }).click()
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).not.toBeVisible()
  })

  test('all tab shows both members', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // "all" is the default tab — both visible immediately
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Bob Smith')).toBeVisible()
  })

  test('export buttons appear on absent tab', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Export buttons (icon-only, with title attr) only shown on absent tab
    await page.getByRole('button', { name: /Absent/i }).click()
    await expect(page.locator('button[title="Export TXT"]')).toBeVisible()
    await expect(page.locator('button[title="Export CSV"]')).toBeVisible()
    await expect(page.locator('button[title="Export RTF (Word)"]')).toBeVisible()
  })

  test('export buttons not shown on present tab', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.getByRole('button', { name: /Present/i }).click()
    await expect(page.locator('button[title="Export TXT"]')).not.toBeVisible()
  })

  test('all-tab members are grouped by section', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Section headers are <p> elements (not h3)
    await expect(page.locator('p').filter({ hasText: 'Bass' }).first()).toBeVisible()
    await expect(page.locator('p').filter({ hasText: 'Soprano' }).first()).toBeVisible()
  })

  test('present member shows Checked In badge', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.getByRole('button', { name: /Present/i }).click()
    await expect(page.getByText('Checked In')).toBeVisible()
  })

  test('back arrow returns to unit dashboard', async ({ page }) => {
    await mockUnitAdmins(page)
    await mockServicesAll(page)
    await mockUnitLookup(page)
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await page.locator('header button').first().click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })
})

// ─── MemberDetail ─────────────────────────────────────────────────────────────

test.describe('MemberDetail', () => {
  test.beforeEach(async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockAttendanceByMember(page)  // Alice attended servicePast
    await mockServicesWithPast(page)    // upcoming + past service
    // mockMemberSingle LAST → highest priority for members* (LIFO)
    await mockMemberSingle(page)
  })

  test('shows member name and section', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.getByText('Alice Johnson')).toBeVisible()
    await expect(page.getByText('Soprano')).toBeVisible()
  })

  test('shows member phone', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.getByText('+2348001234567')).toBeVisible()
  })

  test('shows stat cards', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.getByText('Attended')).toBeVisible()
    await expect(page.getByText('Total Events')).toBeVisible()
    await expect(page.getByText('Attendance Rate')).toBeVisible()
    await expect(page.getByText('Current Streak')).toBeVisible()
  })

  test('calculates attended count and rate correctly (1/1 past = 100%)', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.getByText('100%')).toBeVisible()
  })

  test('shows service history section', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.getByText('Historical Log')).toBeVisible()
  })

  test('past attended service shows Present badge', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await expect(page.locator('span.rounded-full', { hasText: 'Present' })).toBeVisible()
  })

  test('upcoming service shows Upcoming badge', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    // Upcoming status uses badge text "On Orders"
    await expect(page.getByText('On Orders')).toBeVisible()
  })

  test('shows recent trend section when there are past services', async ({ page }) => {
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    // Section heading is "Activity Score · Last N Events"
    await expect(page.getByText(/Activity Score/i)).toBeVisible()
  })

  test('back arrow returns to members list', async ({ page }) => {
    await mockMembers(page) // for UnitMembers after back navigation
    await mockUnitName(page)
    await page.goto(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
    await page.locator('header button').first().click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}/members`)
  })
})

test.describe('UnitMembers: member row navigation', () => {
  test('clicking member row navigates to member detail', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockAttendanceByMember(page)
    await mockServicesWithPast(page)
    // mockMembersAll handles both list (UnitMembers) and single (MemberDetail)
    await mockMembersAll(page)
    // mockUnitName LAST → highest priority for units* (LIFO)
    await mockUnitName(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await page.getByText('Alice Johnson').click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}/members/${IDS.member1}`)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('Edge cases', () => {
  test('empty org list shows placeholder', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/admin')
    await expect(page.getByText('Welcome to Rollcally')).toBeVisible()
  })

  test('empty services list shows placeholder', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockUnitAdmins(page)
    await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await mockUnitLookup(page)
    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page.getByText('No Events Yet')).toBeVisible()
  })

  test('empty member list shows placeholder in UnitMembers', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await page.route(`${SUPABASE_URL}/rest/v1/members*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    )
    await mockUnitName(page)
    await page.goto(`/admin/units/${IDS.unit}/members`)
    await expect(page.getByText('No members yet')).toBeVisible()
  })

  test('"All members accounted for!" shown when nobody is absent', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockMembersHead(page)                      // total = 2
    await mockGetServiceMembersBothPresent(page)     // both checked_in: true
    await mockServiceLookup(page)
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    // Must click Absent tab — default is "all"
    await page.getByRole('button', { name: /Absent/i }).click()
    await expect(page.getByText('All members accounted for!')).toBeVisible()
  })

  test('100% attendance rate shown when all members present', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockMembersHead(page)                      // total = 2
    await mockGetServiceMembersBothPresent(page)     // both checked_in: true
    await mockServiceLookup(page)
    await page.goto(`/admin/units/${IDS.unit}/events/${IDS.service}`)
    await expect(page.getByText('100%')).toBeVisible()
  })
})
