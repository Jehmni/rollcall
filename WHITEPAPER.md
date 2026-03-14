# Rollcall — Engineering White Paper
### Knowledge Transfer Document · March 2026

---

Rollcall is a mobile-first Progressive Web App (PWA) for managing attendance at recurring group events — primarily church choirs, youth groups, and similar organisations. Members check in by scanning a QR code on their phone. Administrators monitor attendance in real time, manage rosters, and export absence lists.

The system is multi-tenant: one deployment serves multiple organisations, each with one or more named units (e.g. "Main Choir", "Youth Group"). Each unit has its own manager, its own member roster, and its own events.

**What is fully built and tested:**
- Full database schema with Row Level Security (RLS)
- All three user roles: public member check-in, unit manager, org owner, and super admin
- Eight admin pages across the hierarchy (org list → org detail → unit dashboard → event detail, member roster, member attendance history, and login)
- Public check-in flow (scan QR → pick name → confirm → result) with accessibility-compliant tap targets
- Offline-capable check-in: Workbox service worker caches the member list for low-signal venues
- Realtime attendance updates via Supabase subscriptions
- QR code generation and PNG download
- Absent member export in TXT, CSV (Excel, with UTF-8 BOM), and RTF (Word, with proper table layout)
- Bulk member CSV import with client-side parsing and preview
- Per-member attendance history, rate, and consecutive-streak tracking
- 81 end-to-end Playwright tests — all passing

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | SPA, TypeScript throughout |
| Styling | Tailwind CSS v3 | Utility-first; mobile-first breakpoints |
| Routing | React Router v6 | `BrowserRouter`, nested `<Route>` |
| Backend | Supabase (PostgreSQL) | Auth, REST API, Realtime, RLS |
| Auth | Supabase Auth (magic link) | `signInWithOtp`, `shouldCreateUser: false` |
| Icons | Lucide React | Tree-shaken SVG icons |
| QR Codes | qrcode.react (`QRCodeCanvas`) | Canvas-based, downloadable as PNG |
| PWA / SW | vite-plugin-pwa + Workbox | `generateSW` mode; `NetworkFirst` for member list |
| Testing | Playwright | E2E, full API mocking via `page.route()` |

**Key Supabase JS version note:** The project uses Supabase JS v2. The client is a singleton at `src/lib/supabase.ts`. Never instantiate a second client.

---

## 3. Project Structure

```
rollcall/
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx       — session, isSuper, adminUnits, signOut
│   ├── components/
│   │   ├── ProtectedRoute.tsx    — AdminRoute (wraps all /admin/* routes)
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx          — StatCard used in event and member detail
│   │       └── Input.tsx         — label + input with htmlFor wired
│   ├── hooks/
│   │   ├── useAttendance.ts      — check-in RPC call + status machine
│   │   ├── useChoristers.ts      — useEventMembers (public, no auth)
│   │   └── useAdminDashboard.ts  — useOrganizations, useUnits, useUnitAdmins,
│   │                               useEvents, useAdminDashboard
│   ├── pages/
│   │   ├── CheckIn.tsx           — public check-in flow
│   │   ├── AdminLogin.tsx        — magic link login
│   │   ├── AdminDashboard.tsx    — super admin: org list
│   │   ├── OrgDetail.tsx         — super admin: unit list for one org
│   │   ├── UnitDashboard.tsx     — events list + unit admin management
│   │   ├── UnitMembers.tsx       — member roster CRUD + bulk CSV import
│   │   ├── MemberDetail.tsx      — per-member attendance history + stats
│   │   └── AdminEventDetail.tsx  — attendance view + QR + exports
│   ├── types/
│   │   └── index.ts              — all shared TypeScript interfaces
│   ├── lib/
│   │   └── supabase.ts           — singleton Supabase client
│   └── App.tsx                   — route tree
├── supabase/
│   └── schema.sql                — full schema + RLS + RPC functions
├── tests/
│   └── e2e/
│       ├── helpers.ts            — mock factories for all Supabase endpoints
│       ├── admin-auth.spec.ts    — login, redirects, sign-out
│       ├── admin-dashboard.spec.ts — all admin pages
│       └── checkin.spec.ts       — public check-in flow
├── vite.config.ts                — Vite + VitePWA + Workbox config
└── playwright.config.ts
```

