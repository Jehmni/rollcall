-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Absence Messaging
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS / OR REPLACE.
-- ─────────────────────────────────────────────────────────────────────────────


-- 1. Per-unit messaging settings -------------------------------------------

create table if not exists unit_messaging_settings (
  unit_id          uuid primary key references units(id) on delete cascade,
  enabled          boolean     not null default false,
  -- Template tokens: {{name}} → member name, {{event}} → service_type
  message_template text        not null default 'Hi {{name}}, we missed you at {{event}} today. Hope all is well — we look forward to seeing you next time!',
  -- Hour (0-23) in the unit's local timezone at which auto-messages fire.
  -- Restricted 12-21 to avoid early-morning or late-night sends.
  send_hour        int         not null default 18 check (send_hour >= 12 and send_hour <= 21),
  -- IANA timezone string (e.g. 'Africa/Lagos', 'America/New_York').
  -- Default UTC — must be set to the unit's actual timezone via the settings UI.
  timezone         text        not null default 'UTC',
  updated_at       timestamptz not null default now()
);

alter table unit_messaging_settings enable row level security;

-- Unit managers (creator / org owner) can fully manage settings
drop policy if exists "Unit managers: manage messaging settings" on unit_messaging_settings;
create policy "Unit managers: manage messaging settings"
  on unit_messaging_settings for all
  using (is_unit_manager(unit_id));

-- Unit admins can read settings (to display schedule status in the UI)
drop policy if exists "Unit admins: read messaging settings" on unit_messaging_settings;
create policy "Unit admins: read messaging settings"
  on unit_messaging_settings for select
  using (is_unit_admin(unit_id) or is_unit_manager(unit_id));


-- 2. Absence message delivery log ------------------------------------------

create table if not exists absence_message_log (
  id         uuid        primary key default gen_random_uuid(),
  service_id uuid        not null references services(id) on delete cascade,
  member_id  uuid        not null references members(id) on delete cascade,
  phone      text        not null,
  message    text        not null,
  -- CRITICAL-5: 'pending' added for the log-first atomic pattern.
  -- The Edge Function inserts 'pending' BEFORE sending SMS so that concurrent
  -- invocations cannot both claim the same (service_id, member_id) row.
  -- Flow: INSERT pending → send SMS → UPDATE to sent/failed.
  -- HIGH-11: status and error_text are always set — never left null.
  status     text        not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_text text        not null default '',
  sent_at    timestamptz not null default now(),
  -- Atomic uniqueness: only one process can ever INSERT for a given member+service.
  unique(service_id, member_id)
);

alter table absence_message_log enable row level security;

-- Org admins can read message log for their units
drop policy if exists "Org admins: read message log" on absence_message_log;
create policy "Org admins: read message log"
  on absence_message_log for select
  using (is_org_admin_by_service(service_id));

-- HIGH-12: Unit managers also need to read the delivery log to operate the
-- messaging feature they configure. Previously only org admins could read it.
drop policy if exists "Unit managers: read message log" on absence_message_log;
create policy "Unit managers: read message log"
  on absence_message_log for select
  using (
    exists (
      select 1 from services s
      join units u on u.id = s.unit_id
      where s.id = absence_message_log.service_id
        and is_unit_manager(u.id)
    )
  );

-- The Edge Function runs with service-role key and bypasses RLS for inserts/updates.
-- No extra write policy needed.


-- 3. Indexes ---------------------------------------------------------------

create index if not exists idx_msg_log_service on absence_message_log(service_id);
create index if not exists idx_msg_log_member  on absence_message_log(member_id);
-- Descending sent_at index matches the UI query order (most recent first)
create index if not exists idx_msg_log_sent_at on absence_message_log(sent_at desc);


-- 4. updated_at auto-update trigger for unit_messaging_settings ------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_unit_messaging_settings_updated_at on unit_messaging_settings;
create trigger trg_unit_messaging_settings_updated_at
  before update on unit_messaging_settings
  for each row execute function set_updated_at();


-- 5. Automated scheduling via pg_cron + pg_net -----------------------------
--
-- OPTIONAL: run this block to enable fully-automated sends.
-- pg_cron and pg_net must be enabled (both are on by default in Supabase).
--
-- Replace the two placeholders before running:
--   SUPABASE_PROJECT_URL  → e.g. https://rlqbnohpepimietldrdj.supabase.co
--   SERVICE_ROLE_KEY      → Settings → API Keys → Secret key
--
-- Fires every hour from noon to 9 pm UTC. The Edge Function then applies
-- each unit's own send_hour + timezone to decide whether to actually send.
-- Using UTC 12-21 covers units from UTC-12 to UTC+9 at any hour 12-21 local.
-- For full global coverage (UTC+9 to UTC+12), extend to '0 0-21 * * *'.
--
-- select cron.schedule(
--   'absence-messaging-hourly',
--   '0 0-21 * * *',
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
