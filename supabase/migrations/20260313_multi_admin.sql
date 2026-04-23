-- ============================================================
-- 20260313_multi_admin.sql
-- Adds multi-admin organization management.
--
-- Depends on: 00000000000000_base_schema.sql
--   (organizations, units, members, services, attendance tables)
--
-- What this migration owns:
--   • organization_members table  (new)
--   • join_requests table         (new)
--   • Helper functions: is_org_owner, is_org_member, is_org_owner_by_unit
--   • RLS policies on organizations, units, org_members, join_requests
--   • on_organization_created trigger
--   • on_join_request_approved trigger
--
-- NOTE on column rename:
--   The original intent was to rename organizations.owner_id →
--   created_by_admin_id. The base schema (00000000000000) already uses
--   created_by_admin_id as the definitive column name, so no rename
--   is performed here.
--
-- NOTE on policy naming:
--   This migration intentionally creates "Creators: full access to units
--   they created" — the older policy name. Migration 20260314 drops it
--   and replaces it with the broader "Managers: full access to units".
--   This preserves the correct incremental migration history.
-- ============================================================

-- ── 1. organization_members ───────────────────────────────────────────────────
create table if not exists public.organization_members (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null
                              references public.organizations(id) on delete cascade,
  admin_id        uuid        not null references auth.users(id),
  role            text        not null check (role in ('owner', 'member')),
  joined_at       timestamptz not null default now(),
  unique(organization_id, admin_id)
);
alter table public.organization_members enable row level security;

-- ── 2. join_requests ─────────────────────────────────────────────────────────
create table if not exists public.join_requests (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null
                              references public.organizations(id) on delete cascade,
  admin_id        uuid        not null references auth.users(id),
  status          text        not null check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz not null default now(),
  unique(organization_id, admin_id)
);
alter table public.join_requests enable row level security;

-- ── 3. Helper functions (now that organization_members exists) ─────────────────

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

-- ── 4. RLS: organizations ─────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to organizations"         on public.organizations;
drop policy if exists "Owners: full access to organizations they created" on public.organizations;
drop policy if exists "Members: read organizations they belong to"        on public.organizations;
drop policy if exists "Authenticated: discover organizations"             on public.organizations;
drop policy if exists "Authenticated: create organizations"               on public.organizations;

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

-- ── 5. RLS: units ─────────────────────────────────────────────────────────────
drop policy if exists "Super admin: full access to units"                  on public.units;
drop policy if exists "Members: create units in their organizations"       on public.units;
drop policy if exists "Members: read all units in their organizations"     on public.units;
-- Intermediate policy — 20260314 will drop this and create "Managers: full access to units".
drop policy if exists "Creators: full access to units they created"        on public.units;

create policy "Super admin: full access to units"
  on public.units for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "Members: create units in their organizations"
  on public.units for insert to authenticated
  with check (public.is_org_member(org_id));

create policy "Members: read all units in their organizations"
  on public.units for select
  using (public.is_org_member(org_id));

-- Intermediate: will be replaced by "Managers: full access to units" in 20260314.
create policy "Creators: full access to units they created"
  on public.units for all
  using     (created_by_admin_id = auth.uid() or public.is_org_owner(org_id))
  with check(created_by_admin_id = auth.uid() or public.is_org_owner(org_id));

-- ── 6. RLS: organization_members ──────────────────────────────────────────────
drop policy if exists "Owners: full access to members"  on public.organization_members;
drop policy if exists "Members: read colleagues"        on public.organization_members;

create policy "Owners: full access to members"
  on public.organization_members for all
  using (public.is_org_owner(organization_id));

create policy "Members: read colleagues"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- ── 7. RLS: join_requests ─────────────────────────────────────────────────────
drop policy if exists "Admins: create and read own requests" on public.join_requests;
drop policy if exists "Owners: manage requests for their org" on public.join_requests;

create policy "Admins: create and read own requests"
  on public.join_requests for all
  using (admin_id = auth.uid());

create policy "Owners: manage requests for their org"
  on public.join_requests for all
  using (public.is_org_owner(organization_id));

-- ── 8. RLS: blocked_admins ────────────────────────────────────────────────────
drop policy if exists "Super admin: manage blocked admins" on public.blocked_admins;
drop policy if exists "User: read own block"               on public.blocked_admins;

create policy "Super admin: manage blocked admins"
  on public.blocked_admins for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy "User: read own block"
  on public.blocked_admins for select to authenticated
  using (auth.uid() = user_id);

-- ── 9. Trigger: auto-enrol creator as owner ──────────────────────────────────
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

-- ── 10. Trigger: approve join request → add to org_members ───────────────────
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

-- ── 11. Backfill: existing org creators → organization_members ────────────────
insert into public.organization_members (organization_id, admin_id, role)
select id, created_by_admin_id, 'owner'
from   public.organizations
on conflict do nothing;

-- ── 12. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_organizations_created_by on public.organizations(created_by_admin_id);
create index if not exists idx_org_members_admin_id     on public.organization_members(admin_id);
create index if not exists idx_org_members_org_id       on public.organization_members(organization_id);
create index if not exists idx_join_requests_org_status on public.join_requests(organization_id, status);
