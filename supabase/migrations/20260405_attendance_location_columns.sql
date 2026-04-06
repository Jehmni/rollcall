-- Add missing latitude/longitude columns to attendance table.
-- The checkin_by_id function references these columns but they were never
-- added via a migration, causing "column latitude does not exist" errors
-- during the QR code check-in flow.

alter table attendance
  add column if not exists latitude  numeric,
  add column if not exists longitude numeric;
