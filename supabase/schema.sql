


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_unit_admin_by_email"("p_unit_id" "uuid", "p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id uuid;
begin
  if not (is_super_admin() or is_org_owner_by_unit(p_unit_id)) then
    raise exception 'Unauthorized';
  end if;

  select id into v_user_id
  from auth.users
  where email = lower(p_email)
  limit 1;

  if v_user_id is null then
    return json_build_object(
      'status', 'not_found',
      'message', 'No user found with that email. They must create an account first.'
    );
  end if;

  insert into unit_admins (unit_id, user_id)
  values (p_unit_id, v_user_id)
  on conflict (unit_id, user_id) do nothing;

  return json_build_object('status', 'success', 'user_id', v_user_id);
end;
$$;


ALTER FUNCTION "public"."add_unit_admin_by_email"("p_unit_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_org_admin"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM units u
    JOIN unit_admins ua ON ua.unit_id = u.id
    WHERE u.org_id = p_org_id AND ua.user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."check_is_org_admin"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_org_owner"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = p_org_id AND owner_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."check_is_org_owner"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_member   members;
  v_service  services;
  v_existing attendance;
begin
  -- Validate service exists
  select * into v_service from services where id = p_service_id;
  if not found then
    return json_build_object('status', 'invalid_service');
  end if;

  -- Validate member exists and belongs to that service's unit
  select * into v_member
  from members
  where id = p_member_id
    and unit_id = v_service.unit_id
    and status = 'active';

  if not found then
    return json_build_object('status', 'not_found');
  end if;

  -- Check if already checked in
  select * into v_existing
  from attendance
  where service_id = p_service_id and member_id = p_member_id;

  if found then
    return json_build_object('status', 'already_checked_in', 'name', v_member.name);
  end if;

  -- Insert attendance record
  insert into attendance (service_id, member_id, checked_in, checkin_time)
  values (p_service_id, p_member_id, true, now());

  return json_build_object('status', 'success', 'name', v_member.name);
end;
$$;


ALTER FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid", "p_device_id" "text" DEFAULT NULL::"text", "p_lat" numeric DEFAULT NULL::numeric, "p_lng" numeric DEFAULT NULL::numeric) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid", "p_device_id" "text", "p_lat" numeric, "p_lng" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."checkin_by_phone"("p_phone" "text", "p_service_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_chorister_id uuid;
  v_name         text;
begin
  -- Normalize: strip spaces, dashes, parentheses for flexible matching
  select id, name
    into v_chorister_id, v_name
    from public.choristers
   where regexp_replace(phone, '[^0-9+]', '', 'g')
       = regexp_replace(p_phone, '[^0-9+]', '', 'g')
     and status = 'active'
   limit 1;

  if v_chorister_id is null then
    return json_build_object('success', false, 'error', 'not_found');
  end if;

  if not exists (select 1 from public.services where id = p_service_id) then
    return json_build_object('success', false, 'error', 'invalid_service');
  end if;

  begin
    insert into public.attendance (chorister_id, service_id)
    values (v_chorister_id, p_service_id);
    return json_build_object('success', true, 'name', v_name);
  exception when unique_violation then
    return json_build_object('success', false, 'error', 'already_checked_in', 'name', v_name);
  end;
end;
$$;


ALTER FUNCTION "public"."checkin_by_phone"("p_phone" "text", "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_balance int;
begin
  -- Fast read from the view
  select balance into v_balance
  from public.sms_credits
  where org_id = p_org_id;

  if v_balance is null or v_balance <= 0 then
    return false;
  end if;

  -- Append to ledger lock-free
  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, -1, 'deduction');

  return true;
end;
$$;


ALTER FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_birthday_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Birthday Eve: notify the day before the birthday.
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_eve' as type,
    (current_date + interval '1 day' + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date + interval '1 day', 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;

  -- Birthday Day: notify on the birthday itself.
  insert into member_notifications (unit_id, member_id, type, fire_at)
  select
    unit_id,
    id as member_id,
    'birthday_day' as type,
    (current_date + interval '9 hours')::timestamptz
  from members
  where status   = 'active'
    and birthday is not null
    and to_char(birthday, 'MM-DD') = to_char(current_date, 'MM-DD')
  on conflict (member_id, type, fire_at) do nothing;
end;
$$;


ALTER FUNCTION "public"."enqueue_birthday_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_sms_chunk"("p_service_id" "uuid", "p_member_ids" "uuid"[], "p_project_url" "text", "p_service_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  request_body jsonb;
begin
  request_body := jsonb_build_object(
    'service_id', p_service_id,
    'member_ids', p_member_ids
  );

  perform net.http_post(
    url := p_project_url || '/functions/v1/send-absence-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || p_service_role_key
    ),
    body := request_body
  );
end;
$$;


ALTER FUNCTION "public"."enqueue_sms_chunk"("p_service_id" "uuid", "p_member_ids" "uuid"[], "p_project_url" "text", "p_service_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_billing"("p_org_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
declare
  v_sub    jsonb;
  v_credit jsonb;
  v_plan   jsonb;
begin
  if not (is_super_admin() or is_org_owner(p_org_id) or is_org_member(p_org_id)) then
    raise exception 'Unauthorized';
  end if;

  select to_jsonb(s) into v_sub
  from   subscriptions s
  where  s.org_id = p_org_id;

  select to_jsonb(c) into v_credit
  from   public.sms_credits c
  where  c.org_id = p_org_id;

  select to_jsonb(p) into v_plan
  from   pricing_plans p
  where  p.id = coalesce((v_sub->>'plan_id'), 'starter');

  return jsonb_build_object(
    'subscription', v_sub,
    'credits',      v_credit,
    'plan',         v_plan
  );
end;
$$;


ALTER FUNCTION "public"."get_org_billing"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_join_requests"("p_org_id" "uuid") RETURNS TABLE("id" "uuid", "organization_id" "uuid", "admin_id" "uuid", "admin_email" "text", "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select
    jr.id,
    jr.organization_id,
    jr.admin_id,
    u.email as admin_email,
    jr.status,
    jr.created_at
  from join_requests jr
  join auth.users u on u.id = jr.admin_id
  where jr.organization_id = p_org_id
    and jr.status          = 'pending'
    and is_org_owner(p_org_id)   -- silently returns 0 rows for non-owners
  order by jr.created_at desc;
$$;


ALTER FUNCTION "public"."get_org_join_requests"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_notifications"("p_unit_id" "uuid") RETURNS TABLE("id" "uuid", "member_id" "uuid", "member_name" "text", "type" "text", "fire_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  if not (is_unit_admin(p_unit_id) or is_org_owner_by_unit(p_unit_id) or is_super_admin()) then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    n.id,
    n.member_id,
    m.name as member_name,
    n.type,
    n.fire_at
  from member_notifications n
  join members m on m.id = n.member_id
  where n.unit_id    = p_unit_id
    and n.dismissed  = false
    and n.fire_at   <= now()
  order by n.fire_at desc;
end;
$$;


ALTER FUNCTION "public"."get_pending_notifications"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_members"("p_service_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "section" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select m.id, m.name, m.section
  from members m
  join services s on s.unit_id = m.unit_id
  where s.id = p_service_id
    and m.status = 'active'
  order by m.section nulls last, m.name;
$$;


ALTER FUNCTION "public"."get_service_members"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "section" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  -- Enforce privacy: search must be at least 3 characters.
  -- This prevents roster enumeration by anonymous callers.
  if p_search is null or length(trim(p_search)) < 3 then
    return;
  end if;

  return query
  select m.id, m.name, m.section
  from members m
  join services s on s.unit_id = m.unit_id
  where s.id = p_service_id
    and m.status = 'active'
    and (
      m.name    ilike '%' || p_search || '%' or
      m.section ilike '%' || p_search || '%'
    )
  order by m.section nulls last, m.name
  limit 150;
end;
$$;


ALTER FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_members_full"("p_service_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "phone" "text", "section" "text", "checked_in" boolean, "checkin_time" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select
    m.id,
    m.name,
    m.phone,
    m.section,
    (a.id is not null) as checked_in,
    a.checkin_time
  from members m
  join services s on s.unit_id = m.unit_id
  left join attendance a on a.member_id = m.id and a.service_id = p_service_id
  where s.id = p_service_id
    and m.status = 'active'
  order by m.section nulls last, m.name;
$$;


ALTER FUNCTION "public"."get_service_members_full"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_service_members_full"("p_service_id" "uuid", "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "name" "text", "phone" "text", "section" "text", "checked_in" boolean, "checkin_time" timestamp with time zone, "sms_consent" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."get_service_members_full"("p_service_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_join_request_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into organization_members (organization_id, admin_id, role)
    values (new.organization_id, new.admin_id, 'member')
    on conflict do nothing;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_join_request_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_organization"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into organization_members (organization_id, admin_id, role)
  values (new.id, new.created_by_admin_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_organization"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_unit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_org_owner_id uuid;
begin
  select created_by_admin_id
    into v_org_owner_id
    from organizations
   where id = new.org_id;

  -- Give the org owner direct access to every unit in their org.
  if v_org_owner_id is not null then
    insert into unit_admins (unit_id, user_id)
    values (new.id, v_org_owner_id)
    on conflict do nothing;
  end if;

  -- Also give the unit creator direct access when they differ from the owner
  -- (i.e. a member-admin created the unit inside an org they joined).
  if new.created_by_admin_id is not null
     and new.created_by_admin_id is distinct from v_org_owner_id
  then
    insert into unit_admins (unit_id, user_id)
    values (new.id, new.created_by_admin_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_unit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false);
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_admin_by_service"("p_service_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from organization_members om
    join units u on u.org_id = om.organization_id
    join services s on s.unit_id = u.id
    where s.id = p_service_id
      and om.admin_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_admin_by_service"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_member"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_org_member"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_owner"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org_id
      and admin_id = auth.uid()
      and role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_org_owner"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_owner_by_unit"("p_unit_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from organization_members om
    join units u on u.org_id = om.organization_id
    where u.id = p_unit_id
      and om.admin_id = auth.uid()
      and om.role = 'owner'
  );
$$;


ALTER FUNCTION "public"."is_org_owner_by_unit"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.super_admins
    where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_unit_admin"("p_unit_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from unit_admins
    where unit_id = p_unit_id
      and user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_unit_admin"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_unit_manager"("p_unit_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from units
    where id = p_unit_id
      and (created_by_admin_id = auth.uid() or is_org_owner_by_unit(p_unit_id))
  );
$$;


ALTER FUNCTION "public"."is_unit_manager"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_admin_users"() RETURNS TABLE("user_id" "uuid", "email" "text", "created_at" timestamp with time zone, "org_name" "text", "blocked" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  if not is_super_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select distinct
    u.id                        as user_id,
    u.email                     as email,
    u.created_at                as created_at,
    coalesce(
      (select o.name from public.organization_members om
       join public.organizations o on o.id = om.organization_id
       where om.admin_id = u.id limit 1),
      (select o.name from public.unit_admins ua
       join public.units ut on ut.id = ua.unit_id
       join public.organizations o on o.id = ut.org_id
       where ua.user_id = u.id limit 1)
    )                           as org_name,
    exists(select 1 from public.blocked_admins ba where ba.user_id = u.id) as blocked
  from auth.users u
  where
    exists(select 1 from public.organization_members om where om.admin_id = u.id)
    or exists(select 1 from public.unit_admins ua where ua.user_id = u.id)
  order by u.created_at desc;
end;
$$;


ALTER FUNCTION "public"."list_admin_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_organization_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."log_organization_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_sms_credits_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."log_sms_credits_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_unit_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."log_unit_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_chorister_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select id from public.choristers where email = (auth.jwt() ->> 'email') limit 1;
$$;


ALTER FUNCTION "public"."my_chorister_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_audit_log_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    raise exception 'Audit log records cannot be modified or deleted.';
end;
$$;


ALTER FUNCTION "public"."prevent_audit_log_modification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, 1, 'refund');
end;
$$;


ALTER FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_balance int;
begin
  -- Calculate what adjustment is needed to exactly hit p_credits
  select coalesce(balance, 0) into v_balance
  from public.sms_credits
  where org_id = p_org_id;

  insert into public.sms_credit_ledger (org_id, amount, transaction_type)
  values (p_org_id, p_credits - coalesce(v_balance, 0), 'reset');
end;
$$;


ALTER FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update members
  set sms_consent = p_consent
  where id = p_member_id;
end;
$$;


ALTER FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if p_service_id is null then
    raise exception 'service_id_required';
  end if;

  if not exists (
    select 1
    from attendance a
    join services s on s.id = a.service_id
    join members m  on m.id = a.member_id
    where a.service_id = p_service_id
      and a.member_id  = p_member_id
      and m.status     = 'active'
      and m.unit_id    = s.unit_id
  ) then
    raise exception 'unauthorized_member_service_pair';
  end if;

  update members
  set sms_consent = p_consent
  where id = p_member_id;
end;
$$;


ALTER FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."absence_message_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_text" "text" DEFAULT ''::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason_code" "text",
    CONSTRAINT "absence_message_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."absence_message_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."absence_message_log"."reason_code" IS 'Machine-readable failure reason. NULL = normal outcome. ''stale_pending_recovered'' = pending row expired (crash before send); status set to failed; member may or may not have received the SMS.';



CREATE TABLE IF NOT EXISTS "public"."admin_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "checked_in" boolean DEFAULT true NOT NULL,
    "checkin_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "device_id" "text"
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blocked_admins" (
    "user_id" "uuid" NOT NULL,
    "reason" "text",
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blocked_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "fire_at" timestamp with time zone NOT NULL,
    "dismissed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "member_notifications_type_check" CHECK (("type" = ANY (ARRAY['birthday_eve'::"text", 'birthday_day'::"text"])))
);


ALTER TABLE "public"."member_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."member_push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "section" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "birthday" "date",
    "sms_consent" boolean,
    CONSTRAINT "members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."members"."sms_consent" IS 'null = not yet asked; true = consented to SMS; false = opted out. Only null → false/true transitions happen via the check-in consent prompt. Admins may override in the member form for paper-consent workflows.';



CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_admin_id" "uuid" DEFAULT "auth"."uid"(),
    "blocked_at" timestamp with time zone
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_plans" (
    "id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "price_usd_cents" integer NOT NULL,
    "credits_included" integer NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."pricing_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "service_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notification_sent_at" timestamp with time zone,
    "require_location" boolean DEFAULT false NOT NULL,
    "venue_name" "text",
    "venue_address" "text",
    "venue_lat" numeric,
    "venue_lng" numeric,
    "venue_radius_meters" integer
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_countries" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "flag" "text",
    "active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."sms_countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_credit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sms_credit_ledger" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."sms_credits" AS
 SELECT "org_id",
    (COALESCE("sum"("amount"), (0)::bigint))::integer AS "balance",
    "max"(
        CASE
            WHEN ("transaction_type" = 'reset'::"text") THEN "created_at"
            ELSE NULL::timestamp with time zone
        END) AS "last_reset_at"
   FROM "public"."sms_credit_ledger"
  GROUP BY "org_id";


ALTER VIEW "public"."sms_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "plan_id" "text" DEFAULT 'starter'::"text" NOT NULL,
    "status" "text" DEFAULT 'incomplete'::"text" NOT NULL,
    "credits_included" integer DEFAULT 250 NOT NULL,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'incomplete'::"text", 'incomplete_expired'::"text", 'unpaid'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."super_admins" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."super_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."unit_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_messaging_settings" (
    "unit_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "message_template" "text" DEFAULT 'Hi {{name}}, we missed you at {{event}} today. Hope all is well — we look forward to seeing you next time!'::"text" NOT NULL,
    "send_hour" integer DEFAULT 18 NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sender_name" "text",
    "cooldown_days" integer DEFAULT 7 NOT NULL,
    "sms_country_code" "text",
    CONSTRAINT "unit_messaging_settings_cooldown_days_check" CHECK ((("cooldown_days" >= 0) AND ("cooldown_days" <= 90))),
    CONSTRAINT "unit_messaging_settings_send_hour_check" CHECK ((("send_hour" >= 12) AND ("send_hour" <= 21))),
    CONSTRAINT "unit_messaging_settings_sender_name_check" CHECK ((("sender_name" IS NULL) OR (("char_length"(TRIM(BOTH FROM "sender_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "sender_name")) <= 11))))
);


ALTER TABLE "public"."unit_messaging_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."unit_messaging_settings"."sender_name" IS 'Alphanumeric SMS sender ID (max 11 chars). Displayed instead of a phone number. Must start with a letter. Not available for US/Canada numbers — phone number is used there.';



COMMENT ON COLUMN "public"."unit_messaging_settings"."cooldown_days" IS 'Minimum days between absence SMS to the same member (0 = no cooldown, max 90). Prevents message fatigue when a member misses several events in a row.';



COMMENT ON COLUMN "public"."unit_messaging_settings"."sms_country_code" IS 'ISO 3166-1 alpha-2 country code for this unit. Routes SMS sends through the cheapest/most reliable provider for that country. NULL = platform default (Twilio). Changing this field takes effect on the next send — no redeployment needed.';



CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by_admin_id" "uuid" NOT NULL,
    "latitude" numeric,
    "longitude" numeric,
    "radius_meters" integer DEFAULT 100,
    "venue_name" "text",
    "address" "text"
);


ALTER TABLE "public"."units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "service_id" "uuid",
    "member_id" "uuid",
    "event_type" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."absence_message_log"
    ADD CONSTRAINT "absence_message_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."absence_message_log"
    ADD CONSTRAINT "absence_message_log_service_id_member_id_key" UNIQUE ("service_id", "member_id");



ALTER TABLE ONLY "public"."admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_service_id_member_id_key" UNIQUE ("service_id", "member_id");



ALTER TABLE ONLY "public"."blocked_admins"
    ADD CONSTRAINT "blocked_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_organization_id_admin_id_key" UNIQUE ("organization_id", "admin_id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_notifications"
    ADD CONSTRAINT "member_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_push_subscriptions"
    ADD CONSTRAINT "member_push_subscriptions_member_id_endpoint_key" UNIQUE ("member_id", "endpoint");



ALTER TABLE ONLY "public"."member_push_subscriptions"
    ADD CONSTRAINT "member_push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_admin_id_key" UNIQUE ("organization_id", "admin_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_plans"
    ADD CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_unit_id_date_service_type_key" UNIQUE ("unit_id", "date", "service_type");



ALTER TABLE ONLY "public"."sms_countries"
    ADD CONSTRAINT "sms_countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."sms_credit_ledger"
    ADD CONSTRAINT "sms_credit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."unit_admins"
    ADD CONSTRAINT "unit_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."unit_admins"
    ADD CONSTRAINT "unit_admins_unit_id_user_id_key" UNIQUE ("unit_id", "user_id");



ALTER TABLE ONLY "public"."unit_messaging_settings"
    ADD CONSTRAINT "unit_messaging_settings_pkey" PRIMARY KEY ("unit_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_attendance_member_id" ON "public"."attendance" USING "btree" ("member_id");



CREATE INDEX "idx_attendance_service_id" ON "public"."attendance" USING "btree" ("service_id");



CREATE INDEX "idx_attendance_service_member" ON "public"."attendance" USING "btree" ("service_id", "member_id");



CREATE INDEX "idx_join_requests_org_status" ON "public"."join_requests" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_members_section_name" ON "public"."members" USING "btree" ("section", "name");



CREATE INDEX "idx_members_status" ON "public"."members" USING "btree" ("status");



CREATE INDEX "idx_members_unit_id" ON "public"."members" USING "btree" ("unit_id");



CREATE INDEX "idx_msg_log_created_at" ON "public"."absence_message_log" USING "btree" ("created_at");



CREATE INDEX "idx_msg_log_member" ON "public"."absence_message_log" USING "btree" ("member_id");



CREATE INDEX "idx_msg_log_sent_at" ON "public"."absence_message_log" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_msg_log_service" ON "public"."absence_message_log" USING "btree" ("service_id");



CREATE INDEX "idx_notifications_unit_fire" ON "public"."member_notifications" USING "btree" ("unit_id", "dismissed", "fire_at" DESC);



CREATE INDEX "idx_org_members_admin_id" ON "public"."organization_members" USING "btree" ("admin_id");



CREATE INDEX "idx_org_members_org_id" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_organizations_created_by" ON "public"."organizations" USING "btree" ("created_by_admin_id");



CREATE INDEX "idx_push_subs_member_id" ON "public"."member_push_subscriptions" USING "btree" ("member_id");



CREATE INDEX "idx_push_subs_unit_id" ON "public"."member_push_subscriptions" USING "btree" ("unit_id");



CREATE INDEX "idx_services_unit_id_date" ON "public"."services" USING "btree" ("unit_id", "date" DESC);



CREATE INDEX "idx_subscriptions_org" ON "public"."subscriptions" USING "btree" ("org_id");



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE INDEX "idx_subscriptions_stripe" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_unit_admins_unit_id" ON "public"."unit_admins" USING "btree" ("unit_id");



CREATE INDEX "idx_unit_admins_user_id" ON "public"."unit_admins" USING "btree" ("user_id");



CREATE INDEX "idx_units_created_by" ON "public"."units" USING "btree" ("created_by_admin_id");



CREATE INDEX "idx_units_org_id" ON "public"."units" USING "btree" ("org_id");



CREATE INDEX "idx_usage_events_org_created" ON "public"."usage_events" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_usage_events_type" ON "public"."usage_events" USING "btree" ("event_type");



CREATE UNIQUE INDEX "member_notifications_unique_type_time" ON "public"."member_notifications" USING "btree" ("member_id", "type", "fire_at");



CREATE OR REPLACE TRIGGER "audit_organization_delete" AFTER DELETE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."log_organization_delete"();



CREATE OR REPLACE TRIGGER "audit_unit_delete" AFTER DELETE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."log_unit_delete"();



CREATE OR REPLACE TRIGGER "on_join_request_approved" AFTER UPDATE ON "public"."join_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_join_request_update"();



CREATE OR REPLACE TRIGGER "on_organization_created" AFTER INSERT ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_organization"();



CREATE OR REPLACE TRIGGER "on_unit_created" AFTER INSERT ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_unit"();



CREATE OR REPLACE TRIGGER "prevent_audit_log_delete" BEFORE DELETE ON "public"."admin_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_log_modification"();



CREATE OR REPLACE TRIGGER "prevent_audit_log_update" BEFORE UPDATE ON "public"."admin_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_log_modification"();



CREATE OR REPLACE TRIGGER "subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_unit_messaging_settings_updated_at" BEFORE UPDATE ON "public"."unit_messaging_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."absence_message_log"
    ADD CONSTRAINT "absence_message_log_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."absence_message_log"
    ADD CONSTRAINT "absence_message_log_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_admins"
    ADD CONSTRAINT "blocked_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."join_requests"
    ADD CONSTRAINT "join_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_notifications"
    ADD CONSTRAINT "member_notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_notifications"
    ADD CONSTRAINT "member_notifications_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_push_subscriptions"
    ADD CONSTRAINT "member_push_subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_push_subscriptions"
    ADD CONSTRAINT "member_push_subscriptions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_credit_ledger"
    ADD CONSTRAINT "sms_credit_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."pricing_plans"("id");



ALTER TABLE ONLY "public"."super_admins"
    ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_admins"
    ADD CONSTRAINT "unit_admins_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_admins"
    ADD CONSTRAINT "unit_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_messaging_settings"
    ADD CONSTRAINT "unit_messaging_settings_sms_country_code_fkey" FOREIGN KEY ("sms_country_code") REFERENCES "public"."sms_countries"("code");



ALTER TABLE ONLY "public"."unit_messaging_settings"
    ADD CONSTRAINT "unit_messaging_settings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE SET NULL;



CREATE POLICY "Admins: create and read own requests" ON "public"."join_requests" USING (("admin_id" = "auth"."uid"()));



CREATE POLICY "Admins: read push subscriptions for their units" ON "public"."member_push_subscriptions" FOR SELECT TO "authenticated" USING (("public"."is_super_admin"() OR "public"."is_unit_admin"("unit_id") OR "public"."is_org_owner_by_unit"("unit_id")));



CREATE POLICY "Admins: view all attendance in their orgs" ON "public"."attendance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."units" "u" ON (("u"."id" = "s"."unit_id")))
  WHERE (("s"."id" = "attendance"."service_id") AND "public"."is_org_member"("u"."org_id")))));



CREATE POLICY "Admins: view all members in their orgs" ON "public"."members" FOR SELECT USING ("public"."is_org_member"(( SELECT "units"."org_id"
   FROM "public"."units"
  WHERE ("units"."id" = "members"."unit_id"))));



CREATE POLICY "Admins: view all services in their orgs" ON "public"."services" FOR SELECT USING ("public"."is_org_member"(( SELECT "units"."org_id"
   FROM "public"."units"
  WHERE ("units"."id" = "services"."unit_id"))));



CREATE POLICY "Anyone: insert push subscription" ON "public"."member_push_subscriptions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Authenticated: create organizations" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated: discover organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Managers: full access to attendance" ON "public"."attendance" USING ((EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "attendance"."service_id") AND "public"."is_unit_manager"("s"."unit_id")))));



CREATE POLICY "Managers: full access to members" ON "public"."members" USING (("public"."is_super_admin"() OR "public"."is_unit_manager"("unit_id") OR "public"."is_unit_admin"("unit_id"))) WITH CHECK (("public"."is_super_admin"() OR "public"."is_unit_manager"("unit_id") OR "public"."is_unit_admin"("unit_id")));



CREATE POLICY "Managers: full access to notifications in their unit" ON "public"."member_notifications" TO "authenticated" USING (("public"."is_unit_admin"("unit_id") OR "public"."is_org_owner_by_unit"("unit_id") OR "public"."is_super_admin"())) WITH CHECK (("public"."is_unit_admin"("unit_id") OR "public"."is_org_owner_by_unit"("unit_id") OR "public"."is_super_admin"()));



CREATE POLICY "Managers: full access to services" ON "public"."services" USING ("public"."is_unit_manager"("unit_id")) WITH CHECK ("public"."is_unit_manager"("unit_id"));



CREATE POLICY "Managers: full access to units" ON "public"."units" USING ("public"."is_unit_manager"("id")) WITH CHECK ("public"."is_unit_manager"("id"));



CREATE POLICY "Members: create units in their organizations" ON "public"."units" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_org_member"("org_id"));



CREATE POLICY "Members: read all units in their organizations" ON "public"."units" FOR SELECT USING ("public"."is_org_member"("org_id"));



CREATE POLICY "Members: read colleagues" ON "public"."organization_members" FOR SELECT USING ("public"."is_org_member"("organization_id"));



CREATE POLICY "Members: read organizations they belong to" ON "public"."organizations" FOR SELECT USING ("public"."is_org_member"("id"));



CREATE POLICY "Org admins: read message log" ON "public"."absence_message_log" FOR SELECT USING ("public"."is_org_admin_by_service"("service_id"));



CREATE POLICY "Org members: read ledger" ON "public"."sms_credit_ledger" FOR SELECT USING ("public"."is_org_member"("org_id"));



CREATE POLICY "Org members: read subscription" ON "public"."subscriptions" FOR SELECT USING ("public"."is_org_member"("org_id"));



CREATE POLICY "Org owners: read ledger" ON "public"."sms_credit_ledger" FOR SELECT USING ("public"."is_org_owner"("org_id"));



CREATE POLICY "Org owners: read own subscription" ON "public"."subscriptions" FOR SELECT USING ("public"."is_org_owner"("org_id"));



CREATE POLICY "Org owners: read usage" ON "public"."usage_events" FOR SELECT USING ("public"."is_org_owner"("org_id"));



CREATE POLICY "Owners: full access to members" ON "public"."organization_members" USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners: full access to org members" ON "public"."organization_members" USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners: full access to organizations they created" ON "public"."organizations" USING (("created_by_admin_id" = "auth"."uid"())) WITH CHECK (("created_by_admin_id" = "auth"."uid"()));



CREATE POLICY "Owners: manage requests for their org" ON "public"."join_requests" USING ("public"."is_org_owner"("organization_id"));



CREATE POLICY "Owners: manage unit_admins for their units" ON "public"."unit_admins" USING ("public"."is_org_owner_by_unit"("unit_id"));



CREATE POLICY "Public: read active sms_countries" ON "public"."sms_countries" FOR SELECT USING (("active" = true));



CREATE POLICY "Public: read plans" ON "public"."pricing_plans" FOR SELECT USING (true);



CREATE POLICY "Super admin: full access to attendance" ON "public"."attendance" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admin: full access to organizations" ON "public"."organizations" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admin: full access to services" ON "public"."services" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admin: full access to unit_admins" ON "public"."unit_admins" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admin: full access to units" ON "public"."units" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admin: manage blocked admins" ON "public"."blocked_admins" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can view audit logs" ON "public"."admin_audit_log" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "Super admins: manage ledger" ON "public"."sms_credit_ledger" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins: manage plans" ON "public"."pricing_plans" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins: manage subscriptions" ON "public"."subscriptions" USING ("public"."is_super_admin"());



CREATE POLICY "Super admins: manage usage events" ON "public"."usage_events" USING ("public"."is_super_admin"());



CREATE POLICY "Unit admins: full access to services in their unit" ON "public"."services" TO "authenticated" USING ("public"."is_unit_admin"("unit_id")) WITH CHECK ("public"."is_unit_admin"("unit_id"));



CREATE POLICY "Unit admins: read attendance for their units" ON "public"."attendance" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "attendance"."service_id") AND "public"."is_unit_admin"("s"."unit_id")))));



CREATE POLICY "Unit admins: read messaging settings" ON "public"."unit_messaging_settings" FOR SELECT USING (("public"."is_unit_admin"("unit_id") OR "public"."is_unit_manager"("unit_id")));



CREATE POLICY "Unit admins: read their own row" ON "public"."unit_admins" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Unit managers: manage messaging settings" ON "public"."unit_messaging_settings" USING ("public"."is_unit_manager"("unit_id"));



CREATE POLICY "Unit managers: read message log" ON "public"."absence_message_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."units" "u" ON (("u"."id" = "s"."unit_id")))
  WHERE (("s"."id" = "absence_message_log"."service_id") AND "public"."is_unit_manager"("u"."id")))));



CREATE POLICY "User: read own block" ON "public"."blocked_admins" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."absence_message_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."blocked_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_credit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."super_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admins: self read" ON "public"."super_admins" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."unit_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unit_messaging_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."attendance";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."add_unit_admin_by_email"("p_unit_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_unit_admin_by_email"("p_unit_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_unit_admin_by_email"("p_unit_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_org_admin"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_org_admin"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_org_admin"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_org_owner"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_org_owner"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_org_owner"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid", "p_device_id" "text", "p_lat" numeric, "p_lng" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid", "p_device_id" "text", "p_lat" numeric, "p_lng" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkin_by_id"("p_member_id" "uuid", "p_service_id" "uuid", "p_device_id" "text", "p_lat" numeric, "p_lng" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."checkin_by_phone"("p_phone" "text", "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."checkin_by_phone"("p_phone" "text", "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkin_by_phone"("p_phone" "text", "p_service_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_sms_credit"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_birthday_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_birthday_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_birthday_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_sms_chunk"("p_service_id" "uuid", "p_member_ids" "uuid"[], "p_project_url" "text", "p_service_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_sms_chunk"("p_service_id" "uuid", "p_member_ids" "uuid"[], "p_project_url" "text", "p_service_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_sms_chunk"("p_service_id" "uuid", "p_member_ids" "uuid"[], "p_project_url" "text", "p_service_role_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_org_billing"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_org_billing"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_billing"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_billing"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_join_requests"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_join_requests"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_join_requests"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_notifications"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_notifications"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_notifications"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_members"("p_service_id" "uuid", "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_service_members_full"("p_service_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_join_request_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_join_request_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_join_request_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_organization"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_organization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_organization"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_unit"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_unit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_unit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_admin_by_service"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_admin_by_service"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_admin_by_service"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_member"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_member"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_member"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_owner"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_owner"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_owner"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_owner_by_unit"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_owner_by_unit"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_owner_by_unit"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_unit_admin"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_unit_admin"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_unit_admin"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_unit_manager"("p_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_unit_manager"("p_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_unit_manager"("p_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_admin_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_admin_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_admin_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_organization_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_organization_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_organization_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_sms_credits_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_sms_credits_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_sms_credits_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_unit_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_unit_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_unit_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_chorister_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_chorister_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_chorister_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_audit_log_modification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_sms_credit"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_sms_credits"("p_org_id" "uuid", "p_credits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_sms_consent"("p_member_id" "uuid", "p_consent" boolean, "p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."absence_message_log" TO "anon";
GRANT ALL ON TABLE "public"."absence_message_log" TO "authenticated";
GRANT ALL ON TABLE "public"."absence_message_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."blocked_admins" TO "anon";
GRANT ALL ON TABLE "public"."blocked_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_admins" TO "service_role";



GRANT ALL ON TABLE "public"."join_requests" TO "anon";
GRANT ALL ON TABLE "public"."join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."member_notifications" TO "anon";
GRANT ALL ON TABLE "public"."member_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."member_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."member_push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."member_push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."member_push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_plans" TO "anon";
GRANT ALL ON TABLE "public"."pricing_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_plans" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."sms_countries" TO "anon";
GRANT ALL ON TABLE "public"."sms_countries" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_countries" TO "service_role";



GRANT ALL ON TABLE "public"."sms_credit_ledger" TO "anon";
GRANT ALL ON TABLE "public"."sms_credit_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_credit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."sms_credits" TO "anon";
GRANT ALL ON TABLE "public"."sms_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_credits" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."super_admins" TO "anon";
GRANT ALL ON TABLE "public"."super_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."super_admins" TO "service_role";



GRANT ALL ON TABLE "public"."unit_admins" TO "anon";
GRANT ALL ON TABLE "public"."unit_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_admins" TO "service_role";



GRANT ALL ON TABLE "public"."unit_messaging_settings" TO "anon";
GRANT ALL ON TABLE "public"."unit_messaging_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_messaging_settings" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































