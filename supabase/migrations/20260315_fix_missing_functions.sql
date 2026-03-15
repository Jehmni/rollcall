-- ============================================================
-- 20260315_fix_missing_functions.sql
-- Fix missing RLS helper functions, broken trigger, and circular
-- dependency that prevented org creators from seeing their orgs.
-- ============================================================

-- ============================================================
-- 1. is_super_admin()
-- Referenced in super-admin RLS policies but was never defined.
-- Checks raw_user_meta_data so it works even with a stale JWT.
-- ============================================================
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from auth.users
    where id   = auth.uid()
      and raw_user_meta_data->>'role' = 'superadmin'
  );
$$;

-- ============================================================
-- 2. is_unit_admin()
-- Referenced by the member_notifications RLS policy but was
-- never defined.  Checks the legacy unit_admins junction table.
-- ============================================================
create or replace function public.is_unit_admin(p_unit_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from unit_admins
    where unit_id = p_unit_id
      and user_id = auth.uid()
  );
$$;

-- ============================================================
-- 3. Recreate super-admin policies now that is_super_admin() exists.
-- These policies may have failed silently if the function was
-- missing when schema.sql was first applied.
-- ============================================================

drop policy if exists "Super admin: full access to organizations" on organizations;
create policy "Super admin: full access to organizations"
  on organizations for all
  using     (is_super_admin())
  with check(is_super_admin());

drop policy if exists "Super admin: full access to units" on units;
create policy "Super admin: full access to units"
  on units for all
  using     (is_super_admin())
  with check(is_super_admin());

drop policy if exists "Super admin: full access to unit_admins" on unit_admins;
create policy "Super admin: full access to unit_admins"
  on unit_admins for all
  using     (is_super_admin())
  with check(is_super_admin());

-- ============================================================
-- 4. Fix member_notifications policy now that is_unit_admin() exists.
-- Also extend it so org owners (via is_org_owner_by_unit) can
-- manage notifications for any unit in their orgs.
-- ============================================================
drop policy if exists "Unit admins: full access to notifications in their unit" on member_notifications;
create policy "Managers: full access to notifications in their unit"
  on member_notifications for all
  to authenticated
  using     (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  with check(is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin());

-- ============================================================
-- 5. Fix handle_new_unit() trigger.
-- Bug: was querying `owner_id` which was renamed to
-- `created_by_admin_id` in migration 20260313.  Also extends it
-- to add the UNIT CREATOR to unit_admins (not just the org owner),
-- so member-admins' units appear in "Direct Unit Access".
-- ============================================================
create or replace function public.handle_new_unit()
returns trigger
language plpgsql
security definer
as $$
declare
  v_org_owner_id uuid;
begin
  -- Resolve the organization owner (column was renamed from owner_id)
  select created_by_admin_id
    into v_org_owner_id
    from organizations
   where id = new.org_id;

  -- Give the org owner direct access to every unit in their org
  if v_org_owner_id is not null then
    insert into unit_admins (unit_id, user_id)
    values (new.id, v_org_owner_id)
    on conflict do nothing;
  end if;

  -- Also give the unit creator direct access when they differ from the owner
  -- (i.e. a member-admin created the unit inside an org they joined)
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

-- ============================================================
-- 6. Add handle_new_organization() trigger.
-- Fixes the circular-dependency bug: when createOrg() tried to
-- INSERT the creator into organization_members, the RLS policy
-- "Owners: full access to members" blocked it because is_org_owner()
-- returned false (no member row existed yet — chicken-and-egg).
-- This SECURITY DEFINER trigger runs outside RLS and inserts the
-- row automatically, so the application no longer needs to do it.
-- ============================================================
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into organization_members (organization_id, admin_id, role)
  values (new.id, new.created_by_admin_id, 'owner')
  on conflict do nothing;   -- idempotent: safe to call twice
  return new;
end;
$$;

drop trigger if exists on_organization_created on organizations;
create trigger on_organization_created
  after insert on organizations
  for each row execute procedure public.handle_new_organization();

-- ============================================================
-- 7. get_org_join_requests() RPC
-- Called from useOrganizations.ts to list pending requests with
-- the requester's email address (requires access to auth.users,
-- hence security definer).  Non-owners receive zero rows.
-- Must drop first because CREATE OR REPLACE cannot change return type.
-- ============================================================
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
language sql
stable
security definer
as $$
  select
    jr.id,
    jr.organization_id,
    jr.admin_id,
    u.email  as admin_email,
    jr.status,
    jr.created_at
  from join_requests jr
  join auth.users u on u.id = jr.admin_id
  where jr.organization_id = p_org_id
    and jr.status          = 'pending'
    -- Authorization: silently returns zero rows for non-owners
    and is_org_owner(p_org_id)
  order by jr.created_at desc;
$$;

grant execute on function public.get_org_join_requests(uuid) to authenticated;

-- ============================================================
-- 8. Backfill: unit_admins for units created by member-admins
-- Units created after migration 20260313 but before this fix had
-- the trigger broken, so the unit creator was never added to
-- unit_admins.  This one-time backfill repairs that.
-- ============================================================
insert into unit_admins (unit_id, user_id)
select u.id, u.created_by_admin_id
from   units u
where  u.created_by_admin_id is not null
on conflict do nothing;

-- ============================================================
-- 9. Backfill: organization_members for orgs whose creator row
-- is missing (created after 20260313 but before this migration,
-- when the circular-dependency bug was active).
-- ============================================================
insert into organization_members (organization_id, admin_id, role)
select o.id, o.created_by_admin_id, 'owner'
from   organizations o
where  o.created_by_admin_id is not null
  and  not exists (
         select 1 from organization_members om
         where  om.organization_id = o.id
           and  om.admin_id        = o.created_by_admin_id
           and  om.role            = 'owner'
       )
on conflict do nothing;
