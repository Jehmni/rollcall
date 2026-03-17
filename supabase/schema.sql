-- ============================================================
-- Rollcally — Canonical Schema (single source of truth)
-- Incorporates all migrations through 20260315.
-- Run this on a fresh Supabase project via SQL Editor.
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- ---- organizations ----
create table if not exists organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  created_by_admin_id uuid not null default auth.uid() references auth.users(id),
  created_at          timestamptz not null default now()
);

alter table organizations enable row level security;

-- ---- organization_members ----
-- Junction table: admins belonging to an organization.
create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  admin_id        uuid not null references auth.users(id),
  role            text not null check (role in ('owner', 'member')),
  joined_at       timestamptz not null default now(),
  unique(organization_id, admin_id)
);

alter table organization_members enable row level security;

-- ---- join_requests ----
-- Workflow for admins to discover and join organizations.
create table if not exists join_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  admin_id        uuid not null references auth.users(id),
  status          text not null check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  unique(organization_id, admin_id)
);

alter table join_requests enable row level security;

-- ---- units ----
create table if not exists units (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  name                text not null,
  description         text,
  latitude            numeric,
  longitude           numeric,
  radius_meters       int default 100,
  created_by_admin_id uuid not null references auth.users(id),
  created_at          timestamptz not null default now()
);

alter table units enable row level security;

-- ---- unit_admins ----
-- Grants a user direct admin access to a unit (legacy + trigger-managed).
create table if not exists unit_admins (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(unit_id, user_id)
);

alter table unit_admins enable row level security;

-- ---- members ----
create table if not exists members (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  name       text not null,
  phone      text,
  section    text,
  status     text not null default 'active' check (status in ('active', 'inactive')),
  birthday   date,
  created_at timestamptz not null default now()
);

alter table members enable row level security;

-- ---- services ----
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references units(id) on delete cascade,
  date         date not null,
  service_type text not null check (service_type in ('rehearsal', 'sunday_service')),
  created_at   timestamptz not null default now()
);

alter table services enable row level security;

-- ---- attendance ----
create table if not exists attendance (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references services(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  checked_in   boolean not null default true,
  checkin_time timestamptz not null default now(),
  device_id    text,
  latitude     numeric,
  longitude    numeric,
  unique(service_id, member_id)
);

alter table attendance enable row level security;

-- ---- member_notifications ----
create table if not exists member_notifications (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  type       text not null check (type in ('birthday_eve', 'birthday_day')),
  fire_at    timestamptz not null,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists member_notifications_unique_type_time
  on member_notifications (member_id, type, fire_at);

alter table member_notifications enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (security definer — called inside RLS policies)
-- ============================================================

-- Super admin: checks raw_user_meta_data so it works with a stale JWT.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_user_meta_data->>'role' = 'superadmin'
  );
$$;

-- Is the current user an owner of the given org (via organization_members)?
create or replace function public.is_org_owner(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
      and role = 'owner'
  );
$$;

-- Is the current user any member (owner or member) of the given org?
create or replace function public.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
  );
$$;

-- Is the current user the org owner of the org that owns the given unit?
create or replace function public.is_org_owner_by_unit(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members om
    join units u on u.org_id = om.organization_id
    where u.id = p_unit_id
      and om.admin_id = auth.uid()
      and om.role = 'owner'
  );
$$;

-- Is the current user in the unit_admins table for this unit?
create or replace function public.is_unit_admin(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from unit_admins
    where unit_id = p_unit_id
      and user_id = auth.uid()
  );
$$;

-- Is the current user the creator of this unit, OR the org owner?
create or replace function public.is_unit_manager(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from units
    where id = p_unit_id
      and (created_by_admin_id = auth.uid() or is_org_owner_by_unit(p_unit_id))
  );
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ---- organizations ----

create policy "Super admin: full access to organizations"
  on organizations for all
  using     (is_super_admin())
  with check(is_super_admin());

create policy "Owners: full access to organizations they created"
  on organizations for all
  using     (created_by_admin_id = auth.uid())
  with check(created_by_admin_id = auth.uid());

create policy "Members: read organizations they belong to"
  on organizations for select
  using (is_org_member(id));

-- Allow any authenticated user to discover all orgs (for the join-org workflow).
create policy "Authenticated: discover organizations"
  on organizations for select
  to authenticated
  using (true);

create policy "Authenticated: create organizations"
  on organizations for insert
  to authenticated
  with check (auth.uid() is not null);

