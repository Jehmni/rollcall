-- ============================================================
-- 00000000000000_base_schema.sql
-- Canonical base schema expressed as the first migration.
--
-- PURPOSE: Allows CI (supabase start + supabase db lint) to
-- bootstrap a blank Postgres container before any incremental
-- migrations run. Every statement is fully idempotent so this
-- file is safe to run against production (no-ops on existing objects).
--
-- PRODUCTION NOTE: Production was bootstrapped manually via
-- schema.sql. Running this file against production is a no-op
-- because every statement uses CREATE ... IF NOT EXISTS,
-- CREATE OR REPLACE, DROP ... IF EXISTS, and ON CONFLICT DO NOTHING.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES  (all idempotent via IF NOT EXISTS)
-- ============================================================

-- ── organizations ─────────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  created_by_admin_id uuid not null default auth.uid() references auth.users(id),
  blocked_at          timestamptz,
  created_at          timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- ── organization_members ──────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_id        uuid not null references auth.users(id),
  role            text not null check (role in ('owner', 'member')),
  joined_at       timestamptz not null default now(),
  unique(organization_id, admin_id)
);
alter table public.organization_members enable row level security;

-- ── join_requests ─────────────────────────────────────────────────────────────
create table if not exists public.join_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  admin_id        uuid not null references auth.users(id),
  status          text not null check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  unique(organization_id, admin_id)
);
alter table public.join_requests enable row level security;

-- ── units ─────────────────────────────────────────────────────────────────────
create table if not exists public.units (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  description         text,
  latitude            numeric,
  longitude           numeric,
  radius_meters       int default 100,
  venue_name          text,
  address             text,
  created_by_admin_id uuid not null references auth.users(id),
  created_at          timestamptz not null default now()
);
alter table public.units enable row level security;

-- ── unit_admins ───────────────────────────────────────────────────────────────
create table if not exists public.unit_admins (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(unit_id, user_id)
);
alter table public.unit_admins enable row level security;

-- ── members ───────────────────────────────────────────────────────────────────
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  name        text not null,
  phone       text,
  section     text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  birthday    date,
  sms_consent boolean,
  created_at  timestamptz not null default now()
);
alter table public.members enable row level security;

-- ── services ──────────────────────────────────────────────────────────────────
create table if not exists public.services (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null references public.units(id) on delete cascade,
  date                 date not null,
  service_type         text not null,
  notification_sent_at timestamptz,
  require_location     boolean not null default false,
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
  user_id    uuid primary key references auth.users(id) on delete cascade,
  reason     text,
  blocked_at timestamptz not null default now()
);
alter table public.blocked_admins enable row level security;

