-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Event-Sourced Billing Ledger
-- Replaces the mutable sms_credits row with an append-only ledger to eliminate 
-- FOR UPDATE row-lock contention during massive concurrent bursts.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the append-only ledger table
create table if not exists public.sms_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  amount int not null,
  transaction_type text not null, -- 'reset', 'deduction', 'refund', 'manual_adjustment'
  admin_id uuid, -- ID of the admin who performed the adjustment (null if system)
  created_at timestamptz not null default now()
);

alter table public.sms_credit_ledger enable row level security;

drop policy if exists "Super admins: manage ledger" on public.sms_credit_ledger;
create policy "Super admins: manage ledger" on public.sms_credit_ledger for all using (public.is_super_admin());

drop policy if exists "Org owners: read ledger" on public.sms_credit_ledger;
create policy "Org owners: read ledger" on public.sms_credit_ledger for select using (public.is_org_owner(org_id));

drop policy if exists "Org members: read ledger" on public.sms_credit_ledger;
create policy "Org members: read ledger" on public.sms_credit_ledger for select using (public.is_org_member(org_id));

-- 2. Seed the ledger with the current balances (before dropping the old table)
-- We use DO block to prevent errors if the migration is re-run and the table is already dropped.
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sms_credits') THEN
    insert into public.sms_credit_ledger (org_id, amount, transaction_type, created_at)
    select org_id, balance, 'reset', last_reset_at
    from public.sms_credits
    on conflict do nothing;
  END IF;
END $$;

-- 3. Replace the sms_credits table with a View
-- We drop the table and its policies. CASCADE will remove it from any depending functions/views.
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sms_credits') THEN
    drop table public.sms_credits cascade;
  END IF;
END $$;

create or replace view public.sms_credits as
select 
  org_id, 
  coalesce(sum(amount), 0)::int as balance, 
  max(case when transaction_type = 'reset' then created_at end) as last_reset_at
from public.sms_credit_ledger
group by org_id;

-- 4. Re-create the core atomic functions without FOR UPDATE

create or replace function public.deduct_sms_credit(p_org_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  -- Fast read from the view
  select balance into v_balance
  from public.sms_credits
  where org_id = p_org_id;

  if v_balance is null or v_balance <= 0 then
    return false;
  end if;

  -- Append to ledger lock-free
  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, -1, 'deduction');

  return true;
end;
$$;

revoke all on function public.deduct_sms_credit(uuid) from public;
grant all on function public.deduct_sms_credit(uuid) to service_role;

create or replace function public.refund_sms_credit(p_org_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, 1, 'refund');
end;
$$;

revoke all on function public.refund_sms_credit(uuid) from public;
grant all on function public.refund_sms_credit(uuid) to service_role;

create or replace function public.reset_sms_credits(p_org_id uuid, p_credits int)
returns void
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  -- Calculate what adjustment is needed to exactly hit p_credits
  select coalesce(balance, 0) into v_balance
  from public.sms_credits
  where org_id = p_org_id;

  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, p_credits - coalesce(v_balance, 0), 'reset');
end;
$$;

revoke all on function public.reset_sms_credits(uuid, int) from public;
grant all on function public.reset_sms_credits(uuid, int) to service_role;

-- 5. Re-create get_org_billing to use the new view explicitly
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
  from   public.sms_credits c
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
