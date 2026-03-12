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
  created_at: '2024-01-01T00:00:00Z',
  organization: { name: 'Grace Baptist Church' },
}
const UNIT_LIST = [
  { id: IDS.unit, org_id: IDS.org, name: 'Main Choir', description: 'Sunday choir', created_at: '2024-01-01T00:00:00Z' },
]
const SERVICE_SINGLE = { id: IDS.service, unit_id: IDS.unit, date: '2026-03-10', service_type: 'rehearsal', created_at: '2024-01-01T00:00:00Z' }
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

  // Register LAST so it has highest priority (Playwright routes are LIFO)
  await page.route(`${SUPABASE_URL}/rest/v1/unit_admins*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }),
  )
}

// ── Table mocks ───────────────────────────────────────────────────────────────

/** Mock organizations list */
export async function mockOrgs(page: Page) {
  const data = [{ id: IDS.org, name: 'Grace Baptist Church', created_at: '2024-01-01T00:00:00Z' }]
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

/** Mock unit name lookup for UnitMembers (.single() → object) */
export async function mockUnitName(page: Page) {
  await page.route(`${SUPABASE_URL}/rest/v1/units*`, route =>
    route.fulfill({ status: 200, contentType: 'application/vnd.pgrst.object+json', body: JSON.stringify({ name: 'Main Choir' }) }),
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

/** Mock members list for UnitMembers page */
export async function mockMembers(page: Page) {
  const data = [
    { id: IDS.member1, unit_id: IDS.unit, name: 'Alice Johnson', phone: '+2348001234567', section: 'Soprano', status: 'active', created_at: '2024-01-01T00:00:00Z' },
    { id: IDS.member2, unit_id: IDS.unit, name: 'Bob Smith',    phone: null,             section: 'Bass',    status: 'active', created_at: '2024-01-01T00:00:00Z' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/members*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
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

/** Mock get_service_members (public check-in page) */
export async function mockGetServiceMembers(page: Page) {
  const data = [
    { id: IDS.member1, name: 'Alice Johnson', section: 'Soprano' },
    { id: IDS.member2, name: 'Bob Smith',     section: 'Bass' },
  ]
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_service_members*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  )
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

/** Silence WebSocket console noise from Supabase Realtime */
export function silenceRealtime(page: Page) {
  page.on('console', () => {})
}
