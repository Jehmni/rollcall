import type { Page } from '@playwright/test'

export const SUPABASE_URL = 'https://rlqbnohpepimietldrdj.supabase.co'
export const PROJECT_REF = 'rlqbnohpepimietldrdj'
export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

// Fixed UUIDs for test data
export const IDS = {
  superAdmin:  'aaaaaaaa-0000-0000-0000-000000000001',
  unitAdmin:   'aaaaaaaa-0000-0000-0000-000000000002',
  org:         'bbbbbbbb-0000-0000-0000-000000000001',
  unit:        'cccccccc-0000-0000-0000-000000000001',
  unit2:       'cccccccc-0000-0000-0000-000000000002',
  service:     'dddddddd-0000-0000-0000-000000000001', // upcoming  2026-03-10
  servicePast: 'dddddddd-0000-0000-0000-000000000002', // past      2026-03-05
  member1:     'eeeeeeee-0000-0000-0000-000000000001', // Alice – present
  member2:     'eeeeeeee-0000-0000-0000-000000000002', // Bob   – absent
}

// Canned data
const UNIT_SINGLE = {
  id: IDS.unit, org_id: IDS.org, name: 'Main Choir', description: null,
  created_at: '2024-01-01T00:00:00Z', created_by_admin_id: IDS.superAdmin,
  organization: {
    id: IDS.org, name: 'Grace Baptist Church',
    created_by_admin_id: IDS.superAdmin, created_at: '2024-01-01T00:00:00Z',
    organization_members: [{ role: 'owner', admin_id: IDS.superAdmin }],
  },
}
const UNIT_LIST = [
  { id: IDS.unit, org_id: IDS.org, name: 'Main Choir', description: 'Sunday choir', created_at: '2024-01-01T00:00:00Z' },
]
// SERVICE_SINGLE uses a future date (2026-12-10, Wednesday) so it appears in "Upcoming" sections.
// SERVICE_PAST remains in the past for historical data.
const SERVICE_SINGLE = { id: IDS.service, unit_id: IDS.unit, date: '2026-12-10', service_type: 'rehearsal', created_at: '2024-01-01T00:00:00Z' }
const SERVICE_LIST = [SERVICE_SINGLE]
const SERVICE_PAST = { id: IDS.servicePast, unit_id: IDS.unit, date: '2026-03-05', service_type: 'rehearsal', created_at: '2024-01-01T00:00:00Z' }
const SERVICE_LIST_WITH_PAST = [SERVICE_SINGLE, SERVICE_PAST] // upcoming first, then past (desc order)

