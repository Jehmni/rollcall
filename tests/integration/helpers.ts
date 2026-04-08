/**
 * Shared helpers for integration tests (real Supabase, no route mocks).
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

const IDS_FILE = join(fileURLToPath(new URL('.', import.meta.url)), '.test-ids.json')

export interface TestIds {
  adminId:       string
  adminEmail:    string
  adminPassword: string
  orgId:         string
  unitId:        string
  serviceId:     string
  aliceId:       string
  bobId:         string
  today:         string
}

export function loadIds(): TestIds {
  return JSON.parse(readFileSync(IDS_FILE, 'utf8'))
}

const PROJECT_REF = (process.env.VITE_SUPABASE_URL ?? '')
  .replace(/https?:\/\//, '')
  .split('.')[0]

export const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

/**
 * Sign in as the integration test admin and inject the real session into the
 * browser's localStorage before any navigation.  The browser will then make
 * all subsequent Supabase calls with the genuine JWT — no route mocking.
 */
export async function asIntegrationAdmin(page: Page, ids: TestIds): Promise<string> {
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''
  const url     = process.env.VITE_SUPABASE_URL      ?? ''

  const auth = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await auth.auth.signInWithPassword({
    email:    ids.adminEmail,
    password: ids.adminPassword,
  })
  if (error || !data.session) {
    throw new Error(`Integration admin login failed: ${error?.message}`)
  }

  const session = {
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at:    data.session.expires_at,
    token_type:    'bearer',
    user:          data.user,
  }

  await page.addInitScript(
    ({ key, val }: { key: string; val: unknown }) => localStorage.setItem(key, JSON.stringify(val)),
    { key: STORAGE_KEY, val: session },
  )

  return data.session.access_token
}
