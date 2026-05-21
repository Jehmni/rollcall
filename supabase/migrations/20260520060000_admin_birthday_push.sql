-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Admin birthday web push subscriptions
-- Date: 2026-05-20
--
-- Adds admin-device push subscriptions for birthday alerts. Member-facing
-- session pushes stay on member_push_subscriptions.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.admin_push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  unit_id    uuid        not null references public.units(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, unit_id, endpoint)
);

alter table public.admin_push_subscriptions enable row level security;

alter table public.member_notifications
  add column if not exists admin_push_sent_at timestamptz;

drop policy if exists "Admins: read own admin push subscriptions" on public.admin_push_subscriptions;
create policy "Admins: read own admin push subscriptions"
  on public.admin_push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins: insert own admin push subscriptions" on public.admin_push_subscriptions;
create policy "Admins: insert own admin push subscriptions"
  on public.admin_push_subscriptions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  );

drop policy if exists "Admins: update own admin push subscriptions" on public.admin_push_subscriptions;
create policy "Admins: update own admin push subscriptions"
  on public.admin_push_subscriptions for update
  to authenticated
  using (
    user_id = auth.uid()
    and (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  )
  with check (
    user_id = auth.uid()
    and (is_unit_admin(unit_id) or is_org_owner_by_unit(unit_id) or is_super_admin())
  );

drop policy if exists "Admins: delete own admin push subscriptions" on public.admin_push_subscriptions;
create policy "Admins: delete own admin push subscriptions"
  on public.admin_push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists idx_admin_push_subs_unit_id
  on public.admin_push_subscriptions(unit_id);

create index if not exists idx_admin_push_subs_user_id
  on public.admin_push_subscriptions(user_id);

create index if not exists idx_member_notifications_admin_push_due
  on public.member_notifications(unit_id, admin_push_sent_at, dismissed, fire_at)
  where admin_push_sent_at is null and dismissed = false;
