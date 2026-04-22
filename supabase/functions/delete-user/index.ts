import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  // Only super admins should call this — enforced on the client.
  // We still validate the caller is authenticated and is a super admin here.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
  }

  // Use service-role client for admin operations
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the calling user is a super admin
  const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await userClient.auth.getUser()
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const { data: superRow } = await admin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', caller.id)
    .maybeSingle()
  if (!superRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — super admin only' }), { status: 403 })
  }

  // Parse target user_id
  const { user_id } = await req.json() as { user_id: string }
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400 })
  }

  // Prevent deleting yourself
  if (user_id === caller.id) {
    return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400 })
  }

  // Delete from auth.users (cascades to all related data)
  const { error } = await admin.auth.admin.deleteUser(user_id)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
