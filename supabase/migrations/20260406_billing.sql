-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: SaaS Billing — subscriptions, SMS credits, usage events
-- Run once in Supabase SQL Editor.
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE throughout.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Pricing plan reference ────────────────────────────────────────────────
-- Stored as a static lookup table so the webhook and edge functions can
-- resolve plan metadata (credits_included) from a plan_id string without
-- hard-coding it in multiple places.
-- Plans are owned by the platform, not by orgs — no RLS needed.

create table if not exists pricing_plans (
  id               text primary key,  -- 'starter' | 'growth' | 'pro'
  display_name     text not null,
  price_usd_cents  int  not null,      -- monthly price in USD cents
  credits_included int  not null,      -- SMS follow-ups per billing cycle
  sort_order       int  not null default 0
);

-- Seed plan data — idempotent
-- Pricing rationale (documented here for auditability):
--   SMS cost ≈ $0.055 blended (Twilio UK + Nigeria).
--   Plans priced for 45–63% gross margin at 70% credit utilisation.
--   Current send policy is hard-capped at included credits (no overage billing).
--   All plans profitable even at 100% credit utilisation.
insert into pricing_plans (id, display_name, price_usd_cents, credits_included, sort_order) values
  ('starter', 'Starter',  2500,   200,  1),
  ('growth',  'Growth',   5900,   600,  2),
  ('pro',     'Pro',     11900,  1500,  3)
on conflict (id) do update
  set display_name     = excluded.display_name,
      price_usd_cents  = excluded.price_usd_cents,
      credits_included = excluded.credits_included,
      sort_order       = excluded.sort_order;

-- Only super admins can touch pricing_plans; no org-level access needed.
alter table pricing_plans enable row level security;
drop policy if exists "Super admins: manage plans" on pricing_plans;
create policy "Super admins: manage plans"
  on pricing_plans for all
  using (is_super_admin());

-- Everyone can read plans (for upgrade UI on the frontend).
drop policy if exists "Public: read plans" on pricing_plans;
create policy "Public: read plans"
  on pricing_plans for select
  using (true);


-- ─── 2. Subscriptions ─────────────────────────────────────────────────────────
-- One subscription per organisation.
-- Stripe is the source of truth for payment status; this table is a local
-- cache synced via the stripe-webhook edge function.

