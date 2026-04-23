-- ============================================================
-- 00000000000000_base_schema.sql
-- Base table structure — the foundation that all migrations build on.
--
-- DESIGN CONTRACT:
--   This file creates ONLY the core tables that were present before
--   migration 20260313. It enables RLS but defines NO policies.
--   Policies, helper functions (beyond the minimal stubs below),
--   and application-level triggers are all owned by the migration
--   chain starting at 20260313.
--
--   Every DDL statement is idempotent so this file is also safe
--   to apply on top of an already-bootstrapped production database
--   (all statements are no-ops when objects already exist).
--
-- TABLES EXCLUDED (added by named migrations):
--   organization_members  — 20260313
--   join_requests         — 20260313
--   unit_admins           — 20260315
--   member_notifications  — 20260315
--   super_admins          — 20260326
--   unit_messaging_*      — 20260401
--   absence_message_log   — 20260401
--   subscriptions/billing — 20260406
--   sms_queue             — 20260424
--   sms_credit_ledger     — 20260425
--   admin_audit_log       — 20260423
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- ── organizations ─────────────────────────────────────────────────────────────
-- NOTE: created_by_admin_id is the final column name (was owner_id before
-- migration 20260313 renamed it; the rename is now a no-op because we start
-- from the final-state column name here).
create table if not exists public.organizations (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  created_by_admin_id uuid        not null default auth.uid()
                                  references auth.users(id),
  blocked_at          timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- ── units ─────────────────────────────────────────────────────────────────────
-- Location columns backported from 20260408/20260411 — ADD COLUMN IF NOT EXISTS
-- in those migrations makes them no-ops when the column already exists.
create table if not exists public.units (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null
                                  references public.organizations(id) on delete cascade,
  name                text        not null,
  description         text,
  latitude            numeric,
  longitude           numeric,
  radius_meters       int         default 100,
  venue_name          text,
  address             text,
  created_by_admin_id uuid        not null references auth.users(id),
  created_at          timestamptz not null default now()
);
alter table public.units enable row level security;

-- ── members ───────────────────────────────────────────────────────────────────
-- sms_consent backported from 20260402 — ADD COLUMN IF NOT EXISTS = no-op.
create table if not exists public.members (
  id          uuid        primary key default gen_random_uuid(),
  unit_id     uuid        not null
                          references public.units(id) on delete cascade,
  name        text        not null,
  phone       text,
  section     text,
  status      text        not null default 'active'
                          check (status in ('active', 'inactive')),
  birthday    date,
  sms_consent boolean,
  created_at  timestamptz not null default now()
);
alter table public.members enable row level security;

-- ── services ──────────────────────────────────────────────────────────────────
-- venue_* columns backported from 20260408 — ADD COLUMN IF NOT EXISTS = no-op.
create table if not exists public.services (
  id                   uuid        primary key default gen_random_uuid(),
  unit_id              uuid        not null
                                   references public.units(id) on delete cascade,
  date                 date        not null,
  service_type         text        not null,
  notification_sent_at timestamptz,
  require_location     boolean     not null default false,
  venue_name           text,
  venue_address        text,
  venue_lat            numeric,
  venue_lng            numeric,
  venue_radius_meters  int,
  created_at           timestamptz not null default now()
);
alter table public.services enable row level security;

-- ── blocked_admins ────────────────────────────────────────────────────────────
create table if not exists public.blocked_admins (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  reason     text,
  blocked_at timestamptz not null default now()
);
alter table public.blocked_admins enable row level security;

-- ── attendance ────────────────────────────────────────────────────────────────
-- location columns backported from 20260405 — ADD COLUMN IF NOT EXISTS = no-op.
create table if not exists public.attendance (
  id           uuid        primary key default gen_random_uuid(),
  service_id   uuid        not null
                           references public.services(id) on delete cascade,
  member_id    uuid        not null
                           references public.members(id)  on delete cascade,
  checked_in   boolean     not null default true,
  checkin_time timestamptz not null default now(),
  device_id    text,
  latitude     numeric,
  longitude    numeric,
  unique(service_id, member_id)
);
alter table public.attendance enable row level security;

-- ── member_push_subscriptions ─────────────────────────────────────────────────
create table if not exists public.member_push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  member_id  uuid        not null
                         references public.members(id)  on delete cascade,
  unit_id    uuid        not null
                         references public.units(id)    on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  unique(member_id, endpoint)
);
alter table public.member_push_subscriptions enable row level security;

-- ============================================================
-- MINIMAL STUB FUNCTIONS
-- Only functions that are needed by the anonymous check-in
-- flow (SECURITY DEFINER RPCs) and a stub is_super_admin()
-- that migration 20260326 replaces with the table-based version.
-- No policy-helper functions here — those are defined by 20260313+.
-- ============================================================

