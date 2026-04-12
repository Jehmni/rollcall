-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: location improvements
-- • Adds venue_name + address columns to units (human-readable label + formatted address)
-- • Adds meeting-level venue override columns to services
--   (if set, these take precedence over the unit defaults in check-in validation)
-- • Rewrites checkin_by_id() to apply meeting → unit location precedence
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. units: human-readable venue label and stored address string
alter table units
  add column if not exists venue_name text,
  add column if not exists address    text;

-- 2. services: per-meeting venue override (all nullable; null = use unit default)
alter table services
  add column if not exists venue_name           text,
  add column if not exists venue_address        text,
  add column if not exists venue_lat            numeric,
  add column if not exists venue_lng            numeric,
  add column if not exists venue_radius_meters  int;

-- 3. Rewrite checkin_by_id to prefer meeting-level location over unit default
create or replace function public.checkin_by_id(
  p_member_id  uuid,
  p_service_id uuid,
  p_device_id  text    default null,
  p_lat        numeric default null,
  p_lng        numeric default null
)
returns json language plpgsql security definer as $$
declare
  v_member       members;
  v_service      services;
  v_unit_lat     numeric;
  v_unit_lng     numeric;
  v_unit_radius  int;
  v_unit_vname   text;
  v_eff_lat      numeric;   -- effective venue latitude
  v_eff_lng      numeric;   -- effective venue longitude
  v_eff_radius   int;       -- effective check-in radius (metres)
  v_eff_name     text;      -- effective venue name (for error messages)
  v_existing     attendance;
  v_dist         float;
begin
  -- 1. Validate service exists
  select * into v_service
  from services
  where id = p_service_id;

  if not found then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  -- 2. Resolve effective venue:
  --    Use service-level override when both lat+lng are present,
  --    otherwise fall back to unit-level defaults.
  if v_service.venue_lat is not null and v_service.venue_lng is not null then
    v_eff_lat    := v_service.venue_lat;
    v_eff_lng    := v_service.venue_lng;
    v_eff_radius := coalesce(v_service.venue_radius_meters, 100);
    v_eff_name   := v_service.venue_name;
  else
    select latitude, longitude, radius_meters, venue_name
      into v_unit_lat, v_unit_lng, v_unit_radius, v_unit_vname
      from units
     where id = v_service.unit_id;

    v_eff_lat    := v_unit_lat;
    v_eff_lng    := v_unit_lng;
    v_eff_radius := coalesce(v_unit_radius, 100);
    v_eff_name   := v_unit_vname;
  end if;

  -- 3. Location check — only when service.require_location = true AND venue coords are set
  if v_service.require_location = true and v_eff_lat is not null and v_eff_lng is not null then
    if p_lat is null or p_lng is null then
      -- Member's coordinates were not supplied; permission was likely denied
      return json_build_object(
        'success', false,
        'error', 'location_required',
        'venue_name', v_eff_name
      );
    end if;

    -- Haversine approximation (sufficient for geofence radii up to a few km)
    v_dist := 111320 * sqrt(
      pow(p_lat - v_eff_lat, 2) +
      pow(cos(v_eff_lat * pi() / 180) * (p_lng - v_eff_lng), 2)
    );

    if v_dist > v_eff_radius then
      return json_build_object(
        'success',    false,
        'error',      'too_far',
        'distance',   floor(v_dist),
        'radius',     v_eff_radius,
        'venue_name', v_eff_name
      );
    end if;
  end if;

  -- 4. Validate member belongs to this unit and is active
  select * into v_member
  from members
  where id = p_member_id
    and unit_id = v_service.unit_id
    and status = 'active';

  if not found then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  -- 5. Prevent double check-ins
  select * into v_existing
  from attendance
  where service_id = p_service_id and member_id = p_member_id;

  if found then
    return json_build_object(
      'success', false, 'error', 'already_checked_in', 'name', v_member.name
    );
  end if;

  -- 6. Device locking: one device per member per service
  if p_device_id is not null then
    if exists (
      select 1 from attendance
      where service_id = p_service_id
        and device_id  = p_device_id
        and member_id != p_member_id
    ) then
      return json_build_object('success', false, 'error', 'device_locked');
    end if;
  end if;

  -- 7. Record attendance
  insert into attendance (service_id, member_id, checked_in, checkin_time, device_id, latitude, longitude)
  values (p_service_id, p_member_id, true, now(), p_device_id, p_lat, p_lng);

  return json_build_object('success', true, 'name', v_member.name);
end;
$$;

-- Re-grant (signature unchanged)
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to anon;
grant execute on function public.checkin_by_id(uuid, uuid, text, numeric, numeric) to authenticated;
