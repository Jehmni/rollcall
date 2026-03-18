-- ============================================================
-- 20260315_fix_missing_functions.sql
-- Creates tables, triggers, and helper functions that were
-- defined in schema.sql but never included in any migration.
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, and DROP POLICY IF EXISTS.
--
-- Run this BEFORE 20260318_fix_members_rls_and_csv.sql.
-- ============================================================


-- ============================================================
-- MISSING TABLES
-- ============================================================

-- ── unit_admins ───────────────────────────────────────────────────────────────
-- Grants a user direct admin access to a unit.
create table if not exists unit_admins (
  id         uuid primary key default gen_random_uuid(),
  unit_id    uuid not null references units(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(unit_id, user_id)
);

alter table unit_admins enable row level security;

-- ── member_notifications ──────────────────────────────────────────────────────
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
-- HELPER FUNCTIONS
-- ============================================================

-- ── is_super_admin ────────────────────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and raw_user_meta_data->>'role' = 'superadmin'
  );
$$;

-- ── is_unit_admin ─────────────────────────────────────────────────────────────
create or replace function public.is_unit_admin(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from unit_admins
    where unit_id = p_unit_id
      and user_id = auth.uid()
  );
$$;

-- ── is_org_admin_by_service ───────────────────────────────────────────────────
create or replace function public.is_org_admin_by_service(p_service_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members om
    join units u on u.org_id = om.organization_id
    join services s on s.unit_id = u.id
    where s.id = p_service_id
      and om.admin_id = auth.uid()
  );
$$;


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

  if v_org_owner_id is not null then
    insert into unit_admins (unit_id, user_id)
    values (new.id, v_org_owner_id)
    on conflict do nothing;
  end if;

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

-- Backfill: add existing unit creators + org owners into unit_admins
-- (for units created before this migration).
insert into unit_admins (unit_id, user_id)
select u.id, u.created_by_admin_id
from units u
where u.created_by_admin_id is not null
on conflict do nothing;

insert into unit_admins (unit_id, user_id)
select u.id, o.created_by_admin_id
from units u
join organizations o on o.id = u.org_id
where o.created_by_admin_id is not null
on conflict do nothing;


-- ============================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================

-- ── unit_admins ───────────────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to unit_admins" on unit_admins;
create policy "Super admin: full access to unit_admins"
  on unit_admins for all
  using     (is_super_admin())
  with check(is_super_admin());

drop policy if exists "Owners: manage unit_admins for their units" on unit_admins;
create policy "Owners: manage unit_admins for their units"
  on unit_admins for all
  using (is_org_owner_by_unit(unit_id));

drop policy if exists "Unit admins: read their own row" on unit_admins;
create policy "Unit admins: read their own row"
  on unit_admins for select
  to authenticated
  using (user_id = auth.uid());

-- ── member_notifications ──────────────────────────────────────────────────────
drop policy if exists "Managers: full access to notifications in their unit" on member_notifications;
create policy "Managers: full access to notifications in their unit"
  on member_notifications for all
  to authenticated
  using     (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  with check(is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin());


-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- ── get_service_members_full ──────────────────────────────────────────────────
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
language plpgsql stable security definer as $$
begin
  if not (is_super_admin() or is_org_admin_by_service(p_service_id)) then
    raise exception 'Unauthorized';
  end if;

  return query
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
end;
$$;

grant execute on function public.get_service_members_full(uuid, int, int) to authenticated;

-- ── get_org_join_requests ─────────────────────────────────────────────────────
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
    and is_org_owner(p_org_id)
  order by jr.created_at desc;
$$;

grant execute on function public.get_org_join_requests(uuid) to authenticated;

-- ── add_unit_admin_by_email ───────────────────────────────────────────────────
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

-- ── get_pending_notifications ─────────────────────────────────────────────────
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

-- ── enqueue_birthday_notifications ───────────────────────────────────────────
create or replace function public.enqueue_birthday_notifications()
returns void language plpgsql security definer as $$
begin
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
-- INDEXES
-- ============================================================

create index if not exists idx_unit_admins_unit_id  on unit_admins(unit_id);
create index if not exists idx_unit_admins_user_id  on unit_admins(user_id);
create index if not exists idx_notifications_unit_fire
  on member_notifications(unit_id, dismissed, fire_at desc);
