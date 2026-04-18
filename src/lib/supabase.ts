import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Rollcally] Missing Supabase environment variables. ' +
    'Copy .env.example to .env.local and fill in your project credentials.',
  )
}

// Use placeholders when env vars are absent so the module doesn't throw at
// import time — unauthenticated pages (legal pages etc.) must still render.
// Any real Supabase call will fail with a network error, which is handled
// locally by each hook / page.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
)