-- ---- organization_members ----

create policy "Owners: full access to org members"
  on organization_members for all
  using (is_org_owner(organization_id));

create policy "Members: read colleagues"
  on organization_members for select
  using (is_org_member(organization_id));

-- ---- join_requests ----

create policy "Admins: create and read own requests"
  on join_requests for all
  using (admin_id = auth.uid());

create policy "Owners: manage requests for their org"
  on join_requests for all
  using (is_org_owner(organization_id));

-- ---- units ----

create policy "Super admin: full access to units"
  on units for all
  using     (is_super_admin())
  with check(is_super_admin());

-- Org members can create units in their org.
create policy "Members: create units in their organizations"
  on units for insert
  to authenticated
  with check (is_org_member(org_id));

-- Org members can read all units in their org.
create policy "Members: read all units in their organizations"
  on units for select
  using (is_org_member(org_id));

-- Unit creator + org owner have full CRUD.
create policy "Managers: full access to units"
  on units for all
  using     (is_unit_manager(id))
  with check(is_unit_manager(id));

-- ---- unit_admins ----

create policy "Super admin: full access to unit_admins"
  on unit_admins for all
  using     (is_super_admin())
  with check(is_super_admin());

create policy "Owners: manage unit_admins for their units"
  on unit_admins for all
  using (is_org_owner_by_unit(unit_id));

create policy "Unit admins: read their own row"
  on unit_admins for select
  to authenticated
  using (user_id = auth.uid());

-- ---- members ----

create policy "Managers: full access to members"
  on members for all
  using     (is_unit_manager(unit_id))
  with check(is_unit_manager(unit_id));

create policy "Admins: view all members in their orgs"
  on members for select
  using (is_org_member((select org_id from units where id = unit_id)));

-- ---- services ----

create policy "Managers: full access to services"
  on services for all
  using     (is_unit_manager(unit_id))
  with check(is_unit_manager(unit_id));

create policy "Admins: view all services in their orgs"
  on services for select
  using (is_org_member((select org_id from units where id = unit_id)));

-- ---- attendance ----

create policy "Managers: full access to attendance"
  on attendance for all
  using (
    exists (
      select 1 from services s
      where s.id = service_id
        and is_unit_manager(s.unit_id)
    )
  );

create policy "Admins: view all attendance in their orgs"
  on attendance for select
  using (
    exists (
      select 1 from services s
      join units u on u.id = s.unit_id
      where s.id = service_id
        and is_org_member(u.org_id)
    )
  );

-- Allow anonymous check-ins via RPC (the function itself enforces all security).
create policy "Anon: insert attendance via RPC"
  on attendance for insert
  to anon
  with check (true);

-- ---- member_notifications ----

