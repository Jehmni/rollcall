-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Enforce 3-character minimum on public member search RPC
-- Safe to re-run — CREATE OR REPLACE is idempotent.
--
-- Root cause: get_service_members was defined in schema.sql (the bootstrap
-- file) but was never included in any migration.  A database set up from
-- migrations alone would have no such function, causing:
--   a) the check-in search to fail with an RPC-not-found error, or
--   b) the anon role to enumerate the full roster with a single empty-string
--      call (if a fallback existed).
--
-- This migration creates the function with the same body as schema.sql so
-- that the migration chain and the bootstrap file are in agreement.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns active members whose name or section contains p_search.
-- Callable by anon (unauthenticated check-in page users).
-- Enforces a server-side minimum of 3 characters — returns an empty result
-- set for shorter queries so that the full roster cannot be enumerated by an
-- unauthenticated caller one letter at a time.
create or replace function public.get_service_members(
  p_service_id uuid,
  p_search     text default null
)
returns table (id uuid, name text, section text)
language plpgsql stable security definer as $$
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

-- Strip default PUBLIC grant, then re-grant to specific roles only.
revoke all on function public.get_service_members(uuid, text) from public;
grant execute on function public.get_service_members(uuid, text) to anon;
grant execute on function public.get_service_members(uuid, text) to authenticated;
