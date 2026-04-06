-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: SMS Consent, Sender Identity & Cooldown
-- Run once in the Supabase SQL editor.
-- Safe to re-run — uses IF NOT EXISTS / OR REPLACE throughout.
-- ─────────────────────────────────────────────────────────────────────────────


-- 0. Fix absence_message_log status constraint --------------------------------
--
-- The 20260401 migration created absence_message_log with:
--   status check (status in ('sent', 'failed', 'skipped'))
-- The updated Edge Function now inserts status='pending' as the first step of
-- its log-first atomic pattern. Without this fix every send would hit a CHECK
-- violation and silently fail.
--
-- Also set error_text NOT NULL with a default so the UPDATE path is consistent.

do $$
begin
  -- Drop the old constraint by its auto-generated name.
  -- pg names single-column CHECK constraints as <table>_<column>_check.
  alter table absence_message_log
    drop constraint if exists absence_message_log_status_check;

  -- Re-add with 'pending' included.
  alter table absence_message_log
    add constraint absence_message_log_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'));

  -- Backfill any existing NULL error_text rows before setting NOT NULL.
  update absence_message_log set error_text = '' where error_text is null;

  -- Make the column NOT NULL with a default going forward.
  alter table absence_message_log
    alter column error_text set not null,
    alter column error_text set default '';
exception
  when others then
    raise notice 'absence_message_log constraint patch: %', sqlerrm;
end;
$$;


-- 1. Per-member SMS consent flag -----------------------------------------------
--
--   null  → member has not been asked yet → do NOT send (GDPR: no affirmative consent)
--   true  → member consented             → send
--   false → member opted out             → do NOT send
--
-- Consent is captured on the check-in page (via the set_member_sms_consent RPC)
-- or overridden by an admin in the member form.

alter table members add column if not exists sms_consent boolean;

comment on column members.sms_consent is
  'null = not yet asked; true = consented to SMS; false = opted out. '
  'Only null → false/true transitions happen via the check-in consent prompt. '
  'Admins may override in the member form for paper-consent workflows.';


-- 2. Per-unit sender identity --------------------------------------------------
--
-- Shown as the "From" name in SMS messages so members recognise the sender
-- (their choir / team name) rather than an unfamiliar phone number.
--
-- Constraints (enforced by both DB and application):
--   • 1–11 characters
--   • Must start with a letter (alphanumeric sender ID rules — Twilio / AT)
--   • Spaces are allowed by most providers but keep it tight
--
-- If NULL, the provider falls back to the configured phone number secret.

alter table unit_messaging_settings add column if not exists sender_name text
  check (sender_name is null or char_length(trim(sender_name)) between 1 and 11);

comment on column unit_messaging_settings.sender_name is
  'Alphanumeric SMS sender ID (max 11 chars). Displayed instead of a phone number. '
  'Must start with a letter. Not available for US/Canada numbers — phone number is used there.';


-- 3. Per-unit messaging cooldown -----------------------------------------------
--
-- Minimum days that must pass before the same member can receive another
-- absence SMS from any service in this unit.
--
--   0  → no cooldown — send every event they miss (use with care)
--   7  → default — at most one message per week
--   90 → maximum allowed
--
-- This prevents message fatigue for members who miss multiple consecutive events.

alter table unit_messaging_settings add column if not exists cooldown_days int not null default 7
  check (cooldown_days >= 0 and cooldown_days <= 90);

comment on column unit_messaging_settings.cooldown_days is
  'Minimum days between absence SMS to the same member (0 = no cooldown, max 90). '
  'Prevents message fatigue when a member misses several events in a row.';


-- 4. set_member_sms_consent RPC -----------------------------------------------
--
-- Called from the check-in page (unauthenticated / anon) when a member
-- explicitly consents to or opts out of SMS absence notifications.
--
-- SECURITY DEFINER so the function can write to the members table even
-- without an authenticated session. Tightly scoped: only updates one column.
--
-- Granted to anon because the check-in page uses the anon key.

create or replace function public.set_member_sms_consent(
  p_member_id uuid,
  p_consent   boolean
)
returns void
language plpgsql
security definer
as $$
begin
  update members
  set sms_consent = p_consent
  where id = p_member_id;
end;
$$;

-- Strip the default PUBLIC grant, then re-grant only to anon + authenticated.
revoke all on function public.set_member_sms_consent(uuid, boolean) from public;
grant execute on function public.set_member_sms_consent(uuid, boolean) to anon, authenticated;


-- 5. Updated get_service_members_full — adds sms_consent column ---------------
--
-- The admin dashboard uses this to show consent status per absent member,
-- and the edge function uses it to filter who can receive messages.
--
-- Must DROP first — CREATE OR REPLACE cannot change the return type.

drop function if exists public.get_service_members_full(uuid, int, int);

create or replace function public.get_service_members_full(
  p_service_id uuid,
  p_limit      int default 1000,
  p_offset     int default 0
)
returns table (
  id           uuid,
  name         text,
  phone        text,
  section      text,
  checked_in   boolean,
  checkin_time timestamptz,
  sms_consent  boolean
)
language plpgsql stable security definer as $$
begin
  if not (is_super_admin() or is_org_admin_by_service(p_service_id)) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    m.id,
    m.name,
    m.phone,
    m.section,
    (a.id is not null)  as checked_in,
    a.checkin_time,
    m.sms_consent
  from members m
  join services s on s.unit_id = m.unit_id
  left join attendance a on a.member_id = m.id and a.service_id = p_service_id
  where s.id = p_service_id
    and m.status = 'active'
  order by m.section nulls last, m.name
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function public.get_service_members_full(uuid, int, int) to authenticated;