---

## 4. Database Schema

All tables live in the `public` schema. UUIDs everywhere. Row Level Security is enabled on every table.

```
organizations           — top-level tenants (e.g. "Grace Baptist Church")
  id, name, created_by_admin_id (Org Owner), created_at

organization_members    — junction table for admins belonging to an org
  id, organization_id, admin_id, role ('owner'|'member'), joined_at

units                   — sub-groups within an org (e.g. "Main Choir")
  id, org_id, created_by_admin_id (Unit Creator), name, description, created_at

members                 — roster for a unit
  id, unit_id → units, name, phone, section, status ('active'|'inactive'), created_at

services                — a specific event/date for a unit (internally "services")
  id, unit_id → units, date, service_type ('rehearsal'|'sunday_service'|'meeting'), created_at
  UNIQUE (unit_id, date, service_type)

attendance              — one row per check-in
  id, service_id → services, member_id → members,
  checked_in (bool, always true), checkin_time, created_at
  UNIQUE (service_id, member_id)

unit_admins             — maps a Supabase auth user to a unit
  id, unit_id → units, user_id → auth.users, created_at
  UNIQUE (unit_id, user_id)
```

All foreign keys have `ON DELETE CASCADE`, so deleting an organisation removes all its data.

### RLS Helper Functions

Two `SECURITY DEFINER` functions make policy definitions clean:

```sql
is_super_admin()  — checks auth.jwt() -> user_metadata ->> 'role' = 'superadmin'
is_org_member(p_org_id uuid) — checks if auth.uid() is in organization_members for that org
is_org_owner_by_unit(p_unit_id uuid) — checks if auth.uid() is an 'owner' of the org owning the unit
is_unit_manager(p_unit_id uuid) — checks if auth.uid() is the unit creator OR org owner
```

### RPC Functions

| Function | Auth | Purpose |
|---|---|---|
| `get_service_members(p_service_id)` | **anon** | Public: returns active member list for a service's unit |
| `checkin_by_id(p_member_id, p_service_id, p_device_id, p_lat, p_lng)` | **anon** | Public: records check-in with location/device security |
| `get_service_members_full(p_service_id)` | authenticated | Admin: members with `checked_in` and `checkin_time` |
| `add_unit_admin_by_email(p_unit_id, p_email)` | authenticated | Super admin only: looks up user by email, inserts `unit_admins` row |

**Critical:** `get_service_members` and `checkin_by_id` are granted to the `anon` role. This is intentional — check-in does not require authentication.

**`checkin_by_id` return shape** (SQL and hook are now aligned):
```json
{ "success": true,  "name": "Alice Johnson" }
{ "success": false, "error": "already_checked_in", "name": "Alice Johnson" }
{ "success": false, "error": "not_found" }
{ "success": false, "error": "invalid_service" }
```
`useAttendance.ts` reads `result.success` and `result.error` directly. The SQL function and the frontend hook use the same shape — there is no mismatch.

---

## 5. Authentication Architecture

There are three user types. The auth strategy differs for each.

### 5.1 Public Users (Members checking in)

No authentication whatsoever. The check-in page is at `/checkin?service_id={uuid}`. The `service_id` comes from scanning the QR code. It is also saved to `sessionStorage` under the key `pending_service_id` so that a magic-link redirect (if used in the future) doesn't lose it.

The page calls two RPC functions granted to `anon`:
1. `get_service_members` — fetch the member list
2. `checkin_by_id` — record the check-in (validates location and device locking)

### 5.2 Organization Members (Admins)

Admins are authenticated via magic link or password. Their access is determined by the `organization_members` table and unit ownership.

