import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUSH_TIMEOUT_MS = 10_000
const MAX_NOTIFICATIONS = 100

type AdminSubscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

type DueNotification = {
  id: string
  unit_id: string
  type: 'birthday_eve' | 'birthday_day'
  member: { name: string } | null
  unit: { name: string } | null
}

async function sendNotification(
  sub: AdminSubscription,
  payload: string,
): Promise<{ stale: boolean; sent: boolean }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS)

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload,
    )
    return { stale: false, sent: true }
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 410 || status === 404) return { stale: true, sent: false }
    console.error(`[send-admin-birthday-push] Failed for sub ${sub.id} (HTTP ${status ?? 'network'}):`, String(err))
    return { stale: false, sent: false }
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = Date.now()

  try {
    const { unit_id } = await req.json().catch(() => ({})) as { unit_id?: string }

    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      return json(503, { error: 'VAPID keys not configured' })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const authHeader = req.headers.get('Authorization') ?? ''
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isServiceRole = serviceRoleKey.length > 0 && bearerToken === serviceRoleKey

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (!isServiceRole) {
      if (!unit_id) return json(400, { error: 'unit_id is required for admin-triggered sends' })

      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )

      const { data: { user }, error: authErr } = await userClient.auth.getUser()
      if (authErr || !user) return json(401, { error: 'Unauthenticated' })

      const { data: allowed } = await userClient.rpc('is_unit_admin', { p_unit_id: unit_id })
      const { data: ownerAllowed } = await userClient.rpc('is_org_owner_by_unit', { p_unit_id: unit_id })
      const { data: superAllowed } = await userClient.rpc('is_super_admin', {})
      if (!allowed && !ownerAllowed && !superAllowed) return json(403, { error: 'Forbidden' })
    }

    let query = supabase
      .from('member_notifications')
      .select('id, unit_id, type, member:members(name), unit:units(name)')
      .eq('dismissed', false)
      .is('admin_push_sent_at', null)
      .lte('fire_at', new Date().toISOString())
      .order('fire_at', { ascending: true })
      .limit(MAX_NOTIFICATIONS)

    if (unit_id) query = query.eq('unit_id', unit_id)

    const { data, error } = await query
    if (error) {
      console.error('[send-admin-birthday-push] Failed to fetch notifications:', error.message)
      return json(500, { error: 'Failed to fetch due notifications' })
    }

    const due = (data ?? []) as DueNotification[]
    if (due.length === 0) return json(200, { sent: 0, stale: 0, failed: 0, notifications: 0, elapsed_ms: Date.now() - startedAt })

    const byUnit = new Map<string, DueNotification[]>()
    for (const notification of due) {
      const list = byUnit.get(notification.unit_id) ?? []
      list.push(notification)
      byUnit.set(notification.unit_id, list)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://www.rollcally.com'
    const staleIds: string[] = []
    const sentNotificationIds: string[] = []
    let sent = 0
    let failed = 0
    let stale = 0

    for (const [unitId, notifications] of byUnit) {
      const { data: subs, error: subsError } = await supabase
        .from('admin_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('unit_id', unitId)

      if (subsError) {
        console.error(`[send-admin-birthday-push] Failed to fetch admin subscriptions for unit=${unitId}:`, subsError.message)
        failed += notifications.length
        continue
      }

      if (!subs || subs.length === 0) continue

      const unitName = notifications[0]?.unit?.name ?? 'your unit'
      const firstName = notifications[0]?.member?.name ?? 'A member'
      const hasToday = notifications.some(n => n.type === 'birthday_day')
      const title = hasToday ? 'Birthday today on Rollcally' : 'Birthday reminder on Rollcally'
      const body = notifications.length === 1
        ? `${firstName}: ${hasToday ? 'birthday today' : 'birthday in 1 week'}`
        : `${notifications.length} birthday alerts need attention in ${unitName}`

      const payload = JSON.stringify({
        title,
        body,
        url: `${appUrl}/admin/units/${unitId}`,
      })

      const results = await Promise.allSettled(
        (subs as AdminSubscription[]).map(sub => sendNotification(sub, payload))
      )

      const unitSent = results.filter(r => r.status === 'fulfilled' && r.value.sent).length
      sent += unitSent
      stale += results.filter(r => r.status === 'fulfilled' && r.value.stale).length
      failed += results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.sent && !r.value.stale)).length

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.stale) {
          staleIds.push((subs as AdminSubscription[])[index].id)
        }
      })

      if (unitSent > 0) {
        sentNotificationIds.push(...notifications.map(n => n.id))
      }
    }

    if (staleIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('admin_push_subscriptions')
        .delete()
        .in('id', staleIds)
      if (deleteErr) console.warn('[send-admin-birthday-push] Failed to remove stale subscriptions:', deleteErr.message)
    }

    if (sentNotificationIds.length > 0) {
      const { error: updateErr } = await supabase
        .from('member_notifications')
        .update({ admin_push_sent_at: new Date().toISOString() })
        .in('id', sentNotificationIds)
      if (updateErr) console.warn('[send-admin-birthday-push] Failed to mark notifications pushed:', updateErr.message)
    }

    return json(200, {
      sent,
      stale,
      failed,
      notifications: due.length,
      marked_sent: sentNotificationIds.length,
      elapsed_ms: Date.now() - startedAt,
    })
  } catch (err) {
    console.error('[send-admin-birthday-push] Unhandled error:', String(err))
    return json(500, { error: String(err) })
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
