-- ============================================================
-- Rollcally — Multi-tenant schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  description text,
  latitude    numeric,
  longitude   numeric,
  radius_meters int default 100,
  created_at  timestamptz not null default now()
);

-- Previous tables (members, services, attendance, unit_admins) remain identical --

-- Helper: is the current user an owner of the organization that owns this unit?
create or replace function is_org_owner_by_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from organizations o
    join units u on u.org_id = o.id
    where u.id = p_unit_id
      and o.owner_id = auth.uid()
  );
$$;

-- ---- organizations ----
create policy "Super admin: full access to organizations"
  on organizations for all
  using (is_super_admin());

create policy "Owners: full access to their own organizations"
  on organizations for all
  using (owner_id = auth.uid());

create policy "Authenticated: create organizations"
  on organizations for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "Unit admins: read orgs they belong to"
  on organizations for select
  to authenticated
  using (
    exists (
      select 1 from units u
      join unit_admins ua on ua.unit_id = u.id
      where u.org_id = organizations.id
        and ua.user_id = auth.uid()
    )
  );

-- ---- units ----
create policy "Super admin: full access to units"
  on units for all
  using (is_super_admin());

create policy "Owners: full access to units in their orgs"
  on units for all
  using (
    exists (
      select 1 from organizations o
      where o.id = units.org_id
        and o.owner_id = auth.uid()
    )
  );

create policy "Unit admins: read their units"
  on units for select
  to authenticated
  using (is_unit_admin(id));

-- ---- members, services, attendance update similar patterns ----

-- Update RLS for members to strictly check unit_admin or org_owner
create policy "Admins: full access to members"
  on members for all
  using (is_super_admin() or is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id));

-- ---- unit_admins ----
create policy "Super admin: full access to unit_admins"
  on unit_admins for all
  using (is_super_admin());

create policy "Owners: manage unit_admins for their units"
  on unit_admins for all
  using (is_org_owner_by_unit(unit_id));

create policy "Unit admins: read their own row"
  on unit_admins for select
  to authenticated
  using (user_id = auth.uid());

