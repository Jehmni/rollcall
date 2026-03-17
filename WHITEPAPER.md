# Rollcally — Engineering White Paper
### Knowledge Transfer Document · March 2026

---

Rollcally is a mobile-first Progressive Web App (PWA) for managing attendance at recurring group events — primarily church choirs, youth groups, sports teams, and similar organisations. Members check in by scanning a QR code on their phone. Administrators monitor attendance in real time, manage rosters, and export absence lists.

The system is multi-tenant: one deployment serves multiple organisations, each with one or more named units (e.g. "Main Choir", "Youth Group"). Each unit has its own manager, its own member roster, and its own events.

**What is fully built and tested:**
- Full database schema with Row Level Security (RLS)
- All four user roles: public member check-in, unit manager, org owner, and super admin
- Complete admin page hierarchy (landing → login → admin dashboard → org detail → unit dashboard → event detail, member roster, member detail) — all with premium dark-mode UI
- Public check-in flow (scan QR → pick name → confirm → result) with accessibility-compliant tap targets
- Offline-capable check-in: Workbox service worker caches the member list for low-signal venues
- Realtime attendance updates via Supabase subscriptions
- QR code generation and PNG download
- Absent member export in TXT, CSV (Excel, with UTF-8 BOM), and RTF (Word, with proper table layout)
- Bulk member CSV import with client-side parsing, duplicate detection, and preview
- Per-member attendance history, rate, and consecutive-streak tracking
- Birthday tracking with in-app notification bell and birthday badge on member cards
- Organisation analytics: total members, active units, pending requests, sessions in last 30 days, plus per-unit member and session counts
- Paginated member list (50 per page, with load-more)
- Organisation discovery and join-request flow
- Dark-mode premium UI across all admin pages, consistent with design system

---

## 2. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + Vite | SPA, TypeScript throughout |
| Styling | Tailwind CSS v3 + custom CSS variables | Utility-first; mobile-first breakpoints; dark design system tokens |
| Routing | React Router v6 | `BrowserRouter`, nested `<Route>` |
| Backend | Supabase (PostgreSQL) | Auth, REST API, Realtime, RLS |
| Auth | Supabase Auth (magic link / password) | `signInWithOtp`, `shouldCreateUser: false` |
| Icons | Lucide React + Material Symbols Outlined | Tree-shaken SVG icons (Lucide) + Google icon font (Material) |
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
│   │   ├── NotificationBell.tsx  — birthday notification bell + dropdown
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx          — StatCard used in event and member detail
│   │       ├── ConfirmDialog.tsx — reusable destructive-action confirmation modal
│   │       └── Input.tsx         — label + input with htmlFor wired
│   ├── hooks/
│   │   ├── useAttendance.ts           — check-in RPC call + status machine
│   │   ├── useChoristers.ts           — useEventMembers (public, no auth)
│   │   ├── useBirthdayNotifications.ts — fetches upcoming & today birthdays, polls every 6 hours
│   │   └── useAdminDashboard.ts       — useOrganizations, useUnits, useUnitAdmins,
│   │                                    useEvents, useAdminDashboard, useOrgStats,
│   │                                    useServices
│   ├── pages/
│   │   ├── Landing.tsx               — public landing / marketing page
│   │   ├── CheckIn.tsx               — public check-in flow
│   │   ├── AdminLogin.tsx            — magic link / password login
│   │   ├── AdminSignup.tsx           — new admin registration
│   │   ├── AdminForgotPassword.tsx   — password reset
│   │   ├── AdminDashboard.tsx        — super admin: org list + unit picker
│   │   ├── AdminOrgDiscovery.tsx     — discover & request to join organisations
│   │   ├── OrgDetail.tsx             — org dashboard with analytics + unit list
│   │   ├── UnitDashboard.tsx         — unit hero + events + role-based actions
│   │   ├── UnitMembers.tsx           — member roster CRUD + bulk CSV import
│   │   ├── MemberDetail.tsx          — per-member attendance history + stats
│   │   └── AdminEventDetail.tsx      — attendance view + QR + exports
│   ├── lib/
│   │   ├── supabase.ts          — singleton Supabase client
│   │   └── nameUtils.ts         — detectDuplicate() for CSV import
│   ├── types/
│   │   └── index.ts             — all shared TypeScript interfaces
│   └── App.tsx                  — route tree
├── supabase/
│   └── schema.sql               — full schema + RLS + RPC functions
├── tests/
│   └── e2e/
│       ├── helpers.ts           — mock factories for all Supabase endpoints
│       ├── admin-auth.spec.ts
│       ├── admin-dashboard.spec.ts
│       └── checkin.spec.ts
├── vite.config.ts               — Vite + VitePWA + Workbox config
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

