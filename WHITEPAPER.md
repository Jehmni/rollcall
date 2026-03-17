# Rollcally — Engineering White Paper

> **Version:** 2.0 · **Date:** March 2026
> Reverse-engineered from codebase. All claims are grounded in source code.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Core Features](#7-core-features)
8. [API / RPC Layer](#8-api--rpc-layer)
9. [State Management Strategy](#9-state-management-strategy)
10. [Realtime & Background Processing](#10-realtime--background-processing)
11. [PWA & Offline Strategy](#11-pwa--offline-strategy)
12. [Testing Strategy](#12-testing-strategy)
13. [Known Limitations](#13-known-limitations)

---

## 1. Product Overview

Rollcally is a **multi-tenant, mobile-first attendance management PWA** for recurring group meetings — churches, choirs, sports teams, youth groups, or any organisation that holds regular sessions with a fixed membership roster.

### Core Concepts

| Term | Meaning |
|---|---|
| **Organisation** | Top-level tenant. One deployment hosts many organisations. |
| **Unit** | A sub-group within an organisation (e.g. "Main Choir", "Youth Band"). |
| **Member** | A person registered in a unit's roster. Not a system user — a record with name, section, phone, and optional birthday. |
| **Service / Event** | A scheduled session (`rehearsal` or `sunday_service`) tied to a unit. |
| **Attendance** | A record that a member was physically present at a service. |
| **Admin** | An authenticated user who manages one or more units or organisations. |
| **Super Admin** | A global administrator with unrestricted access across all tenants. |

### What the App Solves

Traditional sign-in sheets are slow, error-prone, and produce no useful analytics. Rollcally replaces them with QR-code-based check-in that:

- Takes under 10 seconds per member
- Works offline in low-signal venues (via Workbox PWA caching)
- Feeds a live attendance dashboard visible to leaders in realtime
- Enforces geofencing and device-locking to prevent proxy check-ins
- Automates absence exports and birthday engagement

---

## 2. Technology Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3.1 |
| Language | TypeScript | ~5.6.2 |
| Bundler | Vite | 5.4.10 |
| Styling | Tailwind CSS | 3.4.14 |
| Routing | React Router DOM | 6.27.0 |
| Icons | Lucide React | 0.460.0 |
| QR Generation | qrcode.react | 4.1.0 |
| QR Scanning | html5-qrcode | 2.3.8 |
| PWA | vite-plugin-pwa (Workbox) | 0.21.1 |

### Backend

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15+) |
| Auth | Supabase Auth (email + password) |
| Realtime | Supabase Realtime (`postgres_changes` subscriptions) |
| Access Control | Row Level Security with security-definer helper functions |
| Server Functions | PostgreSQL RPCs (security definer) |

### Infrastructure

- **Hosting:** Vite-built SPA, served as static files (Netlify / Vercel compatible)
- **Service Worker:** Workbox via vite-plugin-pwa (`generateSW` mode)
- **Database:** Supabase cloud project

---

## 3. Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser / PWA)                    │
│                                                             │
│  React SPA                                                  │
│  ┌──────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │  Pages   │  │     Hooks       │  │    Contexts      │  │
│  │ /admin   │  │ useAdminDash-   │  │ AuthContext      │  │
│  │ /checkin │  │ board           │  │ (session, isSuper│  │
│  │ /        │  │ useAttendance   │  │  adminUnits)     │  │
│  └────┬─────┘  │ useChoristers   │  │ ToastContext     │  │
│       │        └────────┬────────┘  └──────────────────┘  │
│       └─────────────────┼──────────────────────────────── │
│                         │ @supabase/supabase-js             │
└─────────────────────────┼───────────────────────────────── ┘
                          │  HTTPS
          ┌───────────────▼──────────────────────┐
          │          Supabase Cloud               │
          │                                      │
          │  ┌──────────┐   ┌─────────────────┐  │
          │  │ Auth API │   │ REST API        │  │
          │  │  (JWT)   │   │ (PostgREST)     │  │
          │  └──────────┘   └────────┬────────┘  │
          │                          │            │
          │  ┌───────────────────────▼──────────┐ │
          │  │      PostgreSQL Database          │ │
          │  │  + RLS Policies                  │ │
          │  │  + Security-Definer RPCs          │ │
          │  │  + Triggers                      │ │
          │  └──────────────────────────────────┘ │
          │                                      │
          │  ┌──────────────────────────────────┐ │
          │  │  Realtime Engine                 │ │
          │  │  (postgres_changes via WebSocket) │ │
          │  └──────────────────────────────────┘ │
          └──────────────────────────────────────  ┘

Service Worker (Workbox)
  ├─ Pre-cache: full app shell (JS, CSS, HTML, fonts, images)
  └─ Runtime: NetworkFirst for /rpc/get_service_members (POST, 3 s timeout)
```

### Data Flow: Member Check-In

```
Member scans QR code
       │
       ▼
/checkin?service_id=<uuid>
       │
       ▼
useServiceMembers() ──► RPC get_service_members (anon, POST)
   (≥3 char search)        returns PublicMember[]
       │
       ▼
Member selects name ──► Confirmation screen
       │
       ▼
"Yes, check me in" ──► useAttendance.checkIn(memberId)
                           1. navigator.geolocation
                           2. localStorage 'rollcally_device_id'
                           3. RPC checkin_by_id(member, service, device, lat, lng)
                                 │
                                 ├─ geofence check (Haversine, server-side)
                                 ├─ device-lock check
                                 └─ INSERT attendance (or already_checked_in)
       │
       ▼
Status: 'success' | 'already_checked_in' | 'too_far' | 'device_locked' | 'error'
       │
       ▼ (Supabase Realtime)
Admin dashboard receives INSERT event ──► member card updates to "Present"
```

### Data Flow: Admin Attendance Management

```
/admin/units/:unitId/events/:serviceId
       │
       ▼
useAdminDashboard(serviceId)
  ├─ RPC get_service_members_full (paginated, 100/page)
  │    returns: id, name, phone, section, checked_in, checkin_time
  ├─ COUNT query on members table (for total)
  └─ Subscribe to attendance INSERT / DELETE (Realtime)

AdminServiceDetail renders:
  ├─ QR code PNG  (/checkin?service_id=<uuid>)
  ├─ Live stats:  total / present / absent / rate %
  ├─ Member list  (tabs: All / Present / Absent)
  │   └─ Toggle buttons ──► markAttendance(id, present)
  │                              INSERT or DELETE attendance row
  └─ Export absent list  (TXT / CSV / RTF, client-side)
```

---

## 4. Project Structure

```
rollcall/
├── src/
│   ├── App.tsx                      # Route definitions + provider tree
│   ├── main.tsx                     # React root, StrictMode
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Session, role, adminUnits
│   │   └── ToastContext.tsx         # Global toast notification system
│   │
│   ├── components/
│   │   ├── ErrorBoundary.tsx        # Class-based per-route crash recovery
│   │   ├── ProtectedRoute.tsx       # AdminRoute: auth + role guard
│   │   ├── QRScanner.tsx            # html5-qrcode camera modal
│   │   ├── NotificationBell.tsx     # Birthday notification dropdown
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   │
│   ├── hooks/
│   │   ├── useAdminDashboard.ts     # useOrganizations, useUnits, useUnitAdmins,
│   │   │                            #   useServices, useAdminDashboard, useOrgStats
│   │   ├── useAttendance.ts         # Public check-in logic + status machine
│   │   ├── useChoristers.ts         # useServiceMembers, useMemberById, useServiceInfo
│   │   ├── useBirthdayNotifications.ts  # 5-min polling for birthday alerts
│   │   ├── useLocation.ts           # Haversine geofencing (client-side preview)
│   │   └── useOrganizations.ts      # Discovery: search orgs, join requests
│   │
│   ├── lib/
│   │   ├── supabase.ts              # Singleton Supabase client
│   │   └── nameUtils.ts             # normaliseName(), detectDuplicate()
│   │
│   ├── pages/
│   │   ├── Landing.tsx              # Public marketing page
│   │   ├── CheckIn.tsx              # Public QR check-in flow (4 states)
│   │   ├── AdminLogin.tsx
│   │   ├── AdminSignup.tsx
│   │   ├── AdminForgotPassword.tsx
│   │   ├── AdminUpdatePassword.tsx
│   │   ├── AdminDashboard.tsx       # Org list + unit quick-access
│   │   ├── AdminOrgDiscovery.tsx    # Search + join-request flow
│   │   ├── OrgDetail.tsx            # Org analytics + unit management
│   │   ├── UnitDashboard.tsx        # Unit overview + service list
│   │   ├── UnitMembers.tsx          # Roster CRUD + CSV import
│   │   ├── MemberDetail.tsx         # Per-member attendance history & stats
│   │   └── AdminServiceDetail.tsx   # Live attendance + QR code + exports
│   │
│   └── types/index.ts               # All TypeScript interfaces + enums
│
├── supabase/
│   ├── schema.sql                   # Canonical schema (tables, RLS, RPCs, triggers)
│   └── migrations/
│       ├── 20260313_*.sql           # owner_id → created_by_admin_id rename
│       └── 20260315_*.sql           # Missing functions, trigger fix, backfill
│
├── tests/e2e/
│   ├── helpers.ts                   # Shared mocks, auth helpers, mock IDs
│   ├── checkin.spec.ts
│   ├── checkin-failures.spec.ts
│   ├── admin-dashboard.spec.ts
│   ├── admin-features.spec.ts
│   ├── csv-import.spec.ts
│   └── org-workflow.spec.ts
│
├── public/icons/                    # icon-192.png, icon-512.png
├── vite.config.ts                   # Vite + VitePWA + Workbox config
├── playwright.config.ts
├── tailwind.config.js
└── package.json
```

---

## 5. Database Schema

### Entity-Relationship Overview

```
organizations ──(N)── organization_members ──► auth.users (admins)
     │
     └──(N)── units ──(N)── unit_admins ──► auth.users
                  │
                  ├──(N)── members
                  │           └──(N)── member_notifications
                  └──(N)── services
                               └──(N)── attendance ◄── members
                                                   (device_id, lat, lng)

join_requests ──► organizations + auth.users
```

### Tables

#### `organizations`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| created_by_admin_id | uuid → auth.users | Owner reference |
| created_at | timestamptz | |

#### `organization_members`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| admin_id | uuid → auth.users | |
| role | text | `'owner'` or `'member'` |
| joined_at | timestamptz | |
| UNIQUE | (organization_id, admin_id) | |

#### `join_requests`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| admin_id | uuid → auth.users | Requestor |
| status | text | `'pending'` / `'approved'` / `'rejected'` |
| created_at | timestamptz | |

#### `units`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| name | text NOT NULL | |
| description | text | |
| latitude | float8 | Geofence centre (optional) |
| longitude | float8 | Geofence centre (optional) |
| radius_meters | int | Default 300 |
| created_by_admin_id | uuid → auth.users | |
| created_at | timestamptz | |

#### `unit_admins`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK → units | |
| user_id | uuid → auth.users | |
| created_at | timestamptz | |
| UNIQUE | (unit_id, user_id) | |

#### `members`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK → units | |
| name | text NOT NULL | |
| phone | text | |
| section | text | e.g. `"Soprano"`, `"Bass"` |
| status | text | `'active'` / `'inactive'` |
| birthday | date | Optional; used for notifications |
| created_at | timestamptz | |

#### `services`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK → units | |
| date | date NOT NULL | |
| service_type | text | `'rehearsal'` / `'sunday_service'` |
| created_at | timestamptz | |
| UNIQUE | (unit_id, date, service_type) | Prevents duplicates |

#### `attendance`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services | |
| member_id | uuid FK → members | |
| checkin_time | timestamptz | Set at check-in |
| device_id | text | `crypto.randomUUID()` stored in localStorage |
| latitude | float8 | Captured from device at check-in |
| longitude | float8 | Captured from device at check-in |
| created_at | timestamptz | |
| UNIQUE | (service_id, member_id) | One check-in per member per service |

#### `member_notifications`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| unit_id | uuid FK → units | |
| member_id | uuid FK → members | |
| type | text | `'birthday_eve'` / `'birthday_day'` |
| fire_at | timestamptz | When to surface the notification |
| dismissed | bool | Default false |
| created_at | timestamptz | |

### Database Triggers

#### `handle_new_organization()` — AFTER INSERT on `organizations`

Automatically inserts the creator into `organization_members` with `role = 'owner'`. This breaks the RLS chicken-and-egg problem: without this trigger, the creator's own INSERT would fail its RLS check because they aren't a member yet.

#### `handle_new_unit()` — AFTER INSERT on `units`

Automatically inserts into `unit_admins`:
1. The **org owner** (fetched via `organizations.created_by_admin_id`)
2. The **unit creator** — if different from the org owner (handles the case where a joined member creates a unit)

Both inserts use `ON CONFLICT DO NOTHING` for idempotency.

### RLS Helper Functions

All are `SECURITY DEFINER`, `STABLE`, SQL-language functions:

| Function | Checks |
|---|---|
| `is_super_admin()` | `raw_user_meta_data->>'role' = 'superadmin'` |
| `is_org_member(p_org_id)` | `organization_members` for `auth.uid()` |
| `is_org_owner(p_org_id)` | `organization_members.role = 'owner'` |
| `is_org_owner_by_unit(p_unit_id)` | Ownership via unit → org chain |
| `is_unit_admin(p_unit_id)` | `unit_admins` for `auth.uid()` |
| `is_org_admin_by_service(p_service_id)` | Org membership via service → unit → org |
| `is_unit_manager(p_unit_id)` | Unit creator OR org owner |

---

## 6. Authentication & Authorization

### Auth Strategy

#### Public users (members checking in)
- **No authentication required**
- Access via two anonymous RPCs only: `get_service_members` and `checkin_by_id`
- Both are `SECURITY DEFINER` functions granted to the `anon` Supabase role
- Anti-enumeration: `get_service_members` enforces a minimum 3-character search query before returning results

#### Admin users
- **Email + password** via `supabase.auth.signInWithPassword()`
- JWTs issued by Supabase Auth, stored in localStorage by the client
- Role stored in `auth.users.raw_user_meta_data->>'role'`
  - `'admin'` — standard unit / org admin
  - `'superadmin'` — global admin (set manually in Supabase dashboard)

### AuthContext

```typescript
interface AuthContextValue {
  session: Session | null
  isSuper: boolean            // true if role === 'superadmin'
  adminUnits: UnitWithOrg[]   // units where this user appears in unit_admins
  loading: boolean
  signIn(email, password): Promise<void>
  signUp(email, password): Promise<void>
  signOut(): Promise<void>
  resetPassword(email): Promise<void>
  updatePassword(password): Promise<void>
  refreshPermissions(): Promise<void>
}
```

On mount, `getSession()` runs. If a session exists:
- `isSuper` is set from `user_metadata.role`
- If not super: `fetchAdminUnits(userId)` queries `unit_admins` joined to `units` and `organizations`

### Role Hierarchy

```
Super Admin  (raw_user_meta_data.role = 'superadmin')
  └─ Full access to all orgs, units, members, services, and admin management

Org Owner  (organization_members.role = 'owner')
  └─ Full CRUD on all units within their org
  └─ Can approve / reject join requests
  └─ Sees all unit dashboards in their org
  └─ Auto-added to unit_admins for every unit in their org (via trigger)

Org Member  (organization_members.role = 'member')
  └─ Can create new units (becomes unit admin automatically)
  └─ Can view the org dashboard
  └─ Cannot modify other units in the org

Unit Admin  (entry in unit_admins)
  └─ Full CRUD on that unit's members, services, and attendance
  └─ Can manage unit settings (name, description)
  └─ Cannot see other units unless also an org member
```

### ProtectedRoute (`AdminRoute`)

Wraps all `/admin/*` routes. Renders children only if:
- `session` exists AND
- `user_metadata.role` is `'admin'` or `'superadmin'`

Otherwise redirects to `/admin/login`. Renders a loading spinner while `AuthContext.loading` is true.

---

## 7. Core Features

### 7.1 QR Code Check-In

The primary user-facing feature. Flow:

1. Admin creates a service, opens `AdminServiceDetail`, clicks the QR code to download / display it
2. `qrcode.react` renders a QR encoding the URL `/checkin?service_id=<uuid>`
3. Member scans with any camera app → browser opens `/checkin?service_id=<uuid>`
4. `service_id` is saved to `sessionStorage` as `pending_service_id` (survives magic-link redirects)
5. Member types ≥3 characters → `useServiceMembers` fires `get_service_members` RPC
6. Member taps their name → confirmation screen ("Is this you?")
7. Taps "Yes, check me in" → `useAttendance.checkIn(memberId)`:
   - Acquires geolocation (non-blocking; fails gracefully if denied)
   - Reads or creates `rollcally_device_id` in `localStorage`
   - Calls `checkin_by_id` RPC
8. Success screen ("You're in!") with venue name and timestamp

**Return-visitor shortcut:** On successful check-in, `memberId` is stored as `rollcally_member_id` in `localStorage`. On the next visit, the welcome screen shows "Welcome back, \<name\>", skipping the search step.

**Anti-abuse mechanisms:**

- **Device locking:** Each device gets a UUID stored in `localStorage`. The DB tracks which member last used each device UUID. A different member attempting to check in from the same device is blocked with `device_locked`.
- **Geofencing:** If the unit has `latitude`, `longitude`, and `radius_meters` configured, the `checkin_by_id` RPC computes a Haversine distance server-side. If the member is outside the radius, the RPC returns `{ success: false, error: 'too_far', distance }`.

### 7.2 Admin Dashboard

`/admin` adapts to the user's role:

- **Super admin:** "System Overview" heading; sees all organisations across all tenants
- **Org owner / member:** Sees only their own organisations with role badges
- **Unit-only admin (no org):** If `adminUnits.length === 1` and `orgs.length === 0`, automatically redirects to `/admin/units/:id` (skip the dashboard entirely)

Organisation cards show analytics from `useOrgStats`: total active members, unit count, sessions in the last 30 days.

A `visibilitychange` event listener on the dashboard refetches the org list whenever the browser tab regains focus — ensuring an admin who just approved a join request in another tab sees the result immediately.

### 7.3 Realtime Attendance Tracking

`AdminServiceDetail` opens two Supabase Realtime channels on the `attendance` table filtered to `service_id`:

- **INSERT event:** Marks the member as present, updates `checkin_time` in state
- **DELETE event:** Marks the member as absent

The `markAttendance(memberId, present)` function in `useAdminDashboard` also performs an **optimistic update** before the Realtime echo arrives, giving the admin instantaneous UI feedback. The Realtime event reconciles state for any admin who didn't perform the action themselves (e.g. a second admin on a different device).

### 7.4 Member Roster & CSV Import

`UnitMembers` provides:

- Paginated member list (50/page) grouped alphabetically by section
- Live search (400 ms debounce) by name or section
- Add / edit / delete individual members via a modal form
- **CSV bulk import:**
  1. Client-side CSV parsing; expected columns: `Name`, `Phone`, `Section`, `Status`, `Birthday`
  2. Each row checked against the existing roster via `detectDuplicate()` (`nameUtils.ts`):
     - `exact` — normalised names match (accent-stripped, lowercase, whitespace-collapsed)
     - `fuzzy` — one normalised name is a substring of the other
  3. Preview table with colour-coded duplicate warnings shown before any data is written
  4. On confirm: non-duplicate rows are bulk-inserted; exact duplicates are skipped silently
  5. "Transfer Complete!" screen shows imported / skipped counts

Birthday date is stored as a `date` column. A 🎂 emoji appears on member rows where today's month and day match the member's stored birthday.

### 7.5 Per-Member Analytics

`MemberDetail` computes attendance statistics from joined `services` + `attendance` queries:

| Stat | Computation |
|---|---|
| Attended / Total | Count of attendance rows vs count of services for the unit |
| Attendance Rate | `(attended / total) * 100` |
| Current Streak | Consecutive most-recent services with an attendance record |
| Activity heatmap | Last 10 services rendered as coloured squares (green = present) |
| Full history | Chronological list of all services with check-in time or "Absent" |

### 7.6 Birthday Notifications

`useBirthdayNotifications(unitId)` polls `get_pending_notifications` every 5 minutes. The `member_notifications` table stores pre-computed rows when:

- `type = 'birthday_eve'` — fire the day before a member's birthday
- `type = 'birthday_day'` — fire on the member's birthday

`NotificationBell` renders as a floating bell with a count badge. Clicking it expands a dropdown listing each upcoming birthday. Each can be dismissed individually, which sets `dismissed = true` on the row.

### 7.7 Absence Export

Visible from `AdminServiceDetail` when the "Absent" tab is active. Three formats generated entirely client-side:

| Format | Description |
|---|---|
| **TXT** | Plain-text table with name and section |
| **CSV** | UTF-8 BOM prefixed (Excel-compatible), columns: Name, Section, Phone |
| **RTF** | Word-compatible document with a formatted table layout |

All formats trigger a browser file download using a `<a>` element with an object URL.

### 7.8 Organisation Discovery & Join Flow

1. Admin visits `/admin/discover`
2. Searches organisations by name (`ilike` query)
3. Each result shows current join status (pending / not requested)
4. "Request Access" → INSERT into `join_requests` with `status = 'pending'`
5. Org owner sees pending requests in `OrgDetail` → "Requests" tab (via `get_org_join_requests` RPC which joins `auth.users` for email visibility)
6. Owner approves → INSERT into `organization_members` with `role = 'member'`
7. Approved member sees the org on their dashboard after tab refocus (via `visibilitychange` listener)

---

## 8. API / RPC Layer

All database access uses the `supabase-js` client (PostgREST). Custom business logic lives in PostgreSQL RPC functions.

### Anonymous RPCs (granted to `anon` role)

#### `get_service_members(p_service_id uuid, p_search text)`

Returns `PublicMember[]` — `{ id, name, section }` only. No phone, no birthday.
**Constraint:** `p_search` must be ≥3 characters (enforced in RPC body; returns empty array otherwise).
**Purpose:** Allows members to find themselves without exposing the full roster.

#### `checkin_by_id(p_member_id uuid, p_service_id uuid, p_device_id text, p_lat float8, p_lng float8)`

Returns `{ success: boolean, error?: string, distance?: float8 }`

Server-side logic:
1. Validates member is active and belongs to the service's unit
2. If unit has geofence configured → Haversine distance check; returns `too_far` if outside
3. Checks `attendance` table for prior device usage by a different member → returns `device_locked`
4. `INSERT INTO attendance` → if unique violation (23505) returns `already_checked_in`
5. On success → returns `{ success: true }`

### Authenticated RPCs (granted to `authenticated` role)

#### `get_service_members_full(p_service_id uuid, p_limit int, p_offset int)`

Returns `DashboardMember[]` — `{ id, name, phone, section, checked_in, checkin_time }`.
**Auth:** Verified via `is_org_admin_by_service(p_service_id)`. Returns nothing if caller has no access.
**Pagination:** `p_limit` = 100 (PAGE_SIZE), `p_offset` increments by 100 per page.

#### `get_org_join_requests(p_org_id uuid)`

Returns rows with `{ id, organization_id, admin_id, admin_email, status, created_at }`.
**Auth:** Silently returns zero rows for non-owners (`is_org_owner(p_org_id)` checked in WHERE clause).
**Requires SECURITY DEFINER** to JOIN against `auth.users` for the email column.

#### `add_unit_admin_by_email(p_unit_id uuid, p_email text)`

Returns `{ success: boolean, error?: string }`.
**Auth:** Super admin only.
Looks up the user by email in `auth.users`, inserts into `unit_admins`.

#### `get_pending_notifications(p_unit_id uuid)`

Returns `MemberNotification[]` where `dismissed = false` and `fire_at <= now()`.
**Auth:** Unit admins and org owners.

---

## 9. State Management Strategy

Rollcally uses **React hooks + context exclusively**. No Redux, Zustand, or external state library.

### Pattern: Data-fetching hook with local state

```typescript
export function useUnits(orgId: string | null) {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!orgId) { setUnits([]); setLoading(false); return }
    const { data } = await supabase.from('units').select('*').eq('org_id', orgId)
    setUnits(data ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { setLoading(true); fetch() }, [fetch])

  async function createUnit(name: string) {
    const { data, error } = await supabase.from('units').insert(...).select().single()
    if (error) throw error
    setUnits(prev => [...prev, data].sort(...))  // optimistic local update
    return data
  }

  return { units, loading, createUnit, refetch: fetch }
}
```

All mutation functions:
- Call the Supabase API
- Throw on error (callers handle in try/catch and fire toasts)
- Perform an optimistic local state update so the UI doesn't wait for a refetch

### Global Contexts

| Context | Responsibility |
|---|---|
| `AuthContext` | Session, `isSuper`, `adminUnits`; stable across all pages |
| `ToastContext` | Global toast queue — `toast(message, type)` callable from any hook or component |

`ToastProvider` wraps the entire app (outermost provider), making `useToast()` available everywhere, including inside hooks that need to surface silent failures.

### Error surfacing

Previously silent `console.error` catches in `useAdminDashboard` and `useOrganizations` now call `useToast()` directly:

```typescript
// useAdminDashboard.ts
const { toast } = useToast()
// ...
if (error) {
  toast('Failed to load attendance data. Please refresh.', 'error')
  setLoading(false)
  return
}
```

### Error Boundaries

Each route is wrapped with `<ErrorBoundary label="...">`. If a page throws during render, a fallback card is displayed with "Try again" (resets boundary state) and "Go home" (navigates to `/`). The error is logged with `console.error` including the boundary label.

---

## 10. Realtime & Background Processing

### Supabase Realtime Subscription

`useAdminDashboard(serviceId)` in `src/hooks/useAdminDashboard.ts`:

```typescript
supabase
  .channel(`attendance-${serviceId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'attendance',
      filter: `service_id=eq.${serviceId}` },
    ({ new: rec }) => setMembers(prev =>
      prev.map(m => m.id === rec.member_id
        ? { ...m, checked_in: true, checkin_time: rec.checkin_time }
        : m)
    )
  )
  .on('postgres_changes',
    { event: 'DELETE', ... },
    ({ old }) => setMembers(prev =>
      prev.map(m => m.id === old.member_id
        ? { ...m, checked_in: false, checkin_time: null }
        : m)
    )
  )
  .subscribe()
```

The `useEffect` return function calls `supabase.removeChannel(channel)` to clean up on unmount.

### Birthday Notification Polling

`useBirthdayNotifications` uses `setInterval` with a 5-minute interval (300,000 ms). Polling is used rather than Realtime because:
- Birthday notifications are low-frequency (at most a handful per day)
- The `fire_at` timestamp logic is simpler to query than subscribe to
- The interval is cleared via `clearInterval` on unmount

### Tab Visibility Refresh

`AdminDashboard` registers:
```typescript
window.addEventListener('visibilitychange', () => {
  if (!document.hidden) refetch()
})
```

This catches stale org lists after a join-request approval happens in another browser tab. The listener is cleaned up in the `useEffect` return.

---

## 11. PWA & Offline Strategy

### Service Worker

Generated by `vite-plugin-pwa` in `generateSW` mode. Configuration in `vite.config.ts`.

**Pre-cache (app shell):** All JS, CSS, HTML, ICO, PNG, SVG, WOFF2 assets matched by `globPatterns`. The app loads instantly from cache on every return visit.

**Runtime caching:**

| URL Pattern | Strategy | Method | Max Age | Purpose |
|---|---|---|---|---|
| `*/rpc/get_service_members*` | NetworkFirst | **POST** | 7 days | Offline roster for check-in |
| `fonts.googleapis.com/*` | CacheFirst | GET | 365 days | Font stylesheets |
| `fonts.gstatic.com/*` | CacheFirst | GET | 365 days | Font files |

The `method: 'POST'` field on the member-list rule is essential — Supabase RPC calls are HTTP POST. Without this field, Workbox silently ignores the rule for every check-in roster request.

**NetworkFirst with 3 s timeout:** The service worker attempts the network first. If the response doesn't arrive within 3 seconds, it falls back to the cached response. If there is no cached response (first-ever visit in this context), the fetch fails and the user sees an error.

### Offline Behaviour by Page

| Page | Offline behaviour |
|---|---|
| `/checkin` | Works if the roster was previously searched on this device (cached POST response) |
| `/` (Landing) | Fully available (pre-cached app shell) |
| `/admin/*` | Not available offline — admin pages require live DB queries |

The `checkin_by_id` RPC requires network connectivity; check-in writes cannot be queued offline.

### Manifest

```json
{
  "name": "Rollcally",
  "short_name": "Rollcally",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#121121",
  "background_color": "#121121",
  "shortcuts": [
    { "name": "Check In",        "url": "/checkin" },
    { "name": "Admin Dashboard", "url": "/admin"   }
  ]
}
```

Installable on iOS Safari ("Add to Home Screen") and Android Chrome. `display: standalone` removes browser chrome for a native-app feel.

---

## 12. Testing Strategy

### E2E Tests (Playwright)

All tests use **Playwright route interception** — no real Supabase instance is required. The Vite dev server is started by Playwright's `webServer` config.

**Test files:**

| File | Scenarios covered |
|---|---|
| `checkin.spec.ts` | Member list, section grouping, search, confirmation flow, success / error / already-in screens |
| `checkin-failures.spec.ts` | Too-far error, device-locked error, offline network abort, QR scan URL update, sessionStorage persistence |
| `admin-dashboard.spec.ts` | Dashboard load, empty state, org creation modal, unit-admin single-unit redirect |
| `admin-features.spec.ts` | Realtime attendance via custom window event, 100-member pagination, birthday banner, mobile tap targets (WCAG 44 px minimum), vertical scroll |
| `csv-import.spec.ts` | Exact duplicate detection, fuzzy duplicate detection, transfer-complete screen |
| `org-workflow.spec.ts` | Org creation → dashboard, join-request pending/approved, non-owner creates unit, org-owner CRUD access |

**Total: 36 tests — all passing.**

**Mock helpers (`tests/e2e/helpers.ts`):**
- `asSuperAdmin(page)` / `asOrgMember(page)` — inject auth session via route intercept
- `silenceRealtime(page)` — stub WebSocket connections so tests don't hang
- `mockGetServiceMembersFull`, `mockServiceLookup`, `mockAttendanceWithAlice`, etc.

### Coverage Gaps

| Gap | Risk |
|---|---|
| No unit tests (Jest/Vitest) for hooks or utilities | Logic errors in `nameUtils`, `useAttendance` state machine uncaught until E2E |
| No authentication flow E2E tests | Login, signup, password reset untested end-to-end |
| No RLS policy integration tests | Requires a live Supabase project; security posture unverifiable in CI |
| No service worker / offline simulation tests | Workbox behaviour assumed correct |
| No Sentry / error monitoring | Runtime failures in production are invisible |
| No accessibility automated tests | Only tap-target size (44 px) is checked |

---

## 13. Known Limitations

### Security

1. **Device ID spoofable.** `rollcally_device_id` lives in `localStorage`. Clearing browser storage generates a fresh UUID, bypassing device locking. This is a known limitation of client-side device fingerprinting.

2. **Geofencing is opt-in.** Units without `latitude`/`longitude`/`radius_meters` have zero location enforcement. Admins must configure this manually per unit.

3. **No server-side rate limiting on anonymous RPCs.** `get_service_members` and `checkin_by_id` are publicly callable. The 3-character search minimum reduces enumeration risk, but there is no per-IP rate limit in application code (Supabase's platform limits apply).

4. **Super admin promotion is manual.** `role: 'superadmin'` must be set in Supabase dashboard `raw_user_meta_data`. There is no in-app promotion flow.

### Architecture

5. **`useAdminDashboard.ts` is a god-hook file.** Six unrelated hooks (`useOrganizations`, `useUnits`, `useUnitAdmins`, `useServices`, `useAdminDashboard`, `useOrgStats`) live in one file. Not a runtime bug, but increases cognitive load and import surface.

6. **Offline check-in is search-dependent.** Workbox caches responses to prior search queries. A member whose name has never been searched on a given device cannot check in when offline.

7. **CSV import is client-side only.** Very large CSV files could cause UI jank. There is no server-side validation or streaming.

8. **No soft deletes.** Deleting a member, unit, or organisation is a hard `DELETE` with cascade. Historical attendance data is permanently destroyed with no audit trail.

9. **Birthday notification population mechanism not in application code.** The `member_notifications` table is consumed by `useBirthdayNotifications`, but the rows must be created by an external cron job or database trigger. This mechanism is not visible in the app-layer source.

10. **Bundle size.** The production JS bundle is ~925 KB (252 KB gzipped). No code splitting is implemented. All admin routes load eagerly even for public check-in visitors.
