/**
 * Integration test global setup.
 *
 * Creates isolated test data in real Supabase using the service-role key
 * (bypasses RLS). Writes the created IDs to tests/integration/.test-ids.json
 * so individual test files can reference them without knowing UUIDs in advance.
 *
 * Teardown (global-teardown.ts) deletes the test org (cascades) and the test
 * admin auth user.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

export const IDS_FILE = join(fileURLToPath(new URL('.', import.meta.url)), '.test-ids.json')

export default async function globalSetup() {
  const url  = process.env.VITE_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Integration tests require VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.',
    )
  }

  const db  = createClient(url, key, { auth: { persistSession: false } })
  const tag = `integration-${Date.now()}`

  // ── 1. Create a fresh test admin user for this run ─────────────────────────
  const adminEmail    = `rollcally-test-${Date.now()}@rollcally-test.dev`
  const adminPassword = `Test${Date.now()}!Rollcally`

  const { data: adminData, error: adminErr } = await db.auth.admin.createUser({
    email:         adminEmail,
    password:      adminPassword,
    user_metadata: { role: 'superadmin' },
    email_confirm: true,
  })
  if (adminErr || !adminData.user) {
    throw new Error(`Setup: admin user creation failed — ${adminErr?.message}`)
  }
  const adminId = adminData.user.id

  // Register as super admin so the portal grants full access
  const { error: saErr } = await db.from('super_admins').insert({ user_id: adminId })
  if (saErr) throw new Error(`Setup: super_admins insert failed — ${saErr.message}`)

  // ── 2. Organization ────────────────────────────────────────────────────────
  const { data: org, error: orgErr } = await db
    .from('organizations')
    .insert({ name: `Rollcally Test Org [${tag}]`, created_by_admin_id: adminId })
    .select('id')
    .single()
  if (orgErr || !org) throw new Error(`Setup: org insert failed — ${orgErr?.message}`)

  // Note: the on_organization_created trigger automatically inserts the creator
  // into organization_members as owner — no manual insert needed here.

  // ── 3. Unit ────────────────────────────────────────────────────────────────
  const { data: unit, error: unitErr } = await db
    .from('units')
    .insert({
      org_id:              org.id,
      name:                `Test Choir [${tag}]`,
      created_by_admin_id: adminId,
    })
    .select('id')
    .single()
  if (unitErr || !unit) throw new Error(`Setup: unit insert failed — ${unitErr?.message}`)

  // Note: the on_unit_created trigger automatically adds the unit creator to
  // unit_admins — no manual insert needed here.

  // ── 4. Service for today ───────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { data: service, error: svcErr } = await db
    .from('services')
    .insert({
      unit_id:          unit.id,
      date:             today,
      service_type:     'rehearsal',
      require_location: false,
    })
    .select('id')
    .single()
  if (svcErr || !service) throw new Error(`Setup: service insert failed — ${svcErr?.message}`)

  // ── 5. Members ─────────────────────────────────────────────────────────────
  const { data: members, error: memberErr } = await db
    .from('members')
    .insert([
      { unit_id: unit.id, name: 'Alice Integration', section: 'Soprano', status: 'active' },
      { unit_id: unit.id, name: 'Bob Integration',   section: 'Bass',    status: 'active', phone: '+12025550001', sms_consent: true },
    ])
    .select('id, name')
  if (memberErr || !members) throw new Error(`Setup: member insert failed — ${memberErr?.message}`)

  const alice = members.find(m => m.name === 'Alice Integration')!
  const bob   = members.find(m => m.name === 'Bob Integration')!

  // ── Write IDs ──────────────────────────────────────────────────────────────
  const ids = {
    adminId, adminEmail, adminPassword,
    orgId:     org.id,
    unitId:    unit.id,
    serviceId: service.id,
    aliceId:   alice.id,
    bobId:     bob.id,
    today,
  }
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2))

  console.log('[integration setup] Test data created:', {
    adminId, orgId: org.id, unitId: unit.id, serviceId: service.id,
  })
}