join_requests           — pending requests from admins to join an org
  id, organization_id, admin_id, status ('pending'|'approved'|'rejected'), created_at

units                   — sub-groups within an org (e.g. "Main Choir")
  id, org_id, created_by_admin_id (Unit Creator), name, description, created_at

members                 — roster for a unit
  id, unit_id → units, name, phone, section, status ('active'|'inactive'),
  birthday (date, optional), created_at

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

```sql
is_super_admin()              — checks auth.jwt() -> user_metadata ->> 'role' = 'superadmin'
is_org_member(p_org_id uuid)  — checks if auth.uid() is in organization_members for that org
is_org_owner_by_unit(p_unit_id uuid) — checks if auth.uid() is 'owner' of the org owning the unit
is_unit_manager(p_unit_id uuid)      — checks if auth.uid() is the unit creator OR org owner
```

### RPC Functions

| Function | Auth | Purpose |
|---|---|---|
| `get_service_members(p_service_id)` | **anon** | Public: returns active member list for a service's unit |
| `checkin_by_id(p_member_id, p_service_id, p_device_id, p_lat, p_lng)` | **anon** | Public: records check-in with location/device security |
| `get_service_members_full(p_service_id)` | authenticated | Admin: members with `checked_in` and `checkin_time` |
| `add_unit_admin_by_email(p_unit_id, p_email)` | authenticated | Super admin only: looks up user by email, inserts `unit_admins` row |

**Critical:** `get_service_members` and `checkin_by_id` are granted to the `anon` role. This is intentional — check-in does not require authentication.

**`checkin_by_id` return shape:**
```json
{ "success": true,  "name": "Alice Johnson" }
{ "success": false, "error": "already_checked_in", "name": "Alice Johnson" }
{ "success": false, "error": "not_found" }
{ "success": false, "error": "invalid_service" }
```
`useAttendance.ts` reads `result.success` and `result.error` directly.

---

## 5. Authentication Architecture

There are three user types. The auth strategy differs for each.

### 5.1 Public Users (Members checking in)

No authentication whatsoever. The check-in page is at `/checkin?service_id={uuid}`. The `service_id` comes from scanning the QR code.

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

A super admin has `user_metadata.role = 'superadmin'` set in the Supabase dashboard. This is checked in `AuthContext` via `session.user.user_metadata?.role === 'superadmin'`. If true, `isSuper = true` and `fetchAdminUnits` is **not** called — the super admin sees everything via RLS.

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

- `loading` — true until the initial `getSession()` resolves.
- `session` — the raw Supabase session, or null if not logged in.
- `isSuper` — true for super admins.
- `adminUnits` — array of `UnitWithOrg` for unit admins; empty for super admins.
- `signOut` — calls `supabase.auth.signOut()`.

### 5.5 Route Protection

`AdminRoute` (at `src/components/ProtectedRoute.tsx`) wraps every `/admin/*` route. It redirects to `/admin/login` if `loading` is true (shows spinner), `session` is null, or the user is neither a super admin nor has any admin units.

---

## 6. Application Routes

```
/                                          → Landing page (marketing)
/checkin                                   → CheckIn (public, no auth)
/admin/login                               → AdminLogin
/admin/signup                              → AdminSignup
/admin/forgot-password                     → AdminForgotPassword
/admin                                     → AdminRoute → AdminDashboard
/admin/discover                            → AdminRoute → AdminOrgDiscovery
/admin/orgs/:orgId                         → AdminRoute → OrgDetail
/admin/units/:unitId                       → AdminRoute → UnitDashboard
/admin/units/:unitId/members               → AdminRoute → UnitMembers
/admin/units/:unitId/members/:memberId     → AdminRoute → MemberDetail
/admin/units/:unitId/events/:serviceId     → AdminRoute → AdminEventDetail
*                                          → redirect to /checkin
```

---

## 7. Pages — Detailed Walkthrough

### 7.1 Landing (`/`)

