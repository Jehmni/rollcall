import webpush from 'npm:web-push@3'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUSH_TIMEOUT_MS  = 10_000
const PUSH_MAX_RETRIES = 3

// ─── Retry helper ─────────────────────────────────────────────────────────────

function isRetryablePushError(err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode
  // 410 Gone / 404 Not Found → subscription expired, don't retry
  if (status === 410 || status === 404) return false
  // 429 Too Many Requests or any 5xx → transient, retry
  if (status === 429 || (status !== undefined && status >= 500)) return true
  // Network-level failures (no statusCode) → retry
  return status === undefined
}

async function sendWithRetry(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: string,
): Promise<{ stale: boolean; failed: boolean; error?: string }> {
  let lastError: unknown

  for (let attempt = 0; attempt < PUSH_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1_000 * Math.pow(2, attempt - 1)))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS)

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      clearTimeout(timer)
      return { stale: false, failed: false }
    } catch (err: unknown) {
      clearTimeout(timer)
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 410 || status === 404) {
        return { stale: true, failed: false }
      }
      lastError = err
      if (!isRetryablePushError(err)) {
        console.error(`[send-push] Non-retryable error for sub ${sub.id} (HTTP ${status}):`, String(err))
        return { stale: false, failed: true, error: String(err) }
      }
      console.warn(`[send-push] Attempt ${attempt + 1}/${PUSH_MAX_RETRIES} failed for sub ${sub.id} (HTTP ${status ?? 'network'}), retrying…`)
    }
  }

  console.error(`[send-push] All ${PUSH_MAX_RETRIES} attempts failed for sub ${sub.id}:`, String(lastError))
  return { stale: false, failed: true, error: String(lastError) }
}

// ─── Request handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = Date.now()

  try {
    const { service_id, unit_id } = await req.json() as { service_id: string; unit_id: string }

    console.info(`[send-push] Sending push for service=${service_id} unit=${unit_id}`)

    const vapidSubject    = Deno.env.get('VAPID_SUBJECT')
    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      const missing = [
        !vapidSubject    && 'VAPID_SUBJECT',
        !vapidPublicKey  && 'VAPID_PUBLIC_KEY',
        !vapidPrivateKey && 'VAPID_PRIVATE_KEY',
      ].filter(Boolean).join(', ')
      console.error(`[send-push] Missing VAPID secrets: ${missing}`)
      return json(503, { error: `VAPID keys not configured: ${missing}` })
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch all subscriptions for the unit
    const { data: subs, error: subsError } = await supabase
      .from('member_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('unit_id', unit_id)

    if (subsError) {
      console.error('[send-push] Failed to fetch subscriptions:', subsError.message)
      throw subsError
    }

    if (!subs || subs.length === 0) {
      console.info(`[send-push] No subscriptions for unit=${unit_id}`)
      return json(200, { sent: 0, stale: 0, failed: 0, elapsed_ms: Date.now() - startedAt })
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://www.rollcally.com'
    const checkinUrl = `${appUrl}/checkin?service_id=${service_id}`

    const payload = JSON.stringify({
      title: 'Session started — check in now',
      body: 'Tap to record your attendance instantly.',
      url: checkinUrl,
    })

    let sent = 0, stale = 0, failed = 0
    const staleIds: string[] = []

    const results = await Promise.allSettled(
      subs.map(sub => sendWithRetry(sub, payload))
    )

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        console.error(`[send-push] Unexpected rejection for sub ${subs[i].id}:`, r.reason)
        failed++
        continue
      }
      if (r.value.stale)  { staleIds.push(subs[i].id); stale++ }
      else if (r.value.failed) failed++
      else sent++
    }

    // Clean up expired subscriptions
    if (staleIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('member_push_subscriptions')
        .delete()
        .in('id', staleIds)
      if (deleteErr) {
        console.warn('[send-push] Failed to delete stale subscriptions:', deleteErr.message)
      } else {
        console.info(`[send-push] Removed ${staleIds.length} stale subscription(s)`)
      }
    }

    // Mark notification sent
    const { error: updateErr } = await supabase
      .from('services')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', service_id)

    if (updateErr) {
      console.warn('[send-push] Failed to mark notification_sent_at:', updateErr.message)
    }

    const elapsed = Date.now() - startedAt
    console.info(`[send-push] Done. sent=${sent} stale=${stale} failed=${failed} elapsed=${elapsed}ms`)

    return json(200, { sent, stale, failed, elapsed_ms: elapsed })

  } catch (err) {
    console.error('[send-push] Unhandled error:', String(err))
    return json(500, { error: String(err) })
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
