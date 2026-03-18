-- ============================================================
-- Migration: 20260318 — Fix members RLS + unit admin write access
-- Run AFTER 20260315_fix_missing_functions.sql.
-- If you are running this standalone, the functions
-- is_super_admin, is_unit_manager, and is_unit_admin must
-- already exist. Run 20260315 first.
-- ============================================================

-- Drop the existing restrictive policy (only allowed unit creator + org owner).
drop policy if exists "Managers: full access to members" on members;

-- Recreate with unit_admins included.
-- Allows: super admin | org owner | unit creator | explicit unit admin
create policy "Managers: full access to members"
  on members for all
  using     (is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id))
  with check(is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id));