create table if not exists subscriptions (
  id                     uuid        primary key default gen_random_uuid(),
  org_id                 uuid        not null unique references organizations(id) on delete cascade,
  stripe_customer_id     text        not null,
  stripe_subscription_id text        unique,
  plan_id                text        not null default 'starter' references pricing_plans(id),
  status                 text        not null default 'incomplete'
    check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  credits_included       int         not null default 250,  -- snapshot; reset each cycle
  current_period_end     timestamptz,
  cancel_at_period_end   boolean     not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Org owners can view their own subscription.
drop policy if exists "Org owners: read own subscription" on subscriptions;
create policy "Org owners: read own subscription"
  on subscriptions for select
  using (is_org_owner(org_id));

-- Org members (admins) can also read it (for the plan badge in unit dashboards).
drop policy if exists "Org members: read subscription" on subscriptions;
create policy "Org members: read subscription"
  on subscriptions for select
  using (is_org_member(org_id));

-- Super admins: full access.
drop policy if exists "Super admins: manage subscriptions" on subscriptions;
create policy "Super admins: manage subscriptions"
  on subscriptions for all
  using (is_super_admin());

-- updated_at trigger
create or replace trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();


-- ─── 3. SMS credits ───────────────────────────────────────────────────────────
-- Tracks the remaining follow-up allowance for each org in the current
-- billing cycle. Deductions are atomic via the deduct_sms_credit() function.
-- Balance can never go below 0 (CHECK constraint + function guard).

create table if not exists sms_credits (
  org_id        uuid        primary key references organizations(id) on delete cascade,
  balance       int         not null default 0 check (balance >= 0),
  last_reset_at timestamptz not null default now()
);

alter table sms_credits enable row level security;

drop policy if exists "Org owners: read own credits" on sms_credits;
create policy "Org owners: read own credits"
  on sms_credits for select
  using (is_org_owner(org_id));

drop policy if exists "Org members: read credits" on sms_credits;
create policy "Org members: read credits"
  on sms_credits for select
  using (is_org_member(org_id));

drop policy if exists "Super admins: manage credits" on sms_credits;
create policy "Super admins: manage credits"
  on sms_credits for all
  using (is_super_admin());


-- ─── 4. Usage events (generic append-only log) ────────────────────────────────
-- Records every platform feature usage for billing auditing and future AI
-- monetisation. Never deletes rows — only inserts.
--
-- event_type values today: 'sms_sent' | 'sms_failed' | 'sms_blocked'
-- event_type values coming: 'ai_insight' | 'ai_followup' | 'ai_prediction'

create table if not exists usage_events (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references organizations(id) on delete cascade,
  unit_id     uuid        references units(id) on delete set null,
  service_id  uuid        references services(id) on delete set null,
  member_id   uuid        references members(id) on delete set null,
  event_type  text        not null,
  quantity    int         not null default 1,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

alter table usage_events enable row level security;

-- Org owners can read their usage history (for billing page).
drop policy if exists "Org owners: read usage" on usage_events;
create policy "Org owners: read usage"
  on usage_events for select
  using (is_org_owner(org_id));

drop policy if exists "Super admins: manage usage events" on usage_events;
create policy "Super admins: manage usage events"
  on usage_events for all
  using (is_super_admin());

-- Index: fast lookup for the billing page (by org + month)
create index if not exists idx_usage_events_org_created on usage_events(org_id, created_at desc);
create index if not exists idx_usage_events_type        on usage_events(event_type);


-- ─── 5. Atomic credit deduction function ─────────────────────────────────────
-- Called from the send-absence-sms edge function (via service-role).
-- Returns TRUE if a credit was deducted, FALSE if balance was already 0.
--
-- FOR UPDATE ensures only one process at a time can read+modify the balance
-- row — no race conditions, no double-deductions, no negative balances.

create or replace function public.deduct_sms_credit(p_org_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  select balance
  into   v_balance
  from   sms_credits
  where  org_id = p_org_id
  for update;

  if not found then
    -- No credits row at all → no active subscription, block send.
    return false;
  end if;

  if v_balance <= 0 then
    return false;
  end if;

  update sms_credits
  set    balance = balance - 1
  where  org_id = p_org_id;

  return true;
end;
$$;

revoke all on function public.deduct_sms_credit(uuid) from public;
-- Only callable by service-role (edge functions); not exposed to anon/authenticated.
-- The edge function uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.


-- ─── 5b. Credit refund (used when a concurrent duplicate is detected) ─────────
-- When two concurrent invocations both claim the same member, the second one
-- deducted a credit but won't send. This function refunds it atomically.

create or replace function public.refund_sms_credit(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update sms_credits
  set    balance = balance + 1
  where  org_id = p_org_id;
end;
$$;

revoke all on function public.refund_sms_credit(uuid) from public;


-- ─── 6. Credit reset function ─────────────────────────────────────────────────
-- Called by the stripe-webhook when invoice.paid fires.
-- Resets balance to the plan's credits_included and stamps last_reset_at.

create or replace function public.reset_sms_credits(p_org_id uuid, p_credits int)
returns void
language plpgsql
security definer
as $$
begin
  insert into sms_credits (org_id, balance, last_reset_at)
  values (p_org_id, p_credits, now())
  on conflict (org_id) do update
    set balance       = p_credits,
        last_reset_at = now();
end;
$$;

revoke all on function public.reset_sms_credits(uuid, int) from public;


-- ─── 7. Helper: get_org_subscription ─────────────────────────────────────────
-- Used by the frontend billing page (single RPC instead of two queries).
-- Returns subscription + credit balance in one round-trip.

drop function if exists public.get_org_billing(uuid);
create or replace function public.get_org_billing(p_org_id uuid)
returns jsonb
language plpgsql stable security definer
as $$
declare
  v_sub    jsonb;
  v_credit jsonb;
  v_plan   jsonb;
begin
  if not (is_super_admin() or is_org_owner(p_org_id) or is_org_member(p_org_id)) then
    raise exception 'Unauthorized';
  end if;

  select to_jsonb(s) into v_sub
  from   subscriptions s
  where  s.org_id = p_org_id;

  select to_jsonb(c) into v_credit
  from   sms_credits c
  where  c.org_id = p_org_id;

  select to_jsonb(p) into v_plan
  from   pricing_plans p
  where  p.id = coalesce((v_sub->>'plan_id'), 'starter');

  return jsonb_build_object(
    'subscription', v_sub,
    'credits',      v_credit,
    'plan',         v_plan
  );
end;
$$;

revoke all on function public.get_org_billing(uuid) from public;
grant execute on function public.get_org_billing(uuid) to authenticated;


-- ─── 8. Indexes for subscriptions ────────────────────────────────────────────
create index if not exists idx_subscriptions_org    on subscriptions(org_id);
create index if not exists idx_subscriptions_stripe on subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_status on subscriptions(status);