Marketing page for Rollcally. Showcases key features, pricing, and a prominent call-to-action. Links to `/admin/login` and `/admin/signup`. Styled with the premium dark design system.

### 7.2 CheckIn (`/checkin`)

**State machine:** `step: 'list' | 'confirm' | 'done'`

1. **list** — Fetches members via `useEventMembers(serviceId)` → RPC `get_service_members`. Displayed grouped by section, searchable. Tapping a name moves to `confirm`.
2. **confirm** — Shows the selected member's name and avatar initial. "Yes, check me in" calls `useAttendance.checkIn(memberId)` → RPC `checkin_by_id`. Moves to `done`.
3. **done** — Renders one of four result screens:
   - `success` — premium dark "You're In!" success card
   - `already_checked_in` — "Already checked in"
   - `not_found | invalid_event | error` — "Something went wrong"

**Offline:** The Workbox service worker caches the `get_service_members` RPC response (7-day TTL, up to 30 events, 3-second network timeout).

### 7.3 AdminLogin (`/admin/login`)

Two sub-states: `email` form → `sent` confirmation. Calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`. Only pre-existing users can sign in.

On mount, if a session already exists, redirects:
- Super admin → `/admin`
- Unit admin (single unit) → `/admin/units/{unitId}`
- Unit admin (multiple units) → `/admin`

### 7.4 AdminDashboard (`/admin`)

Rendered differently based on role:
- **Super admin:** Full org list. Can create and delete organisations.
- **Unit admin with 1 unit:** Immediately redirects to their unit dashboard.
- **Unit admin with 2+ units:** Shows a unit picker card list.

Uses `useOrganizations()` hook.

### 7.5 AdminOrgDiscovery (`/admin/discover`)

Allows admins to search for and request to join existing organisations. Displays org cards with member count. Submits a `join_requests` row; the org owner approves or rejects from the OrgDetail page.

### 7.6 OrgDetail (`/admin/orgs/:orgId`)

Organisation-level dashboard with four aggregate stat cards:
- **Total Members** — sum of all active members across all units (`useOrgStats`)
- **Active Units** — count of units in the org
- **Pending Requests** — join requests awaiting approval
- **Sessions (30 days)** — total sessions held across all units in the last 30 days

Each unit card shows inline pills: member count and session count (last 30 days), fetched in parallel by `useOrgStats`.

A full-width dashed **"+ New Unit"** CTA button at the bottom is always visible. Org owners can also delete units.

Uses `useOrganizations()`, `useUnits(orgId)`, and `useOrgStats(orgId)`.

### 7.7 UnitDashboard (`/admin/units/:unitId`)

The main working screen for any admin. Premium dark-mode layout.

**Hero header:**
- Gradient radial glow background
- Large unit avatar icon
- Unit name, org name, role badge (Org Owner / Command / Observer)
- Unit description (if set)
- 3 quick stat pills: Upcoming sessions · Total sessions · Live Today

**Sticky action bar:**
- **Members** — primary CTA navigates to unit member roster
- **New Event** — visible to owners/creators; opens create-event bottom-sheet modal
- QR code icon — opens unit calendar QR
- ⚙️ Settings — opens unit settings modal (name, description, delete unit)
- 👤 Manage Admins — visible to super admins only

**Event cards** — dark cards with colour-coded accent per status:
- Purple = active today   |   Green = upcoming   |   Grey = past

Sections: Upcoming Events and Past Events with counts. Empty state has a dashed-border placeholder with a "Create Event" CTA.

Uses `useServices(unitId)`, `useUnitAdmins(unitId)`, `useUnits(orgId)`.

### 7.8 UnitMembers (`/admin/units/:unitId/members`)

Premium dark-mode member management. Sticky header with back button, "Unit Members" title, and unit/org subtitle.

**Header toolbar:**
- Full-width search bar (debounced 400 ms, clears on ×)
- **Import CSV** and **Add Member** side-by-side action buttons (owner/command only)

**Member list rows** (grouped by section in a dark surface card):
- Coloured avatar initials derived from member name
- Name + retired badge + 🎂 birthday today badge
- Section label + phone in subdued row
- Edit ✏️ and Delete 🗑️ icons (always visible on mobile, on hover for desktop)
- Tap row → `MemberDetail`

**Load more:** Paginated 50 per page; "Load more" button at list bottom.

**Bottom nav** (mobile only): Dashboard · Units · **Members** (active) · Events

**Panel state machine:** `type Panel = 'none' | 'add' | 'import'`. Both panels are bottom-sheet modals.

**Add/Edit member modal:** Name, phone, section, status (`active`/`inactive`), birthday — shared form for create and update.

**CSV import modal:**
1. Choose file → client-side `parseCsv()` parses quoted fields, optional header, skips blank-name rows.
2. **Duplicate detection** via `detectDuplicate()` (`src/lib/nameUtils.ts`):
   - `exact` — identical name (normalised): row highlighted red, will be skipped on import.
   - `fuzzy` — similar name (Levenshtein distance): row highlighted amber, shown as a warning.
3. Preview table with duplicate badges and skipped-row count.
4. **Import N members** batch-inserts all non-exact rows; success screen shows count.
5. **Download Template** button generates a sample CSV.

Expected CSV columns (phone/section/status/birthday optional):
```
Name,Phone,Section,Status,Birthday
Alice Johnson,+2348001234567,Soprano,active,1990-05-14
Bob Smith,,Bass,active,1985-11-20
```

### 7.9 MemberDetail (`/admin/units/:unitId/members/:memberId`)

Per-member attendance history. Three parallel Supabase queries on mount:

```typescript
Promise.all([
  supabase.from('members').select('*').eq('id', memberId).single(),
  supabase.from('services').select('*').eq('unit_id', unitId).order('date', { ascending: false }),
  supabase.from('attendance').select('service_id, checkin_time').eq('member_id', memberId),
])
```

**Stat cards:** Attended · Total Events · Attendance Rate (colour-coded ≥75% green / ≥50% amber / <50% red) · Current Streak

**Birthday badge:** If today is the member's birthday, a 🎂 celebratory banner is displayed at the top of their profile page.

**Recent trend:** Last ≤10 past events as coloured dots (filled green = attended, red border = absent).

**Full event history table** — all events most-recent-first with status badge and check-in time.

### 7.10 AdminEventDetail (`/admin/units/:unitId/events/:serviceId`)

Attendance view for one event.

**Data sources:**
- `useAdminDashboard(serviceId)` — `get_service_members_full` RPC + `attendance` table in parallel. `checked_in` is re-derived from the `attendedMap` (not from the RPC) for Realtime consistency.
- Inline `useEffect` for the event record itself.

**Realtime:** Subscribes to `postgres_changes` on `attendance` filtered by `service_id`.

**Tabs:** `absent | present | all`. Default is `absent`.

**Export (absent members only):**

| Format | Details |
|---|---|
| TXT | Box border using `─` rules; columnar layout with `padEnd` |
| CSV | UTF-8 BOM (`\uFEFF`); summary header block above data rows; all cells quoted |
| RTF | Proper table with `\trowd`/`\cellx`; bold header; blue title; A4 margins |

**QR Code:** Collapsed by default. Toggle shows/hides the `QRCodeCanvas`. PNG download available.

---

## 8. Birthday Notification System

`useBirthdayNotifications` (`src/hooks/useBirthdayNotifications.ts`) fetches members with birthdays in the next 7 days (or today), sorted soonest-first. It polls every 6 hours and supports client-side dismissal.

`NotificationBell` (`src/components/NotificationBell.tsx`) renders a bell icon with a red badge count in the UnitDashboard header. Clicking it opens a dropdown listing upcoming birthday members. Dismissed notifications are stored in `localStorage` keyed by `memberId + year` so they re-appear next year.

Birthday indicators:
- 🎂 **list badge** — appears next to the member's name in the unit member roster
- 🎂 **profile banner** — full-width celebration card on the member's detail page
- 🔔 **notification bell** — in the UnitDashboard header for the next 7 days

---

## 9. PWA & Offline Strategy

`vite-plugin-pwa` generates a Workbox service worker in `generateSW` mode.

### Precache
The app shell (HTML, JS bundles, CSS) is precached at install time.

### Runtime cache: member list
```javascript
{
  urlPattern: ({ url }) => url.pathname.includes('/rest/v1/rpc/get_service_members'),
  handler: 'NetworkFirst',
  options: {
    cacheName: 'member-list-cache',
    networkTimeoutSeconds: 3,
    expiration: { maxEntries: 30, maxAgeSeconds: 604800 },
    cacheableResponse: { statuses: [0, 200] },
  },
}
```

**How it works in practice:** A member scans a QR code. The service worker tries the network for 3 seconds. If the venue has no signal, the cached member list is returned. The `checkin_by_id` write still requires connectivity (not cached — caching a write would cause duplicate check-ins).

---

## 10. Hooks Reference

### `useAttendance(serviceId)` — `src/hooks/useAttendance.ts`
Public check-in hook. Returns `{ status, checkedInName, errorMessage, checkIn, reset }`.
Status values: `idle | loading | success | already_checked_in | not_found | invalid_service | no_service | error`

### `useEventMembers(serviceId)` — `src/hooks/useChoristers.ts`
Public. Calls `get_service_members` RPC. Returns `{ members: PublicMember[], loading, error }`.

### `useOrganizations()` — `src/hooks/useAdminDashboard.ts`
Returns `{ orgs, loading, createOrg, updateOrg, deleteOrg, refetch }`.

### `useUnits(orgId)` — `src/hooks/useAdminDashboard.ts`
Returns `{ units, loading, createUnit, deleteUnit, refetch }`.

### `useOrgStats(orgId)` — `src/hooks/useAdminDashboard.ts`
Fetches in parallel:
- Per-unit member counts (`members` table, grouped by `unit_id`)
- Total org active member count
- Per-unit session counts in the last 30 days (`services` table)
- Pending join request count

Returns `{ unitMemberCounts, totalMembers, unitSessionCounts, pendingRequests, loading }`.

### `useServices(unitId)` — `src/hooks/useAdminDashboard.ts`
Fetches events for a unit ordered `date DESC`. Splits into `upcoming` (date ≥ today) and `past`. Returns `{ upcoming, past, all, loading, createService, refetch }`.

### `useUnitAdmins(unitId)` — `src/hooks/useAdminDashboard.ts`
Returns `{ admins, loading, addAdmin, removeAdmin }`.

### `useAdminDashboard(serviceId)` — `src/hooks/useAdminDashboard.ts`
Runs two parallel queries then merges. Sets up Supabase Realtime channel. Returns `{ members, present, absent, total, loading, refetch }`.

### `useBirthdayNotifications(unitId)` — `src/hooks/useBirthdayNotifications.ts`
Polls every 6 hours for upcoming birthdays (today + next 7 days). Returns `{ notifications, dismiss }`.

---

## 11. Component Library

All UI primitives are in `src/components/ui/`.

**`Button`** — `variant: 'primary'|'secondary'|'ghost'`, `size: 'sm'|'md'|'lg'`, `loading` spinner.

**`Input`** — Wraps `<input>` with a `<label>` linked via `htmlFor`/`id` (auto-generated from the label prop).

**`StatCard`** — Used in AdminEventDetail and MemberDetail. Props: `label`, `value`, `color` (`gray | green | amber | red | blue`).

**`ConfirmDialog`** — Reusable dark-mode confirmation modal for destructive actions (delete unit, delete member, etc.).

**`NotificationBell`** — Birthday notification bell with badge count and dismiss support.

---

## 12. End-to-End Testing

### Infrastructure
Tests live in `tests/e2e/`. All Supabase API calls are intercepted via Playwright's `page.route()`. The dev server (`npm run dev`) runs during tests.

```
playwright.config.ts
  testDir: ./tests/e2e
  fullyParallel: true
  baseURL: http://localhost:5173
  webServer: npm run dev (reused if already running)
