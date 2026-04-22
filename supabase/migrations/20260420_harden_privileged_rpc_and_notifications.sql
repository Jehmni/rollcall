-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Harden privileged RPC and birthday notification access
-- Date: 2026-04-20
--
-- Fixes:
--   1) list_admin_users() now enforces super-admin caller checks.
--   2) get_pending_notifications() now enforces unit/org/super-admin access.
--
-- Safe to re-run (CREATE OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns pending (unfired) birthday notifications for a unit.
create or replace function public.get_pending_notifications(p_unit_id uuid)
returns table (
  id          uuid,
  member_id   uuid,
  member_name text,
  type        text,
  fire_at     timestamptz
)
language plpgsql stable security definer as $$
begin
  if not (is_unit_admin(p_unit_id) or is_org_owner_by_unit(p_unit_id) or is_super_admin()) then
    raise exception 'Unauthorized';
  end if;

  return query
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
end;
$$;

grant execute on function public.get_pending_notifications(uuid) to authenticated;

-- Returns all admin users (org members + unit admins) with email.
-- Only super admins may call this function.
create or replace function public.list_admin_users()
returns table(
  user_id    uuid,
  email      text,
  created_at timestamptz,
  org_name   text,
  blocked    boolean
) language plpgsql security definer stable as $$
begin
  if not is_super_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select distinct
    u.id                        as user_id,
    u.email                     as email,
    u.created_at                as created_at,
    coalesce(
      (select o.name from public.organization_members om
       join public.organizations o on o.id = om.organization_id
       where om.admin_id = u.id limit 1),
      (select o.name from public.unit_admins ua
       join public.units ut on ut.id = ua.unit_id
       join public.organizations o on o.id = ut.org_id
       where ua.user_id = u.id limit 1)
    )                           as org_name,
    exists(select 1 from public.blocked_admins ba where ba.user_id = u.id) as blocked
  from auth.users u
  where
    exists(select 1 from public.organization_members om where om.admin_id = u.id)
    or exists(select 1 from public.unit_admins ua where ua.user_id = u.id)
  order by u.created_at desc;
end;
$$;

grant execute on function public.list_admin_users() to authenticated;
