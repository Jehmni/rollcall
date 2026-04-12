-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Harden anon write boundaries for attendance + SMS consent
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Remove direct anonymous INSERT path to attendance.
-- Check-ins must go through checkin_by_id(), which enforces:
--   - valid service/member relationship
--   - geofence when required
--   - device locking
--   - duplicate protection
drop policy if exists "Anon: insert attendance via RPC" on attendance;

-- 2) Harden SMS consent writes with service-scoped verification.
-- Only allow consent updates for a member who has already checked in
-- to the provided service. This keeps anon UX intact while preventing
-- arbitrary member-id updates.
create or replace function public.set_member_sms_consent(
  p_member_id  uuid,
  p_consent    boolean,
  p_service_id uuid
)
returns void
language plpgsql
security definer
as $$
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

revoke all on function public.set_member_sms_consent(uuid, boolean, uuid) from public;
grant execute on function public.set_member_sms_consent(uuid, boolean, uuid) to anon, authenticated;

-- 3) Lock down deprecated 2-arg signature for anon clients.
-- Keep function definition (if present) for backward compatibility, but
-- remove anon execute so stale clients cannot write unconstrained consent.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_member_sms_consent'
      and p.pronargs = 2
      and oidvectortypes(p.proargtypes) = 'uuid, boolean'
  ) then
    execute 'revoke all on function public.set_member_sms_consent(uuid, boolean) from anon, authenticated';
  end if;
end;
$$;
