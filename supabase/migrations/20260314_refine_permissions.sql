-- ============================================================
-- 20260314_refine_permissions.sql
-- Refine unit permissions: Org Owners & Unit Creators get CRUD.
-- ============================================================

-- 1. Fix is_org_owner_by_unit to use organization_members role
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

-- 2. Consolidate is_unit_authorized (Creator or Org Owner)
create or replace function public.is_unit_manager(p_unit_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from units
    where id = p_unit_id
      and (created_by_admin_id = auth.uid() or is_org_owner_by_unit(p_unit_id))
  );
$$;

-- 3. Update Units Policies
drop policy if exists "Creators: full access to units they created" on units;
create policy "Managers: full access to units"
  on units for all
  using (is_unit_manager(id))
  with check (is_unit_manager(id));

-- 4. Update Members Policies
drop policy if exists "Admins: full access to members" on members;
create policy "Managers: full access to members"
  on members for all
  using (is_unit_manager(unit_id))
  with check (is_unit_manager(unit_id));

create policy "Admins: view all members in their orgs"
  on members for select
  using (is_org_member((select org_id from units where id = unit_id)));

-- 5. Update Services Policies
drop policy if exists "Admins: full access to services" on services;
create policy "Managers: full access to services"
  on services for all
  using (is_unit_manager(unit_id))
  with check (is_unit_manager(unit_id));

create policy "Admins: view all services in their orgs"
  on services for select
  using (is_org_member((select org_id from units where id = unit_id)));

-- 6. Update Attendance Policies
drop policy if exists "Admins: full access to attendance" on attendance;
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