```

### Mock Architecture (`tests/e2e/helpers.ts`)

**LIFO route priority:** Routes registered *later* take *higher* priority.

**Auth injection:** `asSuperAdmin(page)` and `asUnitAdmin(page)` inject a fake session into `localStorage` and mock `auth/v1/token*` for token refreshes.

**Smart mocks (`mockUnitsAll`, `mockServicesAll`, `mockMembersAll`):** Inspect the URL to detect single-record vs list queries; return `application/vnd.pgrst.object+json` for `.single()` queries.

**Critical regex for smart mocks:** Use `/[?&]id=eq\./.test(url)` — **not** `url.includes('id=eq.')` (the substring match also triggers on `unit_id=eq.`).

**Fixed IDs in `helpers.ts`:**
```typescript
IDS.service     // upcoming event (date: 2026-03-10)
IDS.servicePast // past event    (date: 2026-03-05)
IDS.member1     // Alice Johnson — active, Soprano, with phone, with birthday
IDS.member2     // Bob Smith    — active, Bass, no phone
```

### Running Tests
```bash
npm run test           # headless
npm run test:ui        # Playwright UI mode
npm run test:report    # Open last HTML report
```

---

## 13. Known Issues & Technical Debt

### Unit Admin Email Display
`useUnitAdmins` returns `email: '—'` for all admins because querying `auth.users` from a client-side request requires the service role key (which must never be exposed client-side). To show emails, implement a Supabase Edge Function with service role access.

### Check-in Write Offline
The `checkin_by_id` RPC write requires live network connectivity. If a user is fully offline, the check-in attempt will fail. A future improvement could queue the write with a background sync service worker, but this requires careful deduplication logic.

---

## 14. Setup Instructions for a New Environment

### 1. Supabase project

Create a new Supabase project. Run `supabase/schema.sql` in the SQL Editor.

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

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role":"superadmin"}'::jsonb
WHERE email = 'your@email.com';
```