function makeSession(userId: string, email: string, metadata: Record<string, string>) {
  return {
    access_token: `mock-token-${userId}`,
    refresh_token: `mock-refresh-${userId}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId, aud: 'authenticated', role: 'authenticated', email,
      user_metadata: metadata,
      app_metadata: { provider: 'email' },
      created_at: '2024-01-01T00:00:00Z',
    },
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** Inject a super admin session before the page loads */
export async function asSuperAdmin(page: Page) {
  const session = makeSession(IDS.superAdmin, 'super@example.com', { role: 'superadmin' })
  await page.addInitScript(
    ({ key, val }) => localStorage.setItem(key, JSON.stringify(val)),
    { key: STORAGE_KEY, val: session },
  )
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  // auth.getUser() calls /auth/v1/user — must return the user object
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) }),
  )
}

/**
 * Inject a unit admin session.
 * IMPORTANT: also mocks unit_admins (LIFO means this must be the LAST route
 * registered for unit_admins — do NOT call mockUnitAdmins after this).
 */
export async function asUnitAdmin(page: Page, unitCount: 1 | 2 = 1) {
  const session = makeSession(IDS.unitAdmin, 'choir@example.com', {})
  await page.addInitScript(
    ({ key, val }) => localStorage.setItem(key, JSON.stringify(val)),
    { key: STORAGE_KEY, val: session },
  )
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )

  // The AuthContext fetches unit_admins to get adminUnits for this user.
  // Return the rows with full unit + organization join.
  const rows = unitCount === 1
    ? [{ unit: { ...UNIT_SINGLE } }]
    : [
        { unit: { ...UNIT_SINGLE } },
        { unit: { id: IDS.unit2, org_id: IDS.org, name: 'Youth Choir', description: null, created_at: '2024-01-01T00:00:00Z', organization: { name: 'Grace Baptist Church' } } },
      ]

  // auth.getUser() calls /auth/v1/user — must return the user object
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) }),
  )
  // Register LAST so it has highest priority (Playwright routes are LIFO)
  await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }),
  )
}

// ── Table mocks ───────────────────────────────────────────────────────────────

/** Mock organizations list (with organization_members for the useOrganizations hook join) */
export async function mockOrgs(page: Page) {
  const data = [{
    id: IDS.org, name: 'Grace Baptist Church',
    created_by_admin_id: IDS.superAdmin, created_at: '2024-01-01T00:00:00Z',
    organization_members: [{ role: 'owner' }],
  }]
  await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/**
 * Smart units mock: detects single vs list query by URL.
 *  - `id=eq.` in URL  → single lookup (UnitDashboard) → object with org join
 *  - otherwise        → list (OrgDetail)               → array
 */
export async function mockUnitsAll(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/units*`, async route => {
    const url = route.request().url()
    if (/[?&]id=eq\./.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(UNIT_SINGLE),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(UNIT_LIST) })
    }
  })
}

/** Mock only the list variant of units (for OrgDetail tests) */
export async function mockUnits(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/units*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(UNIT_LIST) }),
  )
}

/** Mock only the single-unit lookup with org join (for UnitDashboard) */
export async function mockUnitLookup(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/units*`, route =>
    route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(UNIT_SINGLE) }),
  )
}

/** Mock unit name lookup for UnitMembers (.single() → object with org + org_members) */
export async function mockUnitName(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/units*`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/vnd.pgrst.object+json',
      body: JSON.stringify({
        ...UNIT_SINGLE,
        organization: {
          name: 'Grace Baptist Church',
          organization_members: [{ role: 'owner', admin_id: IDS.superAdmin }],
        },
      }),
    }),
  )
}

/** Mock unit_admins table returning empty (super admin panel) */
export async function mockUnitAdmins(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

/**
 * Smart services mock: detects single vs list query by URL.
 *  - `id=eq.` in URL  → single lookup (AdminServiceDetail) → object
 *  - otherwise        → list (UnitDashboard)               → array
 */
export async function mockServicesAll(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/services*`, async route => {
    const url = route.request().url()
    if (/[?&]id=eq\./.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(SERVICE_SINGLE),
      })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_LIST) })
    }
  })
}

/** Mock services list only (for UnitDashboard) */
export async function mockServices(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_LIST) }),
  )
}

/** Mock services list including a past service (for MemberDetail) */
export async function mockServicesWithPast(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVICE_LIST_WITH_PAST) }),
  )
}

/** Mock service single lookup (for AdminServiceDetail) */
export async function mockServiceLookup(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/services*`, route =>
    route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(SERVICE_SINGLE) }),
  )
}

