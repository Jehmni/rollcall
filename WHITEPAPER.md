# Rollcally — Engineering White Paper

> **Version:** 3.0 · **Date:** April 2026
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
12. [SaaS Billing & Monetisation](#12-saas-billing--monetisation)
13. [Testing Strategy](#13-testing-strategy)
14. [Known Limitations](#14-known-limitations)

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
     │                    └── subscriptions (1:1 per org)
     │                    └── sms_credits   (1:1 per org)
     │
     └──(N)── units ──(N)── unit_admins ──► auth.users
                  │         └── unit_messaging_settings (1:1 per unit)
                  │
                  ├──(N)── members
                  │           └──(N)── member_notifications
                  └──(N)── services
                               └──(N)── attendance ◄── members
                               │                   (device_id, lat, lng)
                               └──(N)── absence_message_log ◄── members

join_requests  ──► organizations + auth.users
pricing_plans  ── static lookup (starter / growth / pro)
usage_events   ── append-only audit log (org_id, unit_id, event_type)
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
| sms_consent | boolean \| null | `null` = not asked, `true` = consented, `false` = opted out |
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

#### `pricing_plans`

Static lookup table owned by the platform. Seeded once; never modified by tenants.

| Column | Type | Notes |
|---|---|---|
| id | text PK | `'starter'` / `'growth'` / `'pro'` |
| display_name | text NOT NULL | Human-readable label |
| price_usd_cents | int NOT NULL | Monthly price (USD cents) |
| credits_included | int NOT NULL | SMS follow-ups per billing cycle |
| sort_order | int | Display order in pricing UI |

#### `subscriptions`

One row per organisation. Stripe is the source of truth for payment; this table is a webhook-synced cache.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | UNIQUE — one sub per org |
| stripe_customer_id | text NOT NULL | Stripe customer object ID |
| stripe_subscription_id | text | Stripe subscription object ID |
| plan_id | text FK → pricing_plans | Current plan |
| status | text | `active`, `trialing`, `past_due`, `canceled`, `incomplete`, `unpaid` |
| credits_included | int | Snapshot at last cycle reset |
| current_period_end | timestamptz | Next renewal / expiry date |
| cancel_at_period_end | boolean | Scheduled cancellation flag |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated by trigger |

RLS: org owners and org members can SELECT; super admins have full access.

#### `sms_credits`

One row per organisation. Balance is decremented atomically before each SMS send and reset on `invoice.paid`.

| Column | Type | Notes |
|---|---|---|
| org_id | uuid PK FK → organizations | |
| balance | int ≥ 0 | Remaining follow-ups this cycle |
| last_reset_at | timestamptz | When balance was last set to plan allowance |

CHECK constraint ensures `balance >= 0` — no negative balances possible at the DB layer.

#### `usage_events`

Append-only audit log for all platform feature usage. Designed for extensibility: the same table will record AI usage events in future.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| org_id | uuid FK → organizations | |
| unit_id | uuid FK → units | nullable |
| service_id | uuid FK → services | nullable |
| member_id | uuid FK → members | nullable |
| event_type | text | `'sms_sent'`, `'sms_failed'`, `'sms_blocked'` (future: `'ai_insight'`, etc.) |
| quantity | int | Default 1 |
| metadata | jsonb | Provider name, error details, etc. |
| created_at | timestamptz | |

Indexed on `(org_id, created_at DESC)` for fast billing-page queries.

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
| **CSV** | UTF-8 without BOM (standard, works in Google Sheets and modern Excel), columns: Name, Section, Phone |
| **RTF** | Word-compatible document with a formatted table layout |

All formats include a timestamp in the filename (`absent-Label_YYYY-MM-DD_HH-MM.ext`) to prevent overwrites. RTF escapes special characters (`\`, `{`, `}`) to prevent document corruption. Export of >5,000 members is blocked with a user-visible error before any fetch is attempted.

### 7.8 SMS Absence Messaging

An optional, consent-gated feature that sends a personalised SMS to absent members after a session ends.

#### Data model additions (migration `20260402_sms_consent.sql`)

| Table | Column | Type | Purpose |
|---|---|---|---|
| `members` | `sms_consent` | `boolean \| null` | `null` = not asked, `true` = consented, `false` = opted out |
| `unit_messaging_settings` | `sender_name` | `text` (≤11 chars) | Alphanumeric SMS sender ID shown as "From" |
| `unit_messaging_settings` | `cooldown_days` | `int` (0–90) | Min days between messages to same member |

#### Consent flow

Consent is captured at check-in (no auth required):

1. Member checks in successfully
2. After any push notification prompt resolves, the check-in page checks:
   - Does the unit have SMS enabled? (`unit_messaging_settings.enabled`)
   - Has this member been asked on this device? (`localStorage` key `rollcally_sms_asked_{memberId}_{unitId}`)
3. If both conditions are met, an amber card appears: *"Your unit may send you a text message if you miss a session."*
4. Member taps **"Yes, that's fine"** or **"No thanks"**
5. `set_member_sms_consent(member_id, consent)` RPC (SECURITY DEFINER, granted to `anon`) writes the choice to `members.sms_consent`
6. LocalStorage key is set so the prompt is not shown again on this device

Admins can override consent in the member form to record paper-based consent or honour verbal opt-out requests.

#### Edge function: `send-absence-sms`

Deployment: Supabase Edge Function (Deno). Invoked manually from the admin UI or on a schedule via `pg_cron` + `pg_net`.

Eligibility pipeline (per service):
1. Fetch `unit_messaging_settings` — abort if not enabled
2. Check `service.date === todayIn(timezone)` — skip if not today
3. **Billing gate:** Check `subscriptions.status` for the org — abort batch if not `active` or `trialing`
4. Call `get_service_members_full` — returns all active members with check-in status **and** `sms_consent`
5. Filter: `!checked_in && sms_consent === true && phone != null`
6. Apply cooldown: query `absence_message_log` for `status = 'sent'` rows within `cooldown_days` for these member IDs; remove those from the eligible set
7. For each eligible member: **credit deduction** via `deduct_sms_credit()` (atomic `FOR UPDATE`); if returns false → count as `blocked`, log `sms_blocked` event, continue
8. **Log-first atomic pattern** — INSERT `pending` row (unique constraint on `service_id, member_id` prevents duplicate sends across concurrent invocations); if 23505 → refund credit via `refund_sms_credit()`, count as `skipped`; then send; then UPDATE to `sent` or `failed`
9. Log `sms_sent` / `sms_failed` event to `usage_events` for billing audit trail

#### Sender identity

The `sender_name` field (max 11 chars, must start with a letter) is passed as the Twilio `From` parameter or Africa's Talking `from` parameter. This is an alphanumeric sender ID — supported in UK and Nigeria, **not** available in US/Canada (those require a registered phone number).

#### Cooldown logic

`cooldown_days = 0` disables the cooldown. Otherwise, before sending, the function fetches member IDs from `absence_message_log` where `status = 'sent'` and `sent_at >= now() - cooldown_days * 86400s`. Members in this set are skipped for the current batch.

#### Admin UI (`AdminServiceDetail` — MessagingPanel)

The expanded panel shows:
- **Reachability summary:** "X will receive SMS · Y haven't consented · Z have no phone"
- **Sender name** input (validated: ≤11 chars, starts with letter, alphanumeric)
- **Cooldown days** input (0–90)
- **Delivery log** (paginated, 50 per page, sorted by `sent_at desc, id desc`)
- **"Send to all"** button (count reflects only eligible members, not total absent)

### 7.10 Organisation Discovery & Join Flow

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

Returns `DashboardMember[]` — `{ id, name, phone, section, checked_in, checkin_time, sms_consent }`.
**Auth:** Verified via `is_org_admin_by_service(p_service_id)`. Returns nothing if caller has no access.
**Pagination:** `p_limit` = 100 (PAGE_SIZE), `p_offset` increments by 100 per page.
**`sms_consent`:** `null` = not asked, `true` = consented to SMS, `false` = opted out. Used by the admin UI to show the reachability breakdown and by the edge function to filter eligible recipients.

#### `set_member_sms_consent(p_member_id uuid, p_consent boolean)`

Updates `members.sms_consent`. **SECURITY DEFINER**, granted to `anon` so it can be called from the unauthenticated check-in page. Tightly scoped — only updates the one column.

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

#### `get_org_billing(p_org_id uuid)`

Returns `{ subscription, credits, plan }` as a single JSON object. Combines data from `subscriptions`, `sms_credits`, and `pricing_plans` in one round-trip.
**Auth:** `is_org_owner(p_org_id)` or `is_org_member(p_org_id)`.
**Used by:** `Billing.tsx` on page load.

### Service-Role-Only Functions (no public grant)

These are called exclusively by edge functions using `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS.

#### `deduct_sms_credit(p_org_id uuid) → boolean`

Atomically decrements `sms_credits.balance` by 1 using `SELECT ... FOR UPDATE`. Returns `true` if a credit was available and deducted; `false` if balance was 0 or no row exists. Guarantees no negative balances under concurrent invocations.

#### `refund_sms_credit(p_org_id uuid)`

Increments `sms_credits.balance` by 1. Called when a credit was deducted but the send was skipped (concurrent duplicate detected via 23505 constraint on `absence_message_log`).

#### `reset_sms_credits(p_org_id uuid, p_credits int)`

Upserts `sms_credits` to `balance = p_credits` and stamps `last_reset_at = now()`. Called by the stripe-webhook on `invoice.paid` and `checkout.session.completed`.

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

## 12. SaaS Billing & Monetisation

Rollcally monetises through a **subscription model** (migration `20260406_billing.sql`). Revenue is framed around the product value ("automated attendance follow-ups"), not the underlying infrastructure cost (SMS). The billing layer sits between the subscription lifecycle and the outbound SMS send path.

### Architecture Overview

```
Stripe Checkout ──► create-checkout-session (edge function)
                         │
                         └──► Stripe hosted page ──► stripe-webhook (edge function)
                                                            │
                                              ┌─────────────┴──────────────┐
                                              ▼                            ▼
                                    subscriptions table           sms_credits table
                                              │
                                              ▼
                                    send-absence-sms
                                    1. Check subscriptions.status
                                    2. deduct_sms_credit() — atomic FOR UPDATE
                                    3. Send via Twilio / AT
                                    4. INSERT usage_events
```

### Pricing Plans

| Plan | Price | Follow-ups / cycle | Overage rate | Target |
|---|---|---|---|---|
| Starter | $25 / month | 200 | $0.18 each | Small org (1–2 units, ≤80 members) |
| Growth | $59 / month | 600 | $0.15 each | Medium org (3–6 units, up to ~200 members) |
| Pro | $119 / month | 1,500 | $0.12 each | Large org (7+ units, 200+ members) |

Pricing is designed for 70–87% gross margin at real-world utilisation (~110 SMS/org/month blended average). Overage charges apply when an org exceeds its included allowance; these yield 54–69% margin and are the primary mechanism for large outlier orgs rather than a default revenue stream.

All new subscriptions include a **14-day free trial**. No charge is made until the trial ends.

### Edge Functions

#### `create-checkout-session`

Creates a Stripe Checkout Session for new subscriptions or redirects to the Stripe Billing Portal for existing active customers (plan changes, invoice downloads, card updates).

- **Auth:** Caller must be authenticated AND `is_org_owner(org_id)` — only the org owner can manage billing.
- **New customer flow:** Creates a Stripe Customer object (email + org name), then a Checkout Session with `client_reference_id = org_id` so the webhook can link back.
- **Existing active subscription:** Returns a Billing Portal URL instead of a new checkout.
- **14-day trial:** Applied via `subscription_data.trial_period_days = 14` on first-time checkouts.

Secrets required: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO`, `APP_URL`.

#### `stripe-webhook`

Processes four Stripe lifecycle events. All DB writes are idempotent upserts.

| Event | Action |
|---|---|
| `checkout.session.completed` | Upsert `subscriptions` row; call `reset_sms_credits` with plan allowance |
| `invoice.paid` | Sync subscription status; call `reset_sms_credits` to start fresh cycle |
| `customer.subscription.updated` | Sync plan, status, period end; top up credits if upgraded mid-cycle |
| `customer.subscription.deleted` | Set status to `canceled`; zero out `sms_credits.balance` immediately |

Secrets required: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**Signature verification:** All events are verified via `stripe.webhooks.constructEventAsync()` before any DB access. Requests without a valid `stripe-signature` header are rejected with HTTP 400.

### Credit Deduction — Atomicity

`deduct_sms_credit(p_org_id uuid)` uses `SELECT ... FOR UPDATE` on the `sms_credits` row:

```sql
select balance into v_balance from sms_credits where org_id = p_org_id for update;
if v_balance <= 0 then return false; end if;
update sms_credits set balance = balance - 1 where org_id = p_org_id;
return true;
```

The `FOR UPDATE` row lock ensures that concurrent edge function invocations cannot both see the same balance > 0 and both decrement it — only one wins the lock; the other waits and then reads the updated (already decremented) value. The result is **no negative balances and no double-spend, even under concurrent cron-triggered batches**.

If a concurrent duplicate is detected (23505 on `absence_message_log`), the already-deducted credit is refunded via `refund_sms_credit()` before the member is skipped.

### Credit Enforcement in `send-absence-sms`

The updated edge function checks two gates before sending:

1. **Subscription status** — must be `active` or `trialing`. `past_due`, `canceled`, or absent subscription blocks the entire batch with a clear reason logged.
2. **Credit balance** — `deduct_sms_credit()` is called per member, before the SMS API call. If it returns `false`, the member is counted as `blocked` and the event is logged to `usage_events` with `event_type = 'sms_blocked'`.

The UI (`MessagingPanel`) surfaces blocked sends — the admin can see exactly how many were blocked and link to the billing page.

### Usage Events (AI-Ready Audit Log)

`usage_events` is intentionally generic. Current `event_type` values:
- `sms_sent` — successful Twilio delivery, credit deducted
- `sms_failed` — provider returned an error, credit deducted (cost incurred)
- `sms_blocked` — credit balance was zero or subscription not active, no cost incurred

Planned future values (not yet billed, structure ready):
- `ai_insight` — AI-generated attendance insight
- `ai_followup` — AI-written personalised follow-up message
- `ai_prediction` — predictive absence alert

The `metadata jsonb` column stores provider name, error codes, and any other context needed for future billing granularity without schema changes.

### Frontend

`src/lib/plans.ts` is the single source of truth for plan presentation:
- `PLANS[]` — ordered plan config (name, price, followUps, features, colour tokens)
- `isSubActive(status)` — returns true for `active` and `trialing`
- `subStatusLabel(status)` / `subStatusColor(status)` — consistent UI rendering across all components

`src/pages/Billing.tsx` at `/admin/billing`:
- Shows current plan, status chip, and renewal/cancellation date
- Usage bar (follow-ups used / total allowance) — sourced from `usage_events` count since last reset
- Technical details (raw credit balance) hidden under a `<details>` element — not the primary UI
- Plan selection cards for upgrade/downgrade (calls `create-checkout-session`)
- "Manage billing" button → Stripe Billing Portal for card/invoice management
- Success/cancel redirect handling from Stripe Checkout

---

## 13. Testing Strategy

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

## 14. Known Limitations

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
