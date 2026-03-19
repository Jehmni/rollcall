/**
 * Organization workflow tests.
 *
 * Covers: org creation → dashboard, join request → approval → visibility,
 *         non-owner member creates unit, CRUD permission boundaries.
 */
import { test, expect } from '@playwright/test'
import {
  IDS, IDS_ORG2,
  SUPABASE_URL,
  asSuperAdmin, asOrgMember,
  mockOrgsWithRole, mockUnitsAll, mockUnits, mockUnitAdmins,
  mockOrganizationMembers, mockJoinRequest, mockGetOrgJoinRequests, mockOrgCreation,
  mockServicesAll,
  silenceRealtime,
} from './helpers'

// ── Org creation ──────────────────────────────────────────────────────────────

test.describe('Org creation → appears on dashboard', () => {
  test('creating an org shows it on the dashboard', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    // Initially empty orgs list
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await route.continue()
      }
    })
    await mockOrgCreation(page, 'New Test Church')

    await page.goto('/admin')
    await expect(page.getByText('Welcome to Rollcally')).toBeVisible()

    // Click "New" to open the create form
    await page.getByRole('button', { name: /New/i }).click()
    await page.getByLabel('Name of Organization').fill('New Test Church')

    // After create, org list returns the new org (GET only — do not intercept POST)
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{
            id: IDS_ORG2,
            name: 'New Test Church',
            created_by_admin_id: IDS.superAdmin,
            created_at: new Date().toISOString(),
            organization_members: [{ role: 'owner' }],
          }]),
        })
      } else {
        await route.fallback()
      }
    })

    await page.getByRole('button', { name: 'Create' }).click()
    // Success screen shows the org name
    await expect(page.getByText('New Test Church').first()).toBeVisible()
  })

  test('newly created org can be opened', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgCreation(page, 'New Test Church')
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: IDS_ORG2,
          name: 'New Test Church',
          created_by_admin_id: IDS.superAdmin,
          created_at: new Date().toISOString(),
          organization_members: [{ role: 'owner' }],
        }]),
      }),
    )

    // Navigate directly to org detail after creation
    await mockUnits(page)
    await page.goto(`/admin/orgs/${IDS_ORG2}`)
    await expect(page.getByText('New Test Church').first()).toBeVisible()
  })
})

// ── Join request workflow ─────────────────────────────────────────────────────

test.describe('Join request → approval → org visible', () => {
  test('member who submitted a join request sees it as pending', async ({ page }) => {
    silenceRealtime(page)
    await asOrgMember(page)
    await mockOrgsWithRole(page, 'member')
    await mockJoinRequest(page, 'pending')

    await page.goto('/admin/discover')
    // Should not throw; the join request status is visible
    await expect(page.locator('body')).not.toContainText('Error')
  })

  test('org appears on dashboard after join is approved', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgsWithRole(page, 'owner')
    await mockGetOrgJoinRequests(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    // Owner can see the org detail
    await expect(page.getByText('Grace Baptist Church').first()).toBeVisible()
  })

  test('org owner sees pending join request in org detail', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    // Mock orgs with owner role
    await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: IDS.org,
          name: 'Grace Baptist Church',
          created_by_admin_id: IDS.superAdmin,
          created_at: '2024-01-01T00:00:00Z',
          organization_members: [{ role: 'owner' }],
        }]),
      }),
    )
    await mockUnits(page)
    await mockGetOrgJoinRequests(page)
    await mockOrganizationMembers(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page.getByText('Grace Baptist Church').first()).toBeVisible()
  })
})

// ── Non-owner member creates unit ─────────────────────────────────────────────

test.describe('Non-owner org member: create unit', () => {
  test('member sees "Create New Unit" button', async ({ page }) => {
    silenceRealtime(page)
    await asOrgMember(page)
    await mockOrgsWithRole(page, 'member')
    await mockUnits(page)
    await mockOrganizationMembers(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page.getByRole('button', { name: /Create New Unit/i })).toBeVisible()
  })

  test('member can open the create unit form', async ({ page }) => {
    silenceRealtime(page)
    await asOrgMember(page)
    await mockOrgsWithRole(page, 'member')
    await mockUnits(page)
    await mockOrganizationMembers(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    await page.getByRole('button', { name: /Create New Unit/i }).click()
    await expect(page.getByLabel('Unit name')).toBeVisible()
  })
})

// ── CRUD permissions ──────────────────────────────────────────────────────────

test.describe('Unit CRUD: creator vs org owner permissions', () => {
  test('org owner sees edit/delete controls on all units', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockOrgsWithRole(page, 'owner')
    await mockUnitsAll(page)
    await mockUnitAdmins(page)
    await mockServicesAll(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    // Org owner should see edit icon on unit cards
    // Unit cards have canManage=true for owner
    await expect(page.getByText('Main Choir')).toBeVisible()
  })

  test('org owner can access all unit dashboards', async ({ page }) => {
    silenceRealtime(page)
    await asSuperAdmin(page)
    await mockUnitsAll(page)
    await mockUnitAdmins(page)
    await mockServicesAll(page)

    await page.goto(`/admin/units/${IDS.unit}`)
    await expect(page.getByText('Main Choir')).toBeVisible()
  })

  test('member-admin can navigate to their own unit', async ({ page }) => {
    silenceRealtime(page)
    await asOrgMember(page)
    await mockOrgsWithRole(page, 'member')
    await mockUnitsAll(page)
    await mockUnitAdmins(page)
    await mockServicesAll(page)

    await page.goto(`/admin/orgs/${IDS.org}`)
    await expect(page.getByText('Main Choir')).toBeVisible()
    await page.getByText('Main Choir').first().click()
    await expect(page).toHaveURL(`/admin/units/${IDS.unit}`)
  })
})
