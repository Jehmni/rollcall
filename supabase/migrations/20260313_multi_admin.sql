-- ============================================================
-- 20260313_multi_admin.sql
-- Migration to support Multi-Admin Organization Management
-- ============================================================
-- NOTE: Base tables (organizations, units, etc.) are guaranteed
-- to exist because 00000000000000_base_schema.sql runs first.
-- The organizations table already has created_by_admin_id
-- (not owner_id) in the base schema, so no column rename is needed.
-- This migration only adds the join tables and policies that are
-- ADDITIVE to the base schema.
-- ============================================================

-- 1. organization_members — already created in base schema (IF NOT EXISTS guard).
-- 2. join_requests        — already created in base schema (IF NOT EXISTS guard).
-- 3. organizations RLS policies — already created in base schema (DROP IF EXISTS + CREATE).
-- 4. units.created_by_admin_id  — already a NOT NULL column in base schema.

-- Re-apply RLS policies for organization_members and join_requests with the
-- correct role-based rules introduced in this migration phase.
-- Base schema sets up the initial versions; these are idempotent updates.

-- ---- organization_members ----
drop policy if exists "Owners: full access to members"   on public.organization_members;
drop policy if exists "Members: read colleagues"         on public.organization_members;

create policy "Owners: full access to members"
  on public.organization_members for all
  using (public.is_org_owner(organization_id));

create policy "Members: read colleagues"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- ---- join_requests ----
drop policy if exists "Admins: create and read own requests" on public.join_requests;
drop policy if exists "Owners: manage requests for their org" on public.join_requests;

create policy "Admins: create and read own requests"
  on public.join_requests for all
  using (admin_id = auth.uid());

create policy "Owners: manage requests for their org"
  on public.join_requests for all
  using (public.is_org_owner(organization_id));

-- ---- units (additive RLS only — table already exists) ----
drop policy if exists "Members: create units in their organizations"   on public.units;
drop policy if exists "Members: read all units in their organizations" on public.units;
drop policy if exists "Creators: full access to units they created"   on public.units;
drop policy if exists "Managers: full access to units"                on public.units;

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

-- Backfill: ensure all existing org creators are in organization_members as owner.
insert into public.organization_members (organization_id, admin_id, role)
select id, created_by_admin_id, 'owner'
from public.organizations
on conflict do nothing;

-- Ensure the automated membership trigger is in place.
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

-- Indexes (idempotent).
create index if not exists idx_org_members_admin_id     on public.organization_members(admin_id);
create index if not exists idx_join_requests_org_status on public.join_requests(organization_id, status);
create index if not exists idx_units_created_by         on public.units(created_by_admin_id);