/** Mock members list for UnitMembers page (handles both GET and HEAD) */
export async function mockMembers(page: Page) {
  const data = [
    { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' },
    { id: IDS.member2, unit_id: IDS.unit, name: 'Bob Smith',    phone: null,             section: 'Bass',    status: 'active', created_at: '2024-01-01T00:00:00Z' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/members*`, async route => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'Content-Range': '0-1/2' }, body: '' })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    }
  })
}

/** Mock members count HEAD request (for AdminServiceDetail total count) */
export async function mockMembersHead(page: Page, count = 2) {
  await page.route(`${SUPABASE_URL}/rest/v1/members*`, async route => {
    if (route.request().method() === 'HEAD') {
      await route.fulfill({ status: 200, headers: { 'Content-Range': `0-${count - 1}/${count}` }, body: '' })
    } else {
      await route.continue()
    }
  })
}

/**
 * Smart members mock: detects single vs list query by URL.
 *  - `id=eq.` in URL  → single lookup (MemberDetail) → Alice as object
 *  - otherwise        → list (UnitMembers)            → array
 */
export async function mockMembersAll(page: Page) {
  const ALICE = { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' }
  const BOB   = { id: IDS.member2, unit_id: IDS.unit, name: 'Bob Smith',    phone: null,             section: 'Bass',    status: 'active', created_at: '2024-01-01T00:00:00Z' }
  await page.route(`${SUPABASE_URL}/rest/v1/members*`, async route => {
    const url = route.request().url()
    if (/[?&]id=eq\./.test(url)) {
      await route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(ALICE) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([ALICE, BOB]) })
    }
  })
}

/** Mock single member lookup for MemberDetail (Alice) */
export async function mockMemberSingle(page: Page) {
  const data = { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' }
  await page.route(`${SUPABASE_URL}/rest/v1/members*`, route =>
    route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify(data) }),
  )
}

// ── RPC mocks ─────────────────────────────────────────────────────────────────

/** Mock get_service_members (public check-in page) — filters by p_search from POST body */
export async function mockGetServiceMembers(page: Page) {
  const allMembers = [
    { id: IDS.member1, name: 'Alice Johnson', section: 'Soprano' },
    { id: IDS.member2, name: 'Bob Smith',     section: 'Bass' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_service_members*`, async route => {
    let members = allMembers
    try {
      const body = route.request().postData()
      if (body) {
        const params = JSON.parse(body)
        if (params.p_search) {
          const search = params.p_search.toLowerCase()
          members = allMembers.filter(m => m.name.toLowerCase().includes(search))
        }
      }
    } catch { /* ignore parse errors */ }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(members) })
  })
}

/**
 * Mock get_service_members_full (admin service detail).
 * NOTE: useAdminDashboard re-derives checked_in from the attendance table.
 * Use mockAttendanceWithAlice to make Alice appear as present.
 */
