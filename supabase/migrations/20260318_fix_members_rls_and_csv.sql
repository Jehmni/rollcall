-- ============================================================
-- Migration: 20260318 — Fix members RLS + unit admin write access
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Drop the existing restrictive policy (only allowed unit creator + org owner).
drop policy if exists "Managers: full access to members" on members;

-- Recreate with unit_admins included.
-- This allows: super admin | org owner | unit creator | explicit unit admin
create policy "Managers: full access to members"
  on members for all
  using     (is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id))
  with check(is_super_admin() or is_unit_manager(unit_id) or is_unit_admin(unit_id));
