-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Admin Audit Logs
-- Creates an immutable log table for destructive or privileged operations.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the admin_audit_log table
create table if not exists public.admin_audit_log (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid, -- ID of the admin who performed the action (null if system/dashboard)
    action text not null, -- e.g., 'DELETE_ORGANIZATION', 'UPDATE_BILLING_CREDITS'
    target_type text not null, -- e.g., 'organization', 'sms_credit', 'unit'
    target_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.admin_audit_log enable row level security;

-- Super admins can view all audit logs
create policy "Super admins can view audit logs"
    on public.admin_audit_log
    for select
    using (is_super_admin());

-- Enforce immutability strictly via a trigger
create or replace function public.prevent_audit_log_modification()
returns trigger language plpgsql as $$
begin
    raise exception 'Audit log records cannot be modified or deleted.';
end;
$$;

drop trigger if exists prevent_audit_log_update on public.admin_audit_log;
create trigger prevent_audit_log_update
    before update on public.admin_audit_log
    for each row execute function public.prevent_audit_log_modification();

drop trigger if exists prevent_audit_log_delete on public.admin_audit_log;
create trigger prevent_audit_log_delete
    before delete on public.admin_audit_log
    for each row execute function public.prevent_audit_log_modification();

-- 3. Trigger: Delete Organization
create or replace function public.log_organization_delete()
returns trigger language plpgsql security definer as $$
begin
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, old_data)
    values (
        auth.uid(),
        'DELETE_ORGANIZATION',
        'organization',
        OLD.id,
        row_to_json(OLD)::jsonb
    );
    return OLD;
end;
$$;

drop trigger if exists audit_organization_delete on public.organizations;
create trigger audit_organization_delete
    after delete on public.organizations
    for each row execute function public.log_organization_delete();

-- 4. Trigger: Delete Unit
create or replace function public.log_unit_delete()
returns trigger language plpgsql security definer as $$
begin
    insert into public.admin_audit_log (admin_id, action, target_type, target_id, old_data)
    values (
        auth.uid(),
        'DELETE_UNIT',
        'unit',
        OLD.id,
        row_to_json(OLD)::jsonb
    );
    return OLD;
end;
$$;

drop trigger if exists audit_unit_delete on public.units;
create trigger audit_unit_delete
    after delete on public.units
    for each row execute function public.log_unit_delete();

-- 5. Trigger: Update SMS Credits (manual adjustments, not normal deductions)
create or replace function public.log_sms_credits_update()
returns trigger language plpgsql security definer as $$
begin
    -- Don't log normal deductions (balance goes down by 1)
    -- This filters out the high-volume `deduct_sms_credit` calls.
    if OLD.balance is not null and NEW.balance = (OLD.balance - 1) then
        return NEW;
    end if;

    insert into public.admin_audit_log (admin_id, action, target_type, target_id, old_data, new_data)
    values (
        auth.uid(),
        'UPDATE_SMS_CREDITS',
        'sms_credit',
        NEW.org_id,
        row_to_json(OLD)::jsonb,
        row_to_json(NEW)::jsonb
    );
    
    return NEW;
end;
$$;

drop trigger if exists audit_sms_credits_update on public.sms_credits;
create trigger audit_sms_credits_update
    after update on public.sms_credits
    for each row
    when (OLD.balance IS DISTINCT FROM NEW.balance)
    execute function public.log_sms_credits_update();