**Org Owners:** Have full CRUD access to all units in their organization.
**Unit Creators:** Have full CRUD access to units they personally created.
**Members:** Have Select (View Only) access to other units in their organization.

**Single-unit redirect:** If an admin is the manager of exactly one unit, they are redirected to `/admin/units/{unitId}` after login.

### 5.3 Super Admin

A super admin has `user_metadata.role = 'superadmin'` set in the Supabase dashboard (or via the SQL snippet at the bottom of `schema.sql`). This is checked in `AuthContext` via `session.user.user_metadata?.role === 'superadmin'`. If true, `isSuper = true` and `fetchAdminUnits` is **not** called — the super admin sees everything via RLS.

**How to promote a user to super admin:**
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"superadmin"}'::jsonb
WHERE email = 'your@email.com';
```

### 5.4 Auth Context API

```typescript
const { session, isSuper, adminUnits, loading, signOut } = useAuth()
```

- `loading` — true until the initial `getSession()` resolves. `AdminRoute` shows a spinner during this.
- `session` — the raw Supabase session, or null if not logged in.
- `isSuper` — true for super admins.
- `adminUnits` — array of `UnitWithOrg` for unit admins; empty for super admins and unauthenticated users.
- `signOut` — calls `supabase.auth.signOut()`.

### 5.5 Route Protection

`AdminRoute` (at `src/components/ProtectedRoute.tsx`) wraps every `/admin/*` route. It redirects to `/admin/login` if either:
- `loading` is still true (shows spinner instead)
- `session` is null
- The user is neither a super admin nor has any admin units

---

## 6. Application Routes

```
/                                         → redirect to /checkin
/checkin                                  → CheckIn (public, no auth)
/admin/login                              → AdminLogin
/admin                                    → AdminRoute → AdminDashboard (super admin org list OR unit picker)
/admin/orgs/:orgId                        → AdminRoute → OrgDetail (unit list for one org)
/admin/units/:unitId                      → AdminRoute → UnitDashboard (events for one unit)
/admin/units/:unitId/members              → AdminRoute → UnitMembers (roster CRUD + CSV import)
/admin/units/:unitId/members/:memberId    → AdminRoute → MemberDetail (attendance history)
/admin/units/:unitId/events/:serviceId    → AdminRoute → AdminEventDetail (attendance view)
*                                         → redirect to /checkin
```

---

## 7. Pages — Detailed Walkthrough

### 7.1 CheckIn (`/checkin`)

**State machine:** `step: 'list' | 'confirm' | 'done'`

1. **list** — Fetches members via `useServiceMembers(serviceId)` → RPC `get_service_members`. Displays grouped by section, searchable. Tapping a name moves to `confirm`.
2. **confirm** — Shows the selected member's name and avatar initial. "Yes, check me in" calls `useAttendance.checkIn(memberId)` → RPC `checkin_by_id`. Moves to `done`.
3. **done** — Renders one of four result screens based on `useAttendance.status`:
   - `success` — "You're in!"
   - `already_checked_in` — "Already checked in"
   - `not_found | invalid_event | error` — "Something went wrong"

The back arrow in the `confirm` header calls `handleBack()` which resets to `list`.

**Accessibility / tap targets:** Member buttons have `min-h-[3.5rem]` (56 px — above the 44 px accessibility minimum), `py-4`, `px-5`, and `text-base` name text. This ensures usability for older or low-dexterity users in poor lighting conditions.

**Offline:** The Workbox service worker caches the `get_service_members` RPC response under the `member-list-cache` cache (7-day TTL, up to 30 events). On subsequent visits in low-signal venues the list loads from cache while the network request races in the background (3-second timeout).

### 7.2 AdminLogin (`/admin/login`)

Two sub-states: `email` form → `sent` confirmation.

Calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`. Only pre-existing users can sign in. A 422 response means the email is not registered.

On mount, if a session already exists, redirects away:
- Super admin → `/admin`
- Unit admin (single unit) → `/admin/units/{unitId}`
- Unit admin (multiple units) → `/admin`

### 7.3 AdminDashboard (`/admin`)

Rendered differently based on role:
- **Super admin:** Full org list. Can create and delete organisations.
- **Unit admin with 1 unit:** Immediately redirects to their unit dashboard (handled in `AdminLogin`, not here).
- **Unit admin with 2+ units:** Shows a unit picker card list.

Uses `useOrganizations()` hook.

### 7.4 OrgDetail (`/admin/orgs/:orgId`)

Shows the unit list for one organisation. Super admin only in practice (unit admins are redirected past this).

Uses `useOrganizations()` to get the org name (finds by `orgId` from the already-loaded list), and `useUnits(orgId)` for the units. Can create and delete units.

### 7.5 UnitDashboard (`/admin/units/:unitId`)

The main working screen for any admin. Displays the list of events and provides management options based on role.

**Header buttons:** back arrow → Units icon (members) → UserCog icon (admin management panel, Org Owner only) → LogOut

**Role Context:** A badge in the header displays "Org Owner", "Unit Manager", or "View Only".

Fetches the unit (inline `useEffect`, not a hook) with the org join: `supabase.from('units').select('*, organization:organizations(name)').eq('id', unitId).single()`

Uses `useEvents(unitId)` — events (internally "services") split into `upcoming` (date >= today) and `past`.

Uses `useUnitAdmins(isOrgOwner ? unitId : null)` — only fetched for organization owners or super admins. The admin panel (toggled by UserCog) lets owners add admins by email via the `add_unit_admin_by_email` RPC.

**Event date filtering:** Uses JavaScript's current date (`new Date().toISOString().split('T')[0]`) compared against `event.date` (a string). This means "today" is when the event's date equals today's ISO date.

### 7.6 UnitMembers (`/admin/units/:unitId/members`)

Roster CRUD for a unit. Members are ordered `section ASC, name ASC` (from the DB query). Within the page they're grouped by section into visual cards. Clicking any member row navigates to their `MemberDetail` page.

**Panel state machine:** `type Panel = 'none' | 'add' | 'import'`. Only one panel can be open at a time. The header has two action buttons: **Add** (opens the single-member form) and **Import** (opens the CSV panel and immediately triggers a file picker).

**Single-member form:** Inline (not a modal). The same `<form>` handles both add and edit, controlled by the `editing` state. The Status `<select>` is linked to its `<label>` via `htmlFor="member-status"` / `id="member-status"` — `getByLabel('Status')` works in tests.

**CSV bulk import flow:**
1. User clicks **Import** → file picker opens immediately.
2. Selected file is parsed client-side by `parseCsv()` — handles quoted fields (Excel-style), optional header row detection, skips blank-name rows.
3. Preview table shows all parsed rows with a skipped-row count.
4. User clicks **Import N members** → `supabase.from('members').insert([...rows]).select()` batch-inserts all rows.
5. Success state shows count; list updates in-place without a full refetch.

Expected CSV columns (order matters; phone/section/status are optional):
```
Name,Phone,Section,Status
Alice Johnson,+2348001234567,Soprano,active
Bob Smith,,Bass,active
```

A **Download template** button generates a sample CSV via `Blob` so admins always have a correct starting point.

**Section field is free-text** — no enum. Whatever is typed becomes the section label and appears as a badge. Grouping is derived client-side.

### 7.7 MemberDetail (`/admin/units/:unitId/members/:memberId`)

Per-member attendance history page. Runs three parallel Supabase queries on mount:

```typescript
Promise.all([
  supabase.from('members').select('*').eq('id', memberId).single(),
  supabase.from('services').select('*').eq('unit_id', unitId).order('date', { ascending: false }),
  supabase.from('attendance').select('service_id, checkin_time').eq('member_id', memberId),
])
```

Results are merged client-side: a `Map<event_id, checkin_time>` is built from the attendance rows (referencing the `services` table), then each event is classified as `attended | absent | upcoming` by comparing `event.date` against today's ISO date string.

**Computed stats displayed as four stat cards:**
- **Attended** — count of past events where the member was present
- **Total Events** — count of past events (excludes upcoming)
- **Attendance Rate** — `attended / total * 100`, colour-coded (green ≥75%, amber ≥50%, red <50%)
- **Current Streak** — consecutive events attended counting backward from the most recent past event

**Recent trend** — last ≤10 past events rendered as coloured dots (oldest left → newest right): filled green = attended, white with red border = absent. Shown only when at least one past event exists.

**Event history table** — full list of all events (most recent first), each row showing: status dot, event type label, `Present / Absent / Upcoming` badge, formatted date, and check-in time if attended.

### 7.8 AdminEventDetail (`/admin/units/:unitId/events/:serviceId`)

The attendance view for one event.

**Data sources:**
- `useAdminDashboard(serviceId)` — calls `get_service_members_full` RPC AND queries the `attendance` table in parallel. The `checked_in` field from the RPC is **ignored** — it is re-derived from the `attendance` table to ensure consistency with realtime updates.
- Inline `useEffect` for the event record itself (`services` table, `.single()`).

**Realtime:** `useAdminDashboard` subscribes to `postgres_changes` on the `attendance` table filtered by `service_id`. New check-ins appear without a page refresh.

**Tabs:** `absent | present | all`. Default is `absent`.

**Export (absent tab only, only shown when at least one member is absent):** All three formats are generated client-side via `Blob` + `URL.createObjectURL` and trigger an immediate file download.

| Format | Details |
|---|---|
| TXT | Box border using `─` rule lines; columnar layout with `padEnd`; `—` for missing values |
| CSV | UTF-8 BOM (`\uFEFF`) so Excel opens without an encoding prompt; summary header block (title, generated date, total) above the data rows; all cells quoted |
| RTF | Proper RTF table with `\trowd` / `\cellx` column width definitions; bold header row; blue title text; `\margl` margins for A4 printing |

**QR Code:** Collapsed by default. The toggle button's text `Show`/`Hide` is in a `<span className="text-xs font-medium text-blue-600">`. The `id="service-qr"` canvas is used for both visibility checks and PNG download. Users are prompted to "scan qr code to check in".

---

## 8. PWA & Offline Strategy

`vite-plugin-pwa` generates a Workbox service worker in `generateSW` mode. The build outputs `dist/sw.js` and `dist/workbox-*.js`.

### Precache (automatic)
The app shell — `index.html`, JS bundles, CSS — is precached at install time. The check-in page UI is always available offline.

### Runtime cache: member list
```javascript
// vite.config.ts — workbox.runtimeCaching
{
  urlPattern: ({ url }) => url.pathname.includes('/rest/v1/rpc/get_service_members'),
  handler: 'NetworkFirst',
  options: {
    cacheName: 'member-list-cache',
    networkTimeoutSeconds: 3,       // fall back to cache after 3 s
    expiration: {
      maxEntries: 30,               // up to 30 different service IDs
      maxAgeSeconds: 604800,        // 7 days
    },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

**How it works in practice:** A member scans a QR code and the check-in page opens. The service worker tries the network for up to 3 seconds. If the venue has no signal, the cached member list from the last successful visit is returned instead. Check-in itself (the `checkin_by_id` RPC write) still requires connectivity — the app shows a loading spinner and then an error screen if the write fails, which is the correct behaviour (you cannot record attendance without reaching the database).

**The `checkin_by_id` write is intentionally NOT cached** — caching a write would cause duplicate or ghost check-ins when the cache replays. Admin pages (which require auth headers) are also not cached since session tokens expire.

---

## 9. Hooks Reference

### `useAttendance(serviceId)` — `src/hooks/useAttendance.ts`

Public check-in hook. No auth required. Calls `checkin_by_id` RPC.

Returns `{ status, checkedInName, errorMessage, checkIn, reset }`.

Status values: `idle | loading | success | already_checked_in | not_found | invalid_service | no_service | error`

The RPC result shape (SQL and hook now aligned):
```typescript
{ success: boolean, error?: string, name?: string }
```

### `useEventMembers(serviceId)` — `src/hooks/useChoristers.ts`

Public (internally `useServiceMembers`). Calls `get_service_members` RPC. Returns `{ members: PublicMember[], loading, error }`.

### `useOrganizations()` — `src/hooks/useAdminDashboard.ts`

Fetches all orgs ordered by name. Returns `{ orgs, loading, createOrg, updateOrg, deleteOrg, refetch }`. Now includes `userRole` for each organization.

### `useUnits(orgId)` — `src/hooks/useAdminDashboard.ts`

Fetches units for a given org. Returns `{ units, loading, createUnit, deleteUnit, refetch }`.

### `useUnitAdmins(unitId)` — `src/hooks/useAdminDashboard.ts`

Fetches `unit_admins` rows for a unit. Email is displayed as `'—'` (the `auth.users` email is not directly joinable without service role). Returns `{ admins, loading, addAdmin, removeAdmin }`.

### `useEvents(unitId)` — `src/hooks/useAdminDashboard.ts`

Fetches events (internally `services`) for a unit, ordered `date DESC`. Returns `{ events, loading, createEvent, refetch }`.

Creating an event navigates immediately to the new event's detail page.

### `useAdminDashboard(serviceId)` — `src/hooks/useAdminDashboard.ts`

The most complex hook. Runs two parallel queries then merges:
```
get_service_members_full  →  all active members with RPC-derived checked_in
attendance table          →  actual check-in timestamps
```
The `checked_in` field from the RPC is discarded. `checked_in` is re-derived from the `attendedMap` (populated by the `attendance` table).

Also sets up a Supabase Realtime channel for live updates. The channel is cleaned up on unmount.

Returns `{ members, present, absent, total, loading, refetch }`.

---

## 10. Component Library

All UI primitives are in `src/components/ui/`. They are small and local — not an external library.

**`Button`** — `variant: 'primary'|'secondary'|'ghost'`, `size: 'sm'|'md'|'lg'`, `loading` (shows spinner, disables). Uses `inline-flex items-center gap-2` layout.

**`Input`** — Wraps `<input>` with a `<label>`. The label is linked via `htmlFor` + `id` (auto-generated from the `label` prop). This means `page.getByLabel('Full name')` works in tests for `Input` fields.

**`StatCard`** — Used in AdminEventDetail and MemberDetail for attendance stats. Props: `label`, `value`, `color` (`gray | green | amber | red | blue`).

**Inline `<label>` + `<select>` pairs** in UnitMembers use explicit `htmlFor`/`id` attributes (`member-status`) so `getByLabel('Status')` works in Playwright tests.

---

## 11. End-to-End Testing

### Infrastructure

Tests live in `tests/e2e/`. All Supabase API calls are intercepted via Playwright's `page.route()` — no real network calls to Supabase happen. The dev server (`npm run dev`) runs during tests.

```
playwright.config.ts
  testDir: ./tests/e2e
  fullyParallel: true          — each test runs in its own browser context
  baseURL: http://localhost:5173
  webServer: npm run dev (reused if already running)
```

### Mock Architecture (`tests/e2e/helpers.ts`)

**LIFO route priority:** In Playwright, routes registered *later* take *higher* priority. This is essential for test setup ordering.

**Auth injection:** `asSuperAdmin(page)` and `asUnitAdmin(page)` use `page.addInitScript()` to inject a fake session into `localStorage` before the page loads, then mock `auth/v1/token*` for token refreshes.

**Table mocks:** Simple helpers like `mockOrgs`, `mockMembers`, `mockEvents`. Each just fulfils the matching URL pattern with canned data.

**Smart mocks (`mockUnitsAll`, `mockServicesAll`, `mockMembersAll`):** These use an async route handler that inspects the URL to detect whether it's a single-record lookup vs a list query. They return the appropriate content type:
- List: `application/json` + JSON array
- Single: `application/vnd.pgrst.object+json` + JSON object (Supabase `.single()` requires this content type)

**Critical regex for smart mocks:** Use `/[?&]id=eq\./.test(url)` — **not** `url.includes('id=eq.')`. The substring match also matches `unit_id=eq.` and `org_id=eq.`, causing list queries to receive a single object and breaking the component.

**Attendance mock shapes differ by consumer:**
- `mockAttendanceWithAlice` / `mockAttendanceBothPresent` / `mockAttendanceEmpty` — return `{ member_id, checkin_time }` rows. Used by `useAdminDashboard` (AdminServiceDetail).
- `mockAttendanceByMember` — returns `{ service_id, checkin_time }` rows. Used by MemberDetail which queries by `member_id`.

**LIFO ordering for `asUnitAdmin`:** The `asUnitAdmin` helper registers a `unit_admins*` mock as its final step. Any subsequent call to `mockUnitAdmins` (which returns an empty array) would override it. Therefore, in unit admin tests, `asUnitAdmin` must always be called **last**.

**Fixed IDs in `helpers.ts`:**
```typescript
IDS.service     // 'dddddddd-...-001' — upcoming event (date: 2026-03-10)
IDS.servicePast // 'dddddddd-...-002' — past event    (date: 2026-03-05)
IDS.member1     // Alice Johnson — active, Soprano, with phone
IDS.member2     // Bob Smith    — active, Bass, no phone
```

### Test Coverage (81 tests)

| File | Tests | What's covered |
|---|---|---|
| `admin-auth.spec.ts` | 9 | Login form, OTP submit, check-email screen, error, unauthenticated redirects, super admin redirect, unit admin redirect, sign out |
| `admin-dashboard.spec.ts` | 61 | Super admin org list, unit manager permissions, OrgDetail, UnitDashboard, UnitMembers CRUD, MemberDetail, AdminEventDetail (tabs, QR, exports, realtime stats), edge cases |
| `checkin.spec.ts` | 11 | No event, member list, search, section grouping, confirmation flow, success, already-checked-in, invalid event, error recovery |

### Running Tests

```bash
npm run test           # headless
npm run test:ui        # Playwright UI mode (interactive)
npm run test:report    # Open last HTML report
```

---

## 12. Known Issues & Technical Debt

### Unit Admin Email Display

`useUnitAdmins` returns `email: '—'` for all admins because querying `auth.users` from a client-side request requires the service role key (which must never be exposed client-side). To show emails, implement a Supabase Edge Function with service role access.

### No Pagination

The member list, services list, and org list all load everything at once. For large units (hundreds of members) this will become slow. Supabase supports range pagination via `.range(from, to)`.

### Check-in Write Offline

The `checkin_by_id` RPC write requires live network connectivity. If a user is fully offline (not just poor signal), the check-in attempt will time out and show an error screen. A future improvement could queue the write with a background sync service worker, but this requires careful deduplication logic.

### CSV Import: No Duplicate Detection

The bulk import does not check whether a member with the same name already exists in the unit. If an admin imports the same CSV twice, duplicate members will be created. The DB has no unique constraint on `(unit_id, name)` by design (common names exist), so detection must be client-side if desired.

---

## 13. Setup Instructions for a New Environment

### 1. Supabase project

Create a new Supabase project. Run `supabase/schema.sql` in the SQL Editor (copy-paste the entire file).

### 2. Environment variables

```bash
cp .env.example .env.local
```
Fill in:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Promote a super admin

In Supabase → Authentication → Users, find the user's UUID, then run:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"superadmin"}'::jsonb
WHERE email = 'your@email.com';
```

### 4. Enable Realtime

Supabase → Database → Replication → enable the `attendance` table. (Already done by the schema's `ALTER PUBLICATION` statement.)

### 5. Install and run

```bash
npm install
npx playwright install --with-deps chromium   # for E2E tests
npm run dev                                    # start dev server
npm run test                                   # run all 81 tests
npm run build                                  # production build → dist/
```

The production build emits `dist/sw.js` (Workbox service worker) and `dist/workbox-*.js` alongside the app bundle.

---

## 14. Architecture Decisions & Rationale

**Why Supabase RPC for check-in instead of a direct `INSERT`?**
The `checkin_by_id` RPC validates member-service unit membership, checks for duplicates at the database level (not just relying on the unique constraint error), and returns a structured result the front end can act on — all in a single round trip. It also means the `attendance` table's INSERT policy can remain closed to `anon`, reducing attack surface.

**Why re-derive `checked_in` from the `attendance` table in `useAdminDashboard`?**
The `get_service_members_full` RPC computes `checked_in` in a single SQL snapshot. However, the Realtime subscription only delivers new `attendance` rows, not a re-run of the RPC. Re-deriving from the `attendedMap` means the hook only needs to append to the map on each Realtime event, keeping the update logic simple and the data source of truth consistent.

**Why magic link auth instead of password?**
The target users (choir directors, church administrators) are not developers. Password reset flows create support burden. Magic links have one step: enter email → tap link. `shouldCreateUser: false` ensures only pre-registered addresses can authenticate.

**Why `application/vnd.pgrst.object+json` for single-record mocks?**
Supabase JS v2 reads the `Content-Type` response header to decide whether to parse the body as an object or an array. If a mock returns `application/json` for a `.single()` query, the client receives `null` data and an error, even if the body is a valid JSON object.

**Why LIFO matters for Playwright mocks?**
Playwright's `page.route()` is a stack — each new handler is checked first. This means `beforeEach` handlers have lower priority than handlers added inside the test body. Design your test helpers accordingly: call "default" mocks first in `beforeEach`, and call "override" mocks last (or in the test body).

**Why `NetworkFirst` (not `CacheFirst`) for the member list?**
`CacheFirst` would serve a stale list indefinitely once cached — a new member added between Sunday events would be invisible until the cache expires. `NetworkFirst` with a 3-second timeout always tries to get fresh data; the cache is only the fallback. 7-day TTL covers the typical weekly event cycle.

**Why merge attendance history client-side in MemberDetail instead of a SQL view or RPC?**
Three separate queries (member, events, attendance) are already table-scanned at the row level by existing RLS policies. A dedicated RPC would require maintaining an additional SQL function. The client-side merge is O(n) where n = services count, which is small (typically < 200 for any unit). This keeps the DB schema minimal and the logic auditable in TypeScript.

**Why UTF-8 BOM in the CSV export?**
Windows Excel detects encoding from the BOM byte sequence. Without it, any name containing a non-ASCII character (accented letters, common in Nigerian, Ghanaian, and European names) is rendered as mojibake. The BOM (`\uFEFF`) is three bytes prepended to the CSV and is ignored by every modern parser.

---

## 15. Suggested Next Steps

The following features are natural extensions that fit cleanly within the existing architecture:

1. **Notifications on absence:** Send an SMS/WhatsApp to absent members with a phone number. Could be a Supabase Edge Function triggered after service closes.

2. **Event close / lock:** A `closed_at` column on `services` that, when set, prevents new check-ins and shows a "event closed" message on the check-in page.

3. **Unit admin email display:** A Supabase Edge Function (`/functions/v1/admin-users`) that uses the service role key to look up user emails by ID, callable from `useUnitAdmins` after load.

4. **Background sync for offline check-in writes:** Register a Workbox `BackgroundSyncPlugin` on the `checkin_by_id` route so that writes made while offline are replayed automatically when connectivity resumes. Requires deduplication logic (check if the attendance row already exists before inserting).

5. **CSV import duplicate detection:** Before inserting, compare imported names against the existing member list client-side and surface conflicts in the preview table (e.g. a yellow warning row for likely duplicates).

6. **Attendance trend over time (admin-level):** A unit-level dashboard card showing aggregate attendance rate across all members over a sliding date window — a GROUP BY query on the attendance and services tables.

---

*Document updated March 2026. All 81 E2E tests passing at time of writing.*