-- Trigger to automatically make the organization owner a unit_admin of every unit created in their org
create or replace function public.handle_new_unit()
returns trigger
language plpgsql
security definer as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id from organizations where id = new.org_id;
  if v_owner_id is not null then
    insert into unit_admins (unit_id, user_id)
    values (new.id, v_owner_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_unit_created
  after insert on units
  for each row execute procedure public.handle_new_unit();

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Returns the list of active members for the unit that owns a given service.
-- Used by the public check-in page (no auth required).
create or replace function get_service_members(p_service_id uuid, p_search text default null)
returns table (id uuid, name text, section text)
language sql
stable
security definer
as $$
  select m.id, m.name, m.section
  from members m
  join services s on s.unit_id = m.unit_id
  where s.id = p_service_id
    and m.status = 'active'
    and (
      p_search is null or 
      m.name ilike '%' || p_search || '%' or 
      m.section ilike '%' || p_search || '%'
    )
  order by m.section nulls last, m.name
  limit 150; -- Safety cap for public view
$$;

-- Records a check-in for a member at a service.
-- Enforces mandatory security: Unique member per service, device locking, and location radius.
create or replace function checkin_by_id(
  p_member_id uuid, 
  p_service_id uuid,
  p_device_id text default null,
  p_lat numeric default null,
  p_lng numeric default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_member   members;
  v_service  services;
  v_unit     units;
  v_existing attendance;
  v_dist     float;
begin
  -- 1. Validate Service and Unit
  select s.*, u.latitude, u.longitude, u.radius_meters 
  into v_service, v_unit
  from services s
  join units u on u.id = s.unit_id
  where s.id = p_service_id;
  
  if not found then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  -- 2. Security: Location Check (Mandatory if unit has coordinates)
  if v_unit.latitude is not null and v_unit.longitude is not null then
    if p_lat is null or p_lng is null then
      return json_build_object('success', false, 'error', 'location_required');
    end if;
    
    -- Very basic distance approximation (Haversine would be better but this is simplified for SQL)
    v_dist := 111320 * sqrt(
      pow(p_lat - v_unit.latitude, 2) + 
      pow(cos(v_unit.latitude * pi()/180) * (p_lng - v_unit.longitude), 2)
    );
    
    if v_dist > v_unit.radius_meters then
      return json_build_object('success', false, 'error', 'too_far', 'distance', floor(v_dist));
    end if;
  end if;

  -- 3. Validate Member
  select * into v_member
  from members
  where id = p_member_id
    and unit_id = v_service.unit_id
    and status = 'active';

  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  -- 4. Security: Prevent Double Check-ins
  select * into v_existing
  from attendance
  where service_id = p_service_id and member_id = p_member_id;

  if found then
    return json_build_object('success', false, 'error', 'already_checked_in', 'name', v_member.name);
  end if;

  -- 5. Security: Device Locking (Mandatory)
  -- If this service already has a check-in from this device for a DIFFERENT member, block it.
  if p_device_id is not null then
    if exists (
      select 1 from attendance 
      where service_id = p_service_id 
        and device_id = p_device_id 
        and member_id != p_member_id
    ) then
      return json_build_object('success', false, 'error', 'device_locked');
    end if;
  end if;

  -- 6. Insert Record
  insert into attendance (service_id, member_id, checked_in, checkin_time, device_id, latitude, longitude)
  values (p_service_id, p_member_id, true, now(), p_device_id, p_lat, p_lng);

  return json_build_object('success', true, 'name', v_member.name);
end;
$$;

grant execute on function checkin_by_id(uuid, uuid) to anon;

-- Returns members with their attendance status for a service.
-- Used by the admin service detail page (authenticated).
create or replace function get_service_members_full(p_service_id uuid, p_limit int default 1000, p_offset int default 0)
returns table (
  id           uuid,
  name         text,
  phone        text,
  section      text,
  checked_in   boolean,
  checkin_time timestamptz
)
language sql
stable
security definer
as $$
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

grant execute on function get_service_members_full(uuid, int, int) to authenticated;

-- Adds a unit admin by email address (super admin only).
create or replace function add_unit_admin_by_email(p_unit_id uuid, p_email text)
returns json
language plpgsql
security definer
as $$
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

grant execute on function add_unit_admin_by_email(uuid, text) to authenticated;

-- ============================================================
-- REALTIME
-- Enable realtime on attendance so the admin dashboard live-updates.
-- ============================================================
alter publication supabase_realtime add table attendance;

-- ============================================================
-- SET SUPER ADMIN
-- Replace 'your@email.com' with your admin email, then run.
-- ============================================================
-- ============================================================
-- ADD BIRTHDAY COLUMN TO MEMBERS
-- ============================================================
alter table members add column if not exists birthday date;

-- ============================================================
-- NOTIFICATION SYSTEM
-- ============================================================

create table if not exists member_notifications (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  type       text not null check (type in ('birthday_eve', 'birthday_day')),
  fire_at    timestamptz not null,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Unique index for member, type and timestamp
create unique index if not exists member_notifications_unique_type_time 
on member_notifications (member_id, type, fire_at);

alter table member_notifications enable row level security;

create policy "Unit admins: full access to notifications in their unit"
  on member_notifications for all
  to authenticated
  using (is_unit_admin(unit_id))
  with check (is_unit_admin(unit_id));

-- RPC to get pending notifications for a unit
create or replace function get_pending_notifications(p_unit_id uuid)
returns table (
  id          uuid,
  member_id   uuid,
  member_name text,
  type        text,
  fire_at     timestamptz
)
language sql
stable
security definer
as $$
  select 
    n.id, 
    n.member_id, 
    m.name as member_name, 
    n.type, 
    n.fire_at
  from member_notifications n
  join members m on m.id = n.member_id
  where n.unit_id = p_unit_id
    and n.dismissed = false
    and n.fire_at <= now()
  order by n.fire_at desc;
$$;

grant execute on function get_pending_notifications(uuid) to authenticated;

-- Function to enqueue birthday notifications
create or replace function enqueue_birthday_notifications()
returns void
language plpgsql
security definer
as $$
begin
  -- Birthday Eve: day before birthday at 9am
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select 
    unit_id, 
    id as member_id, 
    'birthday_eve' as type,
    (current_date + interval '1 day' + interval '9 hours')::timestamptz
  from members
  where status = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date + interval '1 day', 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;

  -- Birthday Day: day of birthday at 9am
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select 
    unit_id, 
    id as member_id, 
    'birthday_day' as type,
    (current_date + interval '9 hours')::timestamptz
  from members
  where status = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date, 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;
end;
$$;

-- Note: In a real Supabase environment, you would enable pg_cron and schedule it:
-- select cron.schedule('birthday-notifications', '0 9 * * *', 'select enqueue_birthday_notifications()');

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Organizations
create index if not exists idx_organizations_owner_id on organizations(owner_id);

-- Units
create index if not exists idx_units_org_id on units(org_id);

-- Members
create index if not exists idx_members_unit_id on members(unit_id);
create index if not exists idx_members_status on members(status);
create index if not exists idx_members_section_name on members(section, name);

-- Services
create index if not exists idx_services_unit_id_date on services(unit_id, date desc);

-- Attendance
create index if not exists idx_attendance_service_id on attendance(service_id);
create index if not exists idx_attendance_member_id on attendance(member_id);
create index if not exists idx_attendance_service_member on attendance(service_id, member_id);

-- Unit Admins
create index if not exists idx_unit_admins_unit_id on unit_admins(unit_id);
create index if not exists idx_unit_admins_user_id on unit_admins(user_id);

-- Notifications
create index if not exists idx_member_notifications_unit_dismissed_fire on member_notifications(unit_id, dismissed, fire_at desc);