### 4. Enable Realtime

Supabase → Database → Replication → enable the `attendance` table.

### 5. Install and run

```bash
npm install
npx playwright install --with-deps chromium   # for E2E tests
npm run dev                                    # start dev server
npm run test                                   # run all E2E tests
npm run build                                  # production build → dist/
```

---

## 15. Architecture Decisions & Rationale

**Why Supabase RPC for check-in instead of a direct `INSERT`?**
The `checkin_by_id` RPC validates member-service unit membership, checks for duplicates at the database level, and returns a structured result in a single round trip. It also keeps the `attendance` table's INSERT policy closed to `anon`.

**Why re-derive `checked_in` from the `attendance` table in `useAdminDashboard`?**
The `get_service_members_full` RPC is a SQL snapshot. The Realtime subscription delivers new `attendance` rows, not a re-run of the RPC. Re-deriving from `attendedMap` keeps the update logic simple.

**Why magic link auth?**
Target users (choir directors, church administrators) are non-developers. Magic links have one step: enter email → tap link. `shouldCreateUser: false` ensures only pre-registered addresses can authenticate.

**Why `application/vnd.pgrst.object+json` for single-record mocks?**
Supabase JS v2 reads the `Content-Type` header to decide object vs array. If a mock returns `application/json` for a `.single()` query, the client receives `null` data.