export async function mockGetServiceMembersFull(page: Page) {
  const data = [
    { id: IDS.member1, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', checked_in: true,  checkin_time: '2026-03-10T09:15:00Z' },
    { id: IDS.member2, name: 'Bob Smith',     phone: null,             section: 'Bass',    checked_in: false, checkin_time: null },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_service_members_full*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Mock get_service_members_full with both members checked in (for 100% rate tests) */
export async function mockGetServiceMembersBothPresent(page: Page) {
  const data = [
    { id: IDS.member1, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', checked_in: true, checkin_time: '2026-03-10T09:00:00Z' },
    { id: IDS.member2, name: 'Bob Smith',     phone: null,             section: 'Bass',    checked_in: true, checkin_time: '2026-03-10T09:05:00Z' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_service_members_full*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

// ── Attendance mocks ──────────────────────────────────────────────────────────

/** Alice present, Bob absent */
export async function mockAttendanceWithAlice(page: Page) {
  const data = [{ member_id: IDS.member1, checkin_time: '2026-03-10T09:15:00Z' }]
  await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Both Alice and Bob present */
export async function mockAttendanceBothPresent(page: Page) {
  const data = [
    { member_id: IDS.member1, checkin_time: '2026-03-10T09:00:00Z' },
    { member_id: IDS.member2, checkin_time: '2026-03-10T09:05:00Z' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Everyone absent */
export async function mockAttendanceEmpty(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

/**
 * Mock attendance for MemberDetail (keyed by service_id).
 * Alice attended the past service only.
 */
export async function mockAttendanceByMember(page: Page) {
  const data = [{ service_id: IDS.servicePast, checkin_time: '2026-03-05T09:15:00Z' }]
  await page.route(`${SUPABASE_URL}/rest/v1/attendance*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

// ── checkin_by_id mocks (useAttendance checks result.success / result.error) ──

export async function mockCheckinSuccess(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, name: 'Alice Johnson' }) }),
  )
}

export async function mockCheckinAlreadyIn(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'already_checked_in', name: 'Alice Johnson' }) }),
  )
}

export async function mockCheckinInvalidService(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'invalid_service' }) }),
  )
}

export async function mockCheckinTooFar(page: Page, distance = 350) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'too_far', distance }) }),
  )
}

export async function mockCheckinDeviceLocked(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/checkin_by_id*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'device_locked' }) }),
  )
}

// ── Org / join-request mocks ──────────────────────────────────────────────────

export const IDS_ORG2 = 'bbbbbbbb-0000-0000-0000-000000000002'
export const IDS_MEMBER_ADMIN = 'aaaaaaaa-0000-0000-0000-000000000003'

/** Inject a session for a member-admin (org member, not owner) */
export async function asOrgMember(page: Page) {
  const session = makeSession(IDS_MEMBER_ADMIN, 'member@example.com', {})
  await page.addInitScript(
    ({ key, val }) => localStorage.setItem(key, JSON.stringify(val)),
    { key: STORAGE_KEY, val: session },
  )
  await page.route(`${SUPABASE_URL}/auth/v1/token*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  )
  await page.route(`${SUPABASE_URL}/auth/v1/user*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) }),
  )
  // Return unit_admins — member has no direct unit access yet
  await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  )
}

/** Mock the is_super_admin() RPC — call before navigating to pages that check this */
export async function mockIsSuperAdminRpc(page: Page, result = true) {
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/is_super_admin*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) }),
  )
}

/** Mock organizations list including org membership role */
export async function mockOrgsWithRole(
  page: Page,
  role: 'owner' | 'member' = 'owner',
) {
  const data = [
    {
      id: IDS.org,
      name: 'Grace Baptist Church',
      created_by_admin_id: IDS.superAdmin,
      created_at: '2024-01-01T00:00:00Z',
      organization_members: [{ role }],
    },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Mock organization_members list */
export async function mockOrganizationMembers(page: Page) {
  const data = [
    { id: 'om-1', organization_id: IDS.org, admin_id: IDS.superAdmin, role: 'owner', joined_at: '2024-01-01T00:00:00Z' },
    { id: 'om-2', organization_id: IDS.org, admin_id: IDS_MEMBER_ADMIN, role: 'member', joined_at: '2024-06-01T00:00:00Z' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/organization_members*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Mock a pending join request */
export async function mockJoinRequest(page: Page, status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const data = [
    {
      id: 'jr-1',
      organization_id: IDS.org,
      admin_id: IDS_MEMBER_ADMIN,
      status,
      created_at: '2024-06-01T00:00:00Z',
      organization: { id: IDS.org, name: 'Grace Baptist Church' },
    },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/join_requests*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Mock get_org_join_requests RPC */
export async function mockGetOrgJoinRequests(page: Page) {
  const data = [
    {
      id: 'jr-1',
      organization_id: IDS.org,
      admin_id: IDS_MEMBER_ADMIN,
      admin_email: 'member@example.com',
      status: 'pending',
      created_at: '2024-06-01T00:00:00Z',
    },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_org_join_requests*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
}

/** Mock org creation (POST to organizations) */
export async function mockOrgCreation(page: Page, name = 'New Test Church') {
  const created = {
    id: IDS_ORG2,
    name,
    created_by_admin_id: IDS.superAdmin,
    created_at: new Date().toISOString(),
  }
  await page.route(`${SUPABASE_URL}/rest/v1/organizations*`, async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/vnd.pgrst.object+json',
        body: JSON.stringify(created),
      })
    } else {
      await route.continue()
    }
  })
}

/** Silence WebSocket console noise from Supabase Realtime */
export function silenceRealtime(page: Page) {
  page.on('console', () => {})
}
