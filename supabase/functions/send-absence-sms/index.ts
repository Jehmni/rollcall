/**
 * send-absence-sms  — Rollcally Edge Function
 *
 * Sends an SMS to every absent member (who has a phone number) for a given
 * service, then logs the result in absence_message_log.
 *
 * Supports two SMS providers (configured via Supabase secrets):
 *   SMS_PROVIDER = 'africastalking'  (default, cheapest for African numbers)
 *   SMS_PROVIDER = 'twilio'
 *
 * Required secrets for Africa's Talking:
 *   AT_API_KEY    — your AT API key
 *   AT_USERNAME   — your AT username (use 'sandbox' for testing)
 *   AT_SENDER_ID  — optional alphanumeric sender ID (leave blank for shared short code)
 *
 * Required secrets for Twilio:
 *   TWILIO_SID        — Account SID
 *   TWILIO_AUTH_TOKEN — Auth token
 *   TWILIO_FROM       — Your Twilio phone number (E.164 format)
 *
 * Invocation:
 *   Manual  → supabase.functions.invoke('send-absence-sms', { body: { service_id } })
 *   Cron    → HTTP POST with body { "scheduled": true }  (processes all eligible
 *             services for today whose send_hour has been reached in their timezone)
 *   Dry run → add "dry_run": true to skip actual SMS sends (for preview/testing)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── SMS provider abstraction ─────────────────────────────────────────────────

async function sendViaSMS(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const provider = Deno.env.get('SMS_PROVIDER') ?? 'africastalking'

  if (provider === 'africastalking') {
    const apiKey  = Deno.env.get('AT_API_KEY') ?? ''
    const username = Deno.env.get('AT_USERNAME') ?? 'sandbox'
    const senderId = Deno.env.get('AT_SENDER_ID') ?? ''

    const params = new URLSearchParams({ username, to: phone, message })
    if (senderId) params.set('from', senderId)

    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    })

    if (!res.ok) return { ok: false, error: `AT HTTP ${res.status}` }
    const data = await res.json()
    const recipient = (data?.SMSMessageData?.Recipients ?? [])[0]
    return recipient?.status === 'Success'
      ? { ok: true }
      : { ok: false, error: recipient?.status ?? 'Unknown Africa\'s Talking error' }
  }

  if (provider === 'twilio') {
    const sid   = Deno.env.get('TWILIO_SID') ?? ''
    const token = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
    const from  = Deno.env.get('TWILIO_FROM') ?? ''

    const params = new URLSearchParams({ To: phone, From: from, Body: message })
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )
    if (res.ok) return { ok: true }
    const data = await res.json()
    return { ok: false, error: data?.message ?? `Twilio HTTP ${res.status}` }
  }

  return { ok: false, error: `Unknown SMS_PROVIDER: "${provider}"` }
}

// ─── Message template ─────────────────────────────────────────────────────────

function renderTemplate(template: string, name: string, event: string): string {
  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{event\}\}/g, event)
}

// ─── Timezone-aware hour check ────────────────────────────────────────────────

function currentHourIn(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date())
    return parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  } catch {
    return new Date().getUTCHours()
  }
}

// ─── Core send logic for one service ─────────────────────────────────────────

interface ServiceRow { id: string; unit_id: string; date: string; service_type: string }
interface SettingsRow { enabled: boolean; message_template: string; send_hour: number; timezone: string }
interface MemberRow  { id: string; name: string; phone: string | null; checked_in: boolean }

async function processService(
  supabase: ReturnType<typeof createClient>,
  service: ServiceRow,
  dryRun: boolean,
): Promise<{ sent: number; failed: number; skipped: number; reason?: string }> {

  // Load messaging settings for this unit
  const { data: settings } = await supabase
    .from('unit_messaging_settings')
    .select('enabled, message_template, send_hour, timezone')
    .eq('unit_id', service.unit_id)
    .maybeSingle() as { data: SettingsRow | null }

  if (!settings?.enabled) return { sent: 0, failed: 0, skipped: 0, reason: 'messaging disabled' }

  // Safeguard: only send on the same day as the event (allows up to midnight)
  const today = new Date().toISOString().slice(0, 10)
  if (service.date !== today) return { sent: 0, failed: 0, skipped: 0, reason: 'not today' }

  // Get all members for this service (absent + present) in one RPC call
  const { data: members, error: membersErr } = await supabase
    .rpc('get_service_members_full', { p_service_id: service.id, p_limit: 10000, p_offset: 0 })
  if (membersErr) throw new Error(`get_service_members_full: ${membersErr.message}`)

  const absentWithPhone = (members as MemberRow[]).filter(m => !m.checked_in && m.phone)
  if (absentWithPhone.length === 0) return { sent: 0, failed: 0, skipped: 0, reason: 'no absent members with phone' }

  const eventName = service.service_type || 'today\'s event'
  const template  = settings.message_template

  let sent = 0, failed = 0, skipped = 0

  for (const member of absentWithPhone) {
    // Idempotency: skip if already messaged for this service
    const { data: existing } = await supabase
      .from('absence_message_log')
      .select('id')
      .eq('service_id', service.id)
      .eq('member_id', member.id)
      .maybeSingle()
    if (existing) { skipped++; continue }

    const message = renderTemplate(template, member.name, eventName)

    if (dryRun) { sent++; continue }

    const result = await sendViaSMS(member.phone!, message)

    await supabase.from('absence_message_log').insert({
      service_id: service.id,
      member_id:  member.id,
      phone:      member.phone,
      message,
      status:     result.ok ? 'sent' : 'failed',
      error_text: result.error ?? null,
    })

    if (result.ok) sent++; else failed++
  }

  return { sent, failed, skipped }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json() as {
      service_id?: string   // provided for manual / single-service sends
      scheduled?: boolean   // true when called by pg_cron; processes all eligible services today
      dry_run?: boolean     // skips actual SMS sends; useful for preview
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const dryRun = body.dry_run ?? false

    // ── Manual single-service send ─────────────────────────────────────────
    if (body.service_id) {
      const { data: service, error } = await supabase
        .from('services')
        .select('id, unit_id, date, service_type')
        .eq('id', body.service_id)
        .single() as { data: ServiceRow | null; error: unknown }
      if (error || !service) return json(404, { error: 'Service not found' })

      const result = await processService(supabase, service, dryRun)
      return json(200, result)
    }

    // ── Scheduled (pg_cron) — process all eligible services today ──────────
    if (body.scheduled) {
      const today = new Date().toISOString().slice(0, 10)

      // Fetch all services for today that have messaging enabled
      const { data: rows } = await supabase
        .from('services')
        .select(`
          id, unit_id, date, service_type,
          unit_messaging_settings!inner(enabled, send_hour, timezone)
        `)
        .eq('date', today)
        .eq('unit_messaging_settings.enabled', true)

      const results: Record<string, unknown> = {}

      for (const row of (rows ?? []) as (ServiceRow & {
        unit_messaging_settings: { enabled: boolean; send_hour: number; timezone: string }[]
      })[]) {
        const cfg = row.unit_messaging_settings?.[0]
        if (!cfg) continue

        // Only fire when the current local hour matches send_hour
        const localHour = currentHourIn(cfg.timezone)
        if (localHour !== cfg.send_hour) continue

        results[row.id] = await processService(supabase, row, dryRun)
      }

      return json(200, { processed: Object.keys(results).length, results })
    }

    return json(400, { error: 'Provide service_id (manual) or scheduled:true (cron)' })

  } catch (err) {
    return json(500, { error: String(err) })
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