**Why `NetworkFirst` (not `CacheFirst`) for the member list?**
`CacheFirst` would serve a stale list indefinitely. `NetworkFirst` with a 3-second timeout always tries fresh data; the cache is only the fallback. 7-day TTL covers the weekly event cycle.

**Why merge attendance history client-side in MemberDetail?**
Three separate RLS-scanned queries are small (typically < 200 services per unit). A dedicated RPC would require additional SQL maintenance. The client-side merge is O(n) and fully auditable in TypeScript.

**Why UTF-8 BOM in the CSV export?**
Windows Excel detects encoding from the BOM. Without it, non-ASCII characters (accented and African names) render as mojibake.

**Why CSS custom properties (design tokens) for the dark theme?**
Consistent use of `--color-background-dark`, `--color-surface-dark`, `--color-border-dark`, `--color-primary` as CSS variables allows the entire dark theme to be maintained in one place (`index.css`) rather than scattered Tailwind classes.

---

## 16. Suggested Next Steps

1. **Event close / lock:** A `closed_at` column on `services` that prevents new check-ins and shows "event closed" on the check-in page.

2. **Unit admin email display:** A Supabase Edge Function (`/functions/v1/admin-users`) that uses the service role key to look up user emails by ID.

3. **Background sync for offline check-in:** Register a Workbox `BackgroundSyncPlugin` on the `checkin_by_id` route so that writes made while offline are replayed when connectivity resumes.

4. **Absence notifications:** Send an SMS/WhatsApp to absent members with a phone number — a Supabase Edge Function triggered after a service closes.

5. **Attendance trend dashboard (org-level):** A unit-level aggregate card showing attendance rate across all members over a sliding date window — a `GROUP BY` on the attendance and services tables.

6. **Push notifications:** Web Push API integration so administrators receive birthday or absence alerts even when the app is not open.

---

*Document updated March 2026. App name: Rollcally.*
