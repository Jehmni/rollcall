-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Absence Messaging
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Per-unit messaging settings -----------------------------------------

create table if not exists unit_messaging_settings (
  unit_id          uuid primary key references units(id) on delete cascade,
  enabled          boolean     not null default false,
  -- Template tokens: {{name}} → member name, {{event}} → service_type
  message_template text        not null default 'Hi {{name}}, we missed you at {{event}} today. Hope all is well — we look forward to seeing you next time! 🙏',
  -- Hour (0-23) in the unit's local timezone at which auto-messages fire.
  -- Restricted 12-21 to avoid early-morning or late-night sends.
  send_hour        int         not null default 18 check (send_hour >= 12 and send_hour <= 21),
  timezone         text        not null default 'Africa/Lagos',
  updated_at       timestamptz not null default now()
);

alter table unit_messaging_settings enable row level security;

-- Only unit managers (creator / org owner) can change settings
drop policy if exists "Unit managers: manage messaging settings" on unit_messaging_settings;
create policy "Unit managers: manage messaging settings"
  on unit_messaging_settings for all
  using (is_unit_manager(unit_id));

-- Unit admins can read settings (to show status in UI)
drop policy if exists "Unit admins: read messaging settings" on unit_messaging_settings;
create policy "Unit admins: read messaging settings"
  on unit_messaging_settings for select
  using (is_unit_admin(unit_id) or is_unit_manager(unit_id));


-- 2. Absence message delivery log ----------------------------------------

create table if not exists absence_message_log (
  id         uuid        primary key default gen_random_uuid(),
  service_id uuid        not null references services(id) on delete cascade,
  member_id  uuid        not null references members(id) on delete cascade,
  phone      text        not null,
  message    text        not null,
  status     text        not null check (status in ('sent', 'failed', 'skipped')),
  error_text text,
  sent_at    timestamptz not null default now(),
  -- Prevents re-sending to the same member for the same service
  unique(service_id, member_id)
);

alter table absence_message_log enable row level security;

-- Org admins can read their unit's message log
drop policy if exists "Org admins: read message log" on absence_message_log;
create policy "Org admins: read message log"
  on absence_message_log for select
  using (is_org_admin_by_service(service_id));

-- The Edge Function runs with service-role key and bypasses RLS for inserts.
-- No extra insert policy needed.


-- 3. Indexes ---------------------------------------------------------------

create index if not exists idx_msg_log_service on absence_message_log(service_id);
create index if not exists idx_msg_log_member  on absence_message_log(member_id);


-- 4. Automated scheduling via pg_cron + pg_net ----------------------------
--
-- OPTIONAL: run this block to enable fully-automated sends.
-- pg_cron and pg_net must be enabled (both are on by default in Supabase).
--
-- Replace the two placeholders before running:
--   SUPABASE_PROJECT_URL  → e.g. https://rlqbnohpepimietldrdj.supabase.co
--   SERVICE_ROLE_KEY      → Settings → API Keys → Secret key
--
-- This fires every hour from noon to 9 pm UTC. The Edge Function then applies
-- each unit's own send_hour + timezone to decide whether to actually send.
--
-- select cron.schedule(
--   'absence-messaging-hourly',
--   '0 12-21 * * *',
--   $$
--     select net.http_post(
--       url     := 'SUPABASE_PROJECT_URL/functions/v1/send-absence-sms',
--       headers := jsonb_build_object(
--                    'Content-Type',  'application/json',
--                    'Authorization', 'Bearer SERVICE_ROLE_KEY'
--                  ),
--       body    := '{"scheduled":true}'
--     );
--   $$
-- );
--
-- To remove the job later:
--   select cron.unschedule('absence-messaging-hourly');
