-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: absence_message_log housekeeping
-- Safe to re-run — all DDL uses IF NOT EXISTS / IF EXISTS guards.
--
-- Adds two columns:
--
--   created_at  timestamptz  — true row-creation timestamp.
--               The original table used sent_at (defaulting to INSERT time) for
--               both display ordering and the stale-pending TTL check.  That was
--               semantically muddy because sent_at implies the message was sent.
--               created_at is the correct anchor for "when did this row appear?"
--               sent_at continues to exist as the displayed delivery timestamp.
--               Existing rows are backfilled with their sent_at value as the best
--               available approximation of creation time.
--
--   reason_code text         — machine-readable failure classification.
--               NULL for normal sent/failed rows.
--               'stale_pending_recovered'  — row was stuck in pending for longer
--                 than the TTL (function crashed before completing the send).
--                 The status is set to 'failed' but the member may or may not have
--                 received the SMS — admins should verify via the provider dashboard
--                 and manually re-send if needed.
--               Additional reason codes can be added in future migrations without
--               changing the status enum.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add created_at (NOT NULL, defaults to now() for future inserts) -----------
alter table public.absence_message_log
  add column if not exists created_at timestamptz not null default now();

-- Backfill existing rows: use sent_at as the best available proxy.
-- Rows inserted after this migration get a true created_at from the INSERT.
update public.absence_message_log
  set created_at = sent_at
  where created_at > sent_at;   -- only rows where the default (migration time) > sent_at

-- 2. Add reason_code (nullable text) ------------------------------------------
alter table public.absence_message_log
  add column if not exists reason_code text;

comment on column public.absence_message_log.reason_code is
  'Machine-readable failure reason. NULL = normal outcome. '
  '''stale_pending_recovered'' = pending row expired (crash before send); '
  'status set to failed; member may or may not have received the SMS.';

-- 3. Index for TTL queries (stale-pending detection uses created_at) ----------
create index if not exists idx_msg_log_created_at
  on public.absence_message_log(created_at);