-- Stub: replaced by 20260326_secure_super_admin.sql with table-based version.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_user_meta_data->>'role' = 'superadmin'
  );
$$;

-- Core anonymous check-in RPC — needed even without auth.
create or replace function public.get_service_members(
  p_service_id uuid,
  p_search     text default null
)
returns table (id uuid, name text, section text)
language plpgsql stable security definer as $$
begin
  if p_search is null or length(trim(p_search)) < 3 then return; end if;
  return query
  select m.id, m.name, m.section
  from   public.members m
  join   public.services s on s.unit_id = m.unit_id
  where  s.id = p_service_id
    and  m.status = 'active'
    and  (m.name ilike '%' || p_search || '%'
          or m.section ilike '%' || p_search || '%')
  order by m.section nulls last, m.name
  limit 150;
end;
$$;
revoke all on function public.get_service_members(uuid, text) from public;
grant  execute on function public.get_service_members(uuid, text) to anon, authenticated;

create or replace function public.checkin_by_id(
  p_member_id  uuid,
  p_service_id uuid,
  p_device_id  text    default null,
  p_lat        numeric default null,
  p_lng        numeric default null
)
returns json language plpgsql security definer as $$
declare
  v_member      public.members;
  v_service     public.services;
  v_eff_lat     numeric;
  v_eff_lng     numeric;
  v_eff_radius  int;
  v_eff_name    text;
  v_dist        float;
begin
  select * into v_service from public.services where id = p_service_id;
  if not found then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  if v_service.venue_lat is not null and v_service.venue_lng is not null then
    v_eff_lat    := v_service.venue_lat;
    v_eff_lng    := v_service.venue_lng;
    v_eff_radius := coalesce(v_service.venue_radius_meters, 100);
    v_eff_name   := v_service.venue_name;
  else
    select latitude, longitude, radius_meters, venue_name
      into v_eff_lat, v_eff_lng, v_eff_radius, v_eff_name
      from public.units where id = v_service.unit_id;
    v_eff_radius := coalesce(v_eff_radius, 100);
  end if;

  if v_service.require_location = true
     and v_eff_lat is not null and v_eff_lng is not null then
    if p_lat is null or p_lng is null then
      return json_build_object('success', false, 'error', 'location_required',
                               'venue_name', v_eff_name);
    end if;
    v_dist := 111320 * sqrt(
      pow(p_lat - v_eff_lat, 2) +
      pow(cos(v_eff_lat * pi() / 180) * (p_lng - v_eff_lng), 2)
    );
    if v_dist > v_eff_radius then
      return json_build_object('success', false, 'error', 'too_far',
        'distance', floor(v_dist), 'radius', v_eff_radius,
        'venue_name', v_eff_name);
    end if;
  end if;

  select * into v_member from public.members
  where id = p_member_id
    and unit_id = v_service.unit_id
    and status  = 'active';
  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  if exists (select 1 from public.attendance
             where service_id = p_service_id and member_id = p_member_id) then
    return json_build_object('success', false, 'error', 'already_checked_in',
                             'name', v_member.name);
  end if;

  if p_device_id is not null and exists (
    select 1 from public.attendance
    where service_id = p_service_id
      and device_id  = p_device_id
      and member_id != p_member_id
  ) then
    return json_build_object('success', false, 'error', 'device_locked');
  end if;

  insert into public.attendance
    (service_id, member_id, checked_in, checkin_time, device_id, latitude, longitude)
  values
    (p_service_id, p_member_id, true, now(), p_device_id, p_lat, p_lng);

  return json_build_object('success', true, 'name', v_member.name);
end;
$$;
revoke all on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) from public;
grant  execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.attendance;
exception when others then null;
end $$;

-- ============================================================
-- PERFORMANCE INDEXES
-- Only for tables defined in this file.
-- Additional indexes for migration-owned tables live in their migrations.
-- ============================================================
create index if not exists idx_units_org_id             on public.units(org_id);
create index if not exists idx_units_created_by         on public.units(created_by_admin_id);
create index if not exists idx_members_unit_id          on public.members(unit_id);
create index if not exists idx_members_status           on public.members(status);
create index if not exists idx_members_section_name     on public.members(section, name);
create index if not exists idx_services_unit_id_date    on public.services(unit_id, date desc);
create index if not exists idx_attendance_service_id    on public.attendance(service_id);
create index if not exists idx_attendance_member_id     on public.attendance(member_id);
create index if not exists idx_attendance_service_member on public.attendance(service_id, member_id);
create index if not exists idx_push_subs_unit_id        on public.member_push_subscriptions(unit_id);
create index if not exists idx_push_subs_member_id      on public.member_push_subscriptions(member_id);
