/**
 * Integration test global teardown.
 *
 * Deletes the test organization created by global-setup.ts.
 * Cascade deletes remove: units, unit_admins, services, members, attendance,
 * absence_message_log, usage_events, subscriptions.
 *
 * Also deletes the ephemeral test admin user created for this run.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const IDS_FILE = join(fileURLToPath(new URL('.', import.meta.url)), '.test-ids.json')

export default async function globalTeardown() {
  if (!existsSync(IDS_FILE)) {
    console.warn('[integration teardown] .test-ids.json not found, skipping cleanup')
    return
  }

  const ids = JSON.parse(readFileSync(IDS_FILE, 'utf8')) as {
    orgId: string
    adminId?: string
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    console.warn('[integration teardown] Missing env vars, skipping cleanup')
    return
  }

  const db = createClient(url, key, { auth: { persistSession: false } })

  // Delete org (cascade removes all test data)
  const { error: orgErr } = await db.from('organizations').delete().eq('id', ids.orgId)
  if (orgErr) {
    console.error('[integration teardown] Failed to delete org:', orgErr.message)
  } else {
    console.log('[integration teardown] Test org deleted:', ids.orgId)
  }

  // Delete the ephemeral test admin user
  if (ids.adminId) {
    await db.from('super_admins').delete().eq('user_id', ids.adminId)
    const { error: userErr } = await db.auth.admin.deleteUser(ids.adminId)
    if (userErr) {
      console.error('[integration teardown] Failed to delete test admin:', userErr.message)
    } else {
      console.log('[integration teardown] Test admin deleted:', ids.adminId)
    }
  }

  unlinkSync(IDS_FILE)
}
