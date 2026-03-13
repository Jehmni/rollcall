-- ============================================================
-- 20260313_multi_admin.sql
-- Migration to support Multi-Admin Organization Management
-- ============================================================

-- 1. Organizations: Ownership Update
-- owner_id already exists and refers to the creator. 
-- We'll keep it as the "Master Owner" / "Creator".
alter table organizations rename column owner_id to created_by_admin_id;

-- 2. Organization Members
-- Junction table for admins belonging to an organization.
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique(organization_id, admin_id)
);

-- 3. Join Requests
-- Workflow for admins to discover and join organizations.
create table if not exists join_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  admin_id uuid not null references auth.users(id),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique(organization_id, admin_id)
);

-- 4. Units: Ownership Update
-- Track who created each unit for distributed responsibility.
alter table units add column created_by_admin_id uuid references auth.users(id);

-- Migration: Set existing unit creators to the organization owner.
update units u
set created_by_admin_id = o.created_by_admin_id
from organizations o
where u.org_id = o.id;

-- Make it not null after migration
alter table units alter column created_by_admin_id set not null;

-- Migration: Set existing organization creators as owners in organization_members.
insert into organization_members (organization_id, admin_id, role)
select id, created_by_admin_id, 'owner'
from organizations
on conflict do nothing;

-- 5. Helper Functions for RLS
create or replace function is_org_owner(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function is_org_member(p_org_id uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
  );
$$;

-- 6. RLS Policies Overhaul

-- ---- organizations ----
drop policy if exists "Owners: full access to their own organizations" on organizations;
drop policy if exists "Unit admins: read orgs they belong to" on organizations;

-- Organization Creator (Owner) has full access
create policy "Owners: full access to organizations they created"
  on organizations for all
  using (created_by_admin_id = auth.uid())
  with check (created_by_admin_id = auth.uid());

-- Organization Members can select (Read Only)
create policy "Members: read organizations they belong to"
  on organizations for select
  using (is_org_member(id));

-- Anyone authenticated can search (Read Only for discovery)
create policy "Authenticated: discover organizations"
  on organizations for select
  to authenticated
  using (true);

-- ---- organization_members ----
alter table organization_members enable row level security;

create policy "Owners: full access to members"
  on organization_members for all
  using (is_org_owner(organization_id));

create policy "Members: read colleagues"
  on organization_members for select
  using (is_org_member(organization_id));

-- ---- join_requests ----
alter table join_requests enable row level security;

create policy "Admins: create and read own requests"
  on join_requests for all
  using (admin_id = auth.uid());

create policy "Owners: manage requests for their org"
  on join_requests for all
  using (is_org_owner(organization_id));

-- ---- units ----
drop policy if exists "Owners: full access to units in their orgs" on units;
drop policy if exists "Unit admins: read their units" on units;

-- Org Members can Create units
create policy "Members: create units in their organizations"
  on units for insert
  to authenticated
  with check (is_org_member(org_id));

-- Org Members can Read all units in their organizations
create policy "Members: read all units in their organizations"
  on units for select
  using (is_org_member(org_id));

-- Unit Creators (and Org Owners) have Full CRUD on their units
create policy "Creators: full access to units they created"
  on units for all
  using (created_by_admin_id = auth.uid() or is_org_owner(org_id));

-- 7. Automated Membership Logic
-- When a join request is approved, automatically add to organization_members.
create or replace function handle_join_request_update()
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

create trigger on_join_request_approved
  after update on join_requests
  for each row execute procedure handle_join_request_update();

-- 8. Indexes for Performance
create index if not exists idx_org_members_admin_id on organization_members(admin_id);
create index if not exists idx_join_requests_org_status on join_requests(organization_id, status);
create index if not exists idx_units_created_by on units(created_by_admin_id);
