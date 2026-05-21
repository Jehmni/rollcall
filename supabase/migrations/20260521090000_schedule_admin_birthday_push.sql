-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Schedule admin birthday push notifications
-- Date: 2026-05-21
--
-- Runs birthday enqueue + admin push fan-out daily. The cron caller uses a
-- database-generated secret stored outside exposed API schemas.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create schema if not exists private;

create table if not exists private.app_secrets (
  key        text primary key,
  secret     text not null,
  created_at timestamptz not null default now()
);

insert into private.app_secrets (key, secret)
values (
  'admin_birthday_push_cron_secret',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (key) do nothing;

create or replace function private.run_admin_birthday_push()
returns bigint
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  request_id bigint;
begin
  perform public.enqueue_birthday_notifications();

  select net.http_post(
    url := 'https://rlqbnohpepimietldrdj.supabase.co/functions/v1/send-admin-birthday-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'cron_secret',
      (select secret from private.app_secrets where key = 'admin_birthday_push_cron_secret')
    ),
    timeout_milliseconds := 30000
  )
  into request_id;

  return request_id;
end;
$$;

do $$
begin
  perform cron.unschedule('admin-birthday-push-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'admin-birthday-push-daily',
  '5 9 * * *',
  'select private.run_admin_birthday_push();'
);
