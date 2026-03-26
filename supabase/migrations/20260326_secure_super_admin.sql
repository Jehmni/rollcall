-- ============================================================
-- MIGRATION: Secure super admin — move from metadata to table
-- ============================================================
-- Previously, is_super_admin() checked raw_user_meta_data->>'role'.
-- This allowed a malicious user to self-assign 'superadmin' during
-- signup by intercepting the request. This migration replaces that
-- with a dedicated super_admins table writable only via service role.
-- ============================================================

-- 1. Create the super_admins table
create table if not exists public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- 2. Enable RLS — users can only see their own row; no client writes
alter table public.super_admins enable row level security;

create policy "super_admins: self read"
  on public.super_admins for select
  to authenticated
  using (auth.uid() = user_id);

-- 3. Migrate any existing super admin from metadata into the table.
--    Safe to run: inserts nothing if no such user exists.
insert into public.super_admins (user_id)
select id from auth.users
where raw_user_meta_data->>'role' = 'superadmin'
on conflict do nothing;

-- 4. Update is_super_admin() to check the table instead of metadata
create or replace function public.is_super_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.super_admins
    where user_id = auth.uid()
  );
$$;
