-- Add missing location columns to units table.
-- The checkin_by_id function selects latitude, longitude, radius_meters from units
-- for the geo-fencing check, but these columns were never added to the live table.

alter table units
  add column if not exists latitude      numeric,
  add column if not exists longitude     numeric,
  add column if not exists radius_meters int default 100;
