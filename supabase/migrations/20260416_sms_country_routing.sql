-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: SMS country routing
-- Safe to re-run — all DDL uses IF NOT EXISTS / ON CONFLICT DO NOTHING guards.
--
-- Adds:
--   sms_countries  — lookup table mapping country codes to SMS providers.
--                    New countries are added by inserting a row here.
--                    No code deploy is required to activate a new country.
--
--   unit_messaging_settings.sms_country_code  — FK to sms_countries(code).
--     NULL  = use platform default (Twilio).
--     Set   = route sends through the provider assigned to that country.
--
-- Phase 1 providers:
--   termii         — Nigeria. DND-compliant routes, no 2-week carrier
--                    registration required. ~$0.011/SMS.
--   africastalking — East/Central/Southern Africa. Direct carrier connections;
--                    10×–80× cheaper than Twilio in most markets. ~$0.003–0.010/SMS.
--   twilio         — Europe, Americas, Oceania. Global coverage fallback.
--
-- Switching Nigeria to Africa's Talking (cheaper, ~$0.003–0.006):
--   UPDATE public.sms_countries SET provider = 'africastalking' WHERE code = 'NG';
--   Requires prior DND sender-ID registration with all four Nigerian carriers
--   (MTN, Airtel, Glo, 9Mobile) — a 2-week process done at platform level.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. sms_countries lookup table ───────────────────────────────────────────────

create table if not exists public.sms_countries (
  code     text    primary key,           -- ISO 3166-1 alpha-2 (e.g. 'NG', 'GB')
  name     text    not null,              -- Display name for the UI dropdown
  provider text    not null,              -- 'twilio' | 'africastalking' | 'termii'
  flag     text,                          -- Emoji flag shown in the dropdown
  active   boolean not null default true  -- false = hidden from UI; existing FK refs intact
);

-- 2. Seed Phase 1 countries ───────────────────────────────────────────────────
-- To add a country after this migration: INSERT a row with active = true.
-- To switch a country's provider: UPDATE provider WHERE code = '...'.
-- Neither action requires a code deploy.

insert into public.sms_countries (code, name, provider, flag) values
  -- Africa — Africa's Talking (direct carrier connections, cheapest)
  ('KE', 'Kenya',           'africastalking', '🇰🇪'),
  ('GH', 'Ghana',           'africastalking', '🇬🇭'),
  ('UG', 'Uganda',          'africastalking', '🇺🇬'),
  ('TZ', 'Tanzania',        'africastalking', '🇹🇿'),
  ('ZA', 'South Africa',    'africastalking', '🇿🇦'),
  ('RW', 'Rwanda',          'africastalking', '🇷🇼'),
  ('ZM', 'Zambia',          'africastalking', '🇿🇲'),
  ('ET', 'Ethiopia',        'africastalking', '🇪🇹'),
  -- Nigeria — Termii (DND-compliant, no registration wait)
  ('NG', 'Nigeria',         'termii',         '🇳🇬'),
  -- Europe — Twilio
  ('GB', 'United Kingdom',  'twilio',         '🇬🇧'),
  ('DE', 'Germany',         'twilio',         '🇩🇪'),
  ('FR', 'France',          'twilio',         '🇫🇷'),
  ('NL', 'Netherlands',     'twilio',         '🇳🇱'),
  ('IE', 'Ireland',         'twilio',         '🇮🇪'),
  -- Americas — Twilio
  ('US', 'United States',   'twilio',         '🇺🇸'),
  ('CA', 'Canada',          'twilio',         '🇨🇦'),
  -- Oceania — Twilio
  ('AU', 'Australia',       'twilio',         '🇦🇺')
on conflict (code) do nothing;

-- 3. RLS — active countries are public (not sensitive; needed for UI dropdown) ─

alter table public.sms_countries enable row level security;

drop policy if exists "Public: read active sms_countries" on public.sms_countries;
create policy "Public: read active sms_countries"
  on public.sms_countries for select
  using (active = true);

-- 4. Add FK column to unit_messaging_settings ─────────────────────────────────
-- Nullable: existing units are unaffected and continue using the Twilio fallback.

alter table public.unit_messaging_settings
  add column if not exists sms_country_code text
    references public.sms_countries(code);

comment on column public.unit_messaging_settings.sms_country_code is
  'ISO 3166-1 alpha-2 country code for this unit. '
  'Routes SMS sends through the cheapest/most reliable provider for that country. '
  'NULL = platform default (Twilio). '
  'Changing this field takes effect on the next send — no redeployment needed.';