-- ── attendance ────────────────────────────────────────────────────────────────
create table if not exists public.attendance (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references public.services(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  checked_in   boolean not null default true,
  checkin_time timestamptz not null default now(),
  device_id    text,
  latitude     numeric,
  longitude    numeric,
  unique(service_id, member_id)
);
alter table public.attendance enable row level security;

-- ── member_notifications ──────────────────────────────────────────────────────
create table if not exists public.member_notifications (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references public.units(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  type       text not null check (type in ('birthday_eve', 'birthday_day')),
  fire_at    timestamptz not null,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists member_notifications_unique_type_time
  on public.member_notifications (member_id, type, fire_at);
alter table public.member_notifications enable row level security;

-- ── member_push_subscriptions ─────────────────────────────────────────────────
create table if not exists public.member_push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members(id) on delete cascade,
  unit_id    uuid not null references public.units(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique(member_id, endpoint)
);
alter table public.member_push_subscriptions enable row level security;

-- ── super_admins ──────────────────────────────────────────────────────────────
-- Writeable only via service role — prevents metadata spoofing.
create table if not exists public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.super_admins enable row level security;

-- ============================================================
-- HELPER FUNCTIONS  (all CREATE OR REPLACE — fully idempotent)
-- ============================================================

create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.super_admins where user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and admin_id        = auth.uid()
      and role            = 'owner'
  );
$$;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and admin_id        = auth.uid()
  );
$$;

create or replace function public.is_org_owner_by_unit(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members om
    join public.units u on u.org_id = om.organization_id
    where u.id        = p_unit_id
      and om.admin_id = auth.uid()
      and om.role     = 'owner'
  );
$$;

create or replace function public.is_unit_admin(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.unit_admins
    where unit_id = p_unit_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_unit_manager(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.units
    where id = p_unit_id
      and (created_by_admin_id = auth.uid() or public.is_org_owner_by_unit(p_unit_id))
  );
$$;

create or replace function public.is_org_admin_by_service(p_service_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.organization_members om
    join public.units    u on u.org_id   = om.organization_id
    join public.services s on s.unit_id  = u.id
    where s.id          = p_service_id
      and om.admin_id   = auth.uid()
  );
$$;

-- ============================================================
-- RLS POLICIES  (DROP IF EXISTS + CREATE for idempotency)
-- ============================================================

-- ── organizations ─────────────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to organizations"       on public.organizations;
drop policy if exists "Owners: full access to organizations they created" on public.organizations;
drop policy if exists "Members: read organizations they belong to"      on public.organizations;
drop policy if exists "Authenticated: discover organizations"           on public.organizations;
drop policy if exists "Authenticated: create organizations"             on public.organizations;

create policy "Super admin: full access to organizations"
  on public.organizations for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Owners: full access to organizations they created"
  on public.organizations for all
  using     (created_by_admin_id = auth.uid())
  with check(created_by_admin_id = auth.uid());

create policy "Members: read organizations they belong to"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "Authenticated: discover organizations"
  on public.organizations for select to authenticated
  using (true);

create policy "Authenticated: create organizations"
  on public.organizations for insert to authenticated
  with check (auth.uid() is not null);

-- ── organization_members ──────────────────────────────────────────────────────
drop policy if exists "Owners: full access to org members"  on public.organization_members;
drop policy if exists "Members: read colleagues"            on public.organization_members;

create policy "Owners: full access to org members"
  on public.organization_members for all
  using (public.is_org_owner(organization_id));

create policy "Members: read colleagues"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- ── join_requests ─────────────────────────────────────────────────────────────
drop policy if exists "Admins: create and read own requests"    on public.join_requests;
drop policy if exists "Owners: manage requests for their org"   on public.join_requests;

create policy "Admins: create and read own requests"
  on public.join_requests for all using (admin_id = auth.uid());

create policy "Owners: manage requests for their org"
  on public.join_requests for all using (public.is_org_owner(organization_id));

-- ── units ─────────────────────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to units"               on public.units;
drop policy if exists "Members: create units in their organizations"    on public.units;
drop policy if exists "Members: read all units in their organizations"  on public.units;
drop policy if exists "Managers: full access to units"                  on public.units;

create policy "Super admin: full access to units"
  on public.units for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Members: create units in their organizations"
  on public.units for insert to authenticated
  with check (public.is_org_member(org_id));

create policy "Members: read all units in their organizations"
  on public.units for select
  using (public.is_org_member(org_id));

create policy "Managers: full access to units"
  on public.units for all
  using     (public.is_unit_manager(id))
  with check(public.is_unit_manager(id));

-- ── unit_admins ───────────────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to unit_admins"         on public.unit_admins;
drop policy if exists "Owners: manage unit_admins for their units"      on public.unit_admins;
drop policy if exists "Unit admins: read their own row"                 on public.unit_admins;

create policy "Super admin: full access to unit_admins"
  on public.unit_admins for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Owners: manage unit_admins for their units"
  on public.unit_admins for all
  using (public.is_org_owner_by_unit(unit_id));

create policy "Unit admins: read their own row"
  on public.unit_admins for select to authenticated
  using (user_id = auth.uid());

-- ── members ───────────────────────────────────────────────────────────────────
drop policy if exists "Managers: full access to members"       on public.members;
drop policy if exists "Admins: view all members in their orgs" on public.members;

create policy "Managers: full access to members"
  on public.members for all
  using     (public.is_super_admin() or public.is_unit_manager(unit_id) or public.is_unit_admin(unit_id))
  with check(public.is_super_admin() or public.is_unit_manager(unit_id) or public.is_unit_admin(unit_id));

create policy "Admins: view all members in their orgs"
  on public.members for select
  using (public.is_org_member((select org_id from public.units where id = unit_id)));

-- ── services ──────────────────────────────────────────────────────────────────
drop policy if exists "Managers: full access to services"       on public.services;
drop policy if exists "Admins: view all services in their orgs" on public.services;

create policy "Managers: full access to services"
  on public.services for all
  using     (public.is_unit_manager(unit_id))
  with check(public.is_unit_manager(unit_id));

create policy "Admins: view all services in their orgs"
  on public.services for select
  using (public.is_org_member((select org_id from public.units where id = unit_id)));

-- ── blocked_admins ────────────────────────────────────────────────────────────
drop policy if exists "Super admin: manage blocked admins" on public.blocked_admins;
drop policy if exists "User: read own block"               on public.blocked_admins;

create policy "Super admin: manage blocked admins"
  on public.blocked_admins for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "User: read own block"
  on public.blocked_admins for select to authenticated
  using (auth.uid() = user_id);

-- ── attendance ────────────────────────────────────────────────────────────────
drop policy if exists "Managers: full access to attendance"       on public.attendance;
drop policy if exists "Admins: view all attendance in their orgs" on public.attendance;

create policy "Managers: full access to attendance"
  on public.attendance for all
  using (exists (
    select 1 from public.services s
    where s.id = service_id and public.is_unit_manager(s.unit_id)
  ));

create policy "Admins: view all attendance in their orgs"
  on public.attendance for select
  using (exists (
    select 1 from public.services s
    join public.units u on u.id = s.unit_id
    where s.id = service_id and public.is_org_member(u.org_id)
  ));

-- ── member_notifications ──────────────────────────────────────────────────────
drop policy if exists "Managers: full access to notifications in their unit" on public.member_notifications;

create policy "Managers: full access to notifications in their unit"
  on public.member_notifications for all to authenticated
  using     (public.is_unit_admin(unit_id) or public.is_org_owner_by_unit(unit_id) or public.is_super_admin())
  with check(public.is_unit_admin(unit_id) or public.is_org_owner_by_unit(unit_id) or public.is_super_admin());

-- ── member_push_subscriptions ─────────────────────────────────────────────────
drop policy if exists "Anyone: insert push subscription"                    on public.member_push_subscriptions;
drop policy if exists "Admins: read push subscriptions for their units"     on public.member_push_subscriptions;

create policy "Anyone: insert push subscription"
  on public.member_push_subscriptions for insert to anon, authenticated
  with check (true);

create policy "Admins: read push subscriptions for their units"
  on public.member_push_subscriptions for select to authenticated
  using (public.is_super_admin() or public.is_unit_admin(unit_id) or public.is_org_owner_by_unit(unit_id));

-- ── super_admins ──────────────────────────────────────────────────────────────
drop policy if exists "super_admins: self read" on public.super_admins;

create policy "super_admins: self read"
  on public.super_admins for select to authenticated
  using (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer as $$
begin
  insert into public.organization_members (organization_id, admin_id, role)
  values (new.id, new.created_by_admin_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute procedure public.handle_new_organization();

create or replace function public.handle_new_unit()
returns trigger language plpgsql security definer as $$
declare
  v_org_owner_id uuid;
begin
  select created_by_admin_id into v_org_owner_id
  from public.organizations where id = new.org_id;

  if v_org_owner_id is not null then
    insert into public.unit_admins (unit_id, user_id)
    values (new.id, v_org_owner_id) on conflict do nothing;
  end if;

  if new.created_by_admin_id is not null
     and new.created_by_admin_id is distinct from v_org_owner_id then
    insert into public.unit_admins (unit_id, user_id)
    values (new.id, new.created_by_admin_id) on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_unit_created on public.units;
create trigger on_unit_created
  after insert on public.units
  for each row execute procedure public.handle_new_unit();

create or replace function public.handle_join_request_update()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.organization_members (organization_id, admin_id, role)
    values (new.organization_id, new.admin_id, 'member')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_join_request_approved on public.join_requests;
create trigger on_join_request_approved
  after update on public.join_requests
  for each row execute procedure public.handle_join_request_update();

-- ============================================================
-- CORE RPC FUNCTIONS
-- ============================================================

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
  from public.members m
  join public.services s on s.unit_id = m.unit_id
  where s.id = p_service_id
    and m.status = 'active'
    and (m.name ilike '%' || p_search || '%' or m.section ilike '%' || p_search || '%')
  order by m.section nulls last, m.name
  limit 150;
end;
$$;
grant execute on function public.get_service_members(uuid, text) to anon;
grant execute on function public.get_service_members(uuid, text) to authenticated;

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
  v_existing    public.attendance;
  v_dist        float;
begin
  select * into v_service from public.services where id = p_service_id;
  if not found then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  if v_service.venue_lat is not null and v_service.venue_lng is not null then
    v_eff_lat := v_service.venue_lat; v_eff_lng := v_service.venue_lng;
    v_eff_radius := coalesce(v_service.venue_radius_meters, 100);
    v_eff_name   := v_service.venue_name;
  else
    select latitude, longitude, radius_meters, venue_name
      into v_eff_lat, v_eff_lng, v_eff_radius, v_eff_name
      from public.units where id = v_service.unit_id;
    v_eff_radius := coalesce(v_eff_radius, 100);
  end if;

  if v_service.require_location = true and v_eff_lat is not null and v_eff_lng is not null then
    if p_lat is null or p_lng is null then
      return json_build_object('success', false, 'error', 'location_required', 'venue_name', v_eff_name);
    end if;
    v_dist := 111320 * sqrt(
      pow(p_lat - v_eff_lat, 2) +
      pow(cos(v_eff_lat * pi() / 180) * (p_lng - v_eff_lng), 2)
    );
    if v_dist > v_eff_radius then
      return json_build_object('success', false, 'error', 'too_far',
        'distance', floor(v_dist), 'radius', v_eff_radius, 'venue_name', v_eff_name);
    end if;
  end if;

  select * into v_member from public.members
  where id = p_member_id and unit_id = v_service.unit_id and status = 'active';
  if not found then return json_build_object('success', false, 'error', 'not_found'); end if;

  select * into v_existing from public.attendance
  where service_id = p_service_id and member_id = p_member_id;
  if found then
    return json_build_object('success', false, 'error', 'already_checked_in', 'name', v_member.name);
  end if;

  if p_device_id is not null then
    if exists (
      select 1 from public.attendance
      where service_id = p_service_id and device_id = p_device_id and member_id != p_member_id
    ) then
      return json_build_object('success', false, 'error', 'device_locked');
    end if;
  end if;

  insert into public.attendance (service_id, member_id, checked_in, checkin_time, device_id, latitude, longitude)
  values (p_service_id, p_member_id, true, now(), p_device_id, p_lat, p_lng);

  return json_build_object('success', true, 'name', v_member.name);
end;
$$;
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to anon;
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to authenticated;

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
-- ============================================================
create index if not exists idx_organizations_created_by  on public.organizations(created_by_admin_id);
create index if not exists idx_org_members_admin_id      on public.organization_members(admin_id);
create index if not exists idx_org_members_org_id        on public.organization_members(organization_id);
create index if not exists idx_join_requests_org_status  on public.join_requests(organization_id, status);
create index if not exists idx_units_org_id              on public.units(org_id);
create index if not exists idx_units_created_by          on public.units(created_by_admin_id);
create index if not exists idx_unit_admins_unit_id       on public.unit_admins(unit_id);
create index if not exists idx_unit_admins_user_id       on public.unit_admins(user_id);
create index if not exists idx_members_unit_id           on public.members(unit_id);
create index if not exists idx_members_status            on public.members(status);
create index if not exists idx_members_section_name      on public.members(section, name);
create index if not exists idx_services_unit_id_date     on public.services(unit_id, date desc);
create index if not exists idx_attendance_service_id     on public.attendance(service_id);
create index if not exists idx_attendance_member_id      on public.attendance(member_id);
create index if not exists idx_attendance_service_member on public.attendance(service_id, member_id);
create index if not exists idx_notifications_unit_fire   on public.member_notifications(unit_id, dismissed, fire_at desc);
create index if not exists idx_push_subs_unit_id         on public.member_push_subscriptions(unit_id);
create index if not exists idx_push_subs_member_id       on public.member_push_subscriptions(member_id);