create policy "Managers: full access to notifications in their unit"
  on member_notifications for all
  to authenticated
  using     (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  with check(is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- When a unit is created: auto-add the org owner AND unit creator to unit_admins.
create or replace function public.handle_new_unit()
returns trigger language plpgsql security definer as $$
declare
  v_org_owner_id uuid;
begin
  select created_by_admin_id
    into v_org_owner_id
    from organizations
   where id = new.org_id;

  -- Give the org owner direct access to every unit in their org.
  if v_org_owner_id is not null then
    insert into unit_admins (unit_id, user_id)
    values (new.id, v_org_owner_id)
    on conflict do nothing;
  end if;

  -- Also give the unit creator direct access when they differ from the owner
  -- (i.e. a member-admin created the unit inside an org they joined).
  if new.created_by_admin_id is not null
     and new.created_by_admin_id is distinct from v_org_owner_id
  then
    insert into unit_admins (unit_id, user_id)
    values (new.id, new.created_by_admin_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_unit_created on units;
create trigger on_unit_created
  after insert on units
  for each row execute procedure public.handle_new_unit();

-- When an org is created: auto-insert creator into organization_members as owner.
-- This fixes the chicken-and-egg RLS problem: the insert runs in security definer
-- context, bypassing RLS, so the app does not need to do it manually.
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer as $$
begin
  insert into organization_members (organization_id, admin_id, role)
  values (new.id, new.created_by_admin_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_organization_created on organizations;
create trigger on_organization_created
  after insert on organizations
  for each row execute procedure public.handle_new_organization();

-- When a join request is approved: auto-add requester to organization_members.
create or replace function public.handle_join_request_update()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into organization_members (organization_id, admin_id, role)
    values (new.organization_id, new.admin_id, 'member')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_join_request_approved on join_requests;
create trigger on_join_request_approved
  after update on join_requests
  for each row execute procedure public.handle_join_request_update();

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Returns the list of active members for a service (public, no auth required).
create or replace function public.get_service_members(
  p_service_id uuid,
  p_search     text default null
)
returns table (id uuid, name text, section text)
language sql stable security definer as $$
  select m.id, m.name, m.section
  from members m
  join services s on s.unit_id = m.unit_id
  where s.id = p_service_id
    and m.status = 'active'
    and (
      p_search is null or
      m.name    ilike '%' || p_search || '%' or
      m.section ilike '%' || p_search || '%'
    )
  order by m.section nulls last, m.name
  limit 150;
$$;

grant execute on function public.get_service_members(uuid, text) to anon;
grant execute on function public.get_service_members(uuid, text) to authenticated;

-- Records a check-in for a member. Enforces: unique per service, device locking,
-- and location radius. Safe to call without auth (anon).
create or replace function public.checkin_by_id(
  p_member_id  uuid,
  p_service_id uuid,
  p_device_id  text    default null,
  p_lat        numeric default null,
  p_lng        numeric default null
)
returns json language plpgsql security definer as $$
declare
  v_member   members;
  v_service  services;
  v_unit     units;
  v_existing attendance;
  v_dist     float;
begin
  -- 1. Validate service and unit
  select s.*, u.latitude, u.longitude, u.radius_meters
    into v_service, v_unit
    from services s
    join units u on u.id = s.unit_id
   where s.id = p_service_id;

  if not found then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  -- 2. Location check (mandatory when unit has coordinates)
  if v_unit.latitude is not null and v_unit.longitude is not null then
    if p_lat is null or p_lng is null then
      return json_build_object('success', false, 'error', 'location_required');
    end if;

    v_dist := 111320 * sqrt(
      pow(p_lat - v_unit.latitude, 2) +
      pow(cos(v_unit.latitude * pi() / 180) * (p_lng - v_unit.longitude), 2)
    );

    if v_dist > v_unit.radius_meters then
      return json_build_object('success', false, 'error', 'too_far', 'distance', floor(v_dist));
    end if;
  end if;

  -- 3. Validate member belongs to this unit
  select * into v_member
  from members
  where id = p_member_id
    and unit_id = v_service.unit_id
    and status = 'active';

  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  -- 4. Prevent double check-ins
  select * into v_existing
  from attendance
  where service_id = p_service_id and member_id = p_member_id;

  if found then
    return json_build_object('success', false, 'error', 'already_checked_in', 'name', v_member.name);
  end if;

  -- 5. Device locking: one device per member per service
  if p_device_id is not null then
    if exists (
      select 1 from attendance
      where service_id = p_service_id
        and device_id  = p_device_id
        and member_id != p_member_id
    ) then
      return json_build_object('success', false, 'error', 'device_locked');
    end if;
  end if;

  -- 6. Insert
  insert into attendance (service_id, member_id, checked_in, checkin_time, device_id, latitude, longitude)
  values (p_service_id, p_member_id, true, now(), p_device_id, p_lat, p_lng);

  return json_build_object('success', true, 'name', v_member.name);
end;
$$;

-- IMPORTANT: grant uses the full 5-argument signature.
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to anon;
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to authenticated;

-- Returns members with attendance status for a service (authenticated, admin only).
create or replace function public.get_service_members_full(
  p_service_id uuid,
  p_limit      int default 1000,
  p_offset     int default 0
)
returns table (
  id           uuid,
  name         text,
  phone        text,
  section      text,
  checked_in   boolean,
  checkin_time timestamptz
)
language sql stable security definer as $$
  select
    m.id,
    m.name,
    m.phone,
    m.section,
    (a.id is not null) as checked_in,
    a.checkin_time
  from members m
  join services s on s.unit_id = m.unit_id
  left join attendance a on a.member_id = m.id and a.service_id = p_service_id
  where s.id = p_service_id
    and m.status = 'active'
  order by m.section nulls last, m.name
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.get_service_members_full(uuid, int, int) to authenticated;

-- Adds a unit admin by email (org owner or super admin only).
create or replace function public.add_unit_admin_by_email(p_unit_id uuid, p_email text)
returns json language plpgsql security definer as $$
declare
  v_user_id uuid;
begin
  if not (is_super_admin() or is_org_owner_by_unit(p_unit_id)) then
    raise exception 'Unauthorized';
  end if;

  select id into v_user_id
  from auth.users
  where email = lower(p_email)
  limit 1;

  if v_user_id is null then
    return json_build_object(
      'status', 'not_found',
      'message', 'No user found with that email. They must create an account first.'
    );
  end if;

  insert into unit_admins (unit_id, user_id)
  values (p_unit_id, v_user_id)
  on conflict (unit_id, user_id) do nothing;

  return json_build_object('status', 'success', 'user_id', v_user_id);
end;
$$;

grant execute on function public.add_unit_admin_by_email(uuid, text) to authenticated;

-- Lists pending join requests for an org (org owners only).
drop function if exists public.get_org_join_requests(uuid);
create function public.get_org_join_requests(p_org_id uuid)
returns table (
  id              uuid,
  organization_id uuid,
  admin_id        uuid,
  admin_email     text,
  status          text,
  created_at      timestamptz
)
language sql stable security definer as $$
  select
    jr.id,
    jr.organization_id,
    jr.admin_id,
    u.email as admin_email,
    jr.status,
    jr.created_at
  from join_requests jr
  join auth.users u on u.id = jr.admin_id
  where jr.organization_id = p_org_id
    and jr.status          = 'pending'
    and is_org_owner(p_org_id)   -- silently returns 0 rows for non-owners
  order by jr.created_at desc;
$$;

grant execute on function public.get_org_join_requests(uuid) to authenticated;

-- Returns pending (unfired) birthday notifications for a unit.
create or replace function public.get_pending_notifications(p_unit_id uuid)
returns table (
  id          uuid,
  member_id   uuid,
  member_name text,
  type        text,
  fire_at     timestamptz
)
language sql stable security definer as $$
  select
    n.id,
    n.member_id,
    m.name as member_name,
    n.type,
    n.fire_at
  from member_notifications n
  join members m on m.id = n.member_id
  where n.unit_id    = p_unit_id
    and n.dismissed  = false
    and n.fire_at   <= now()
  order by n.fire_at desc;
$$;

grant execute on function public.get_pending_notifications(uuid) to authenticated;

-- Enqueues birthday notifications for today and tomorrow.
-- Schedule daily at 9 AM via pg_cron:
--   select cron.schedule('birthday-notifications', '0 9 * * *', 'select enqueue_birthday_notifications()');
create or replace function public.enqueue_birthday_notifications()
returns void language plpgsql security definer as $$
begin
  -- Birthday Eve: notify the day before the birthday.
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_eve' as type,
    (current_date + interval '1 day' + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date + interval '1 day', 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;

  -- Birthday Day: notify on the birthday itself.
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_day' as type,
    (current_date + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date, 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;
end;
$$;

-- ============================================================
-- REALTIME
-- Enable realtime on attendance so the admin dashboard live-updates.
-- ============================================================
alter publication supabase_realtime add table attendance;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

create index if not exists idx_organizations_created_by  on organizations(created_by_admin_id);
create index if not exists idx_org_members_admin_id      on organization_members(admin_id);
create index if not exists idx_org_members_org_id        on organization_members(organization_id);
create index if not exists idx_join_requests_org_status  on join_requests(organization_id, status);
create index if not exists idx_units_org_id              on units(org_id);
create index if not exists idx_units_created_by          on units(created_by_admin_id);
create index if not exists idx_unit_admins_unit_id       on unit_admins(unit_id);
create index if not exists idx_unit_admins_user_id       on unit_admins(user_id);
create index if not exists idx_members_unit_id           on members(unit_id);
create index if not exists idx_members_status            on members(status);
create index if not exists idx_members_section_name      on members(section, name);
create index if not exists idx_services_unit_id_date     on services(unit_id, date desc);
create index if not exists idx_attendance_service_id     on attendance(service_id);
create index if not exists idx_attendance_member_id      on attendance(member_id);
create index if not exists idx_attendance_service_member on attendance(service_id, member_id);
create index if not exists idx_notifications_unit_fire   on member_notifications(unit_id, dismissed, fire_at desc);

-- ============================================================
-- SUPER ADMIN SETUP
-- Replace the email below and run once after first deployment.
-- ============================================================
-- update auth.users
-- set raw_user_meta_data = raw_user_meta_data || '{"role":"superadmin"}'
-- where email = 'your@email.com';
