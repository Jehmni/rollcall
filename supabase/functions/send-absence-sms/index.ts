/**
 * send-absence-sms  — Rollcally Edge Function
 *
 * Sends an SMS to every absent member (who has a phone number and has
 * consented) for a given service and logs the result.
 *
 * Billing layer: before sending each SMS, deducts one credit from the
 * organisation's sms_credits balance via an atomic DB function. If the
 * balance is exhausted, the send is blocked and logged as 'sms_blocked'
 * in usage_events. No charge is incurred for blocked sends.
 *
 * Provider selection (set SMS_PROVIDER secret):
 *   'twilio'         — default, global coverage
 *   'africastalking' — cheaper for African numbers
 *
 * Required secrets — Twilio:
 *   TWILIO_SID        Account SID
 *   TWILIO_AUTH_TOKEN Auth token
 *   TWILIO_FROM       Twilio number in E.164 format (+12345678901)
 *
 * Required secrets — Africa's Talking:
 *   AT_API_KEY    API key
 *   AT_USERNAME   Username (use 'sandbox' for testing)
 *   AT_SENDER_ID  Optional alphanumeric sender ID
 *
 * Invocation modes:
 *   Manual:    { service_id: "uuid" }
 *   Scheduled: { scheduled: true }  — called by pg_cron
 *   Dry run:   add dry_run: true   — returns counts without sending or logging
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SMS_TIMEOUT_MS  = 12_000  // per-message API call timeout
const MAX_MEMBERS     = 5_000   // hard cap — matches client-side export cap
const SMS_MAX_RETRIES = 3       // retry on transient errors

// ─── Validate secrets at startup ─────────────────────────────────────────────

const SMS_PROVIDER = (Deno.env.get('SMS_PROVIDER') ?? 'twilio').toLowerCase()

function validateSecrets(): string | null {
  if (SMS_PROVIDER === 'africastalking') {
    if (!Deno.env.get('AT_API_KEY')) return 'AT_API_KEY secret not configured'
    return null
  }
  if (!Deno.env.get('TWILIO_SID'))        return 'TWILIO_SID secret not configured'
  if (!Deno.env.get('TWILIO_AUTH_TOKEN')) return 'TWILIO_AUTH_TOKEN secret not configured'
  if (!Deno.env.get('TWILIO_FROM'))       return 'TWILIO_FROM secret not configured'
  return null
}

// ─── SMS providers ────────────────────────────────────────────────────────────

async function sendTwilio(
  phone: string, message: string, senderName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const sid   = Deno.env.get('TWILIO_SID')!
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')!
  // Use per-unit alphanumeric sender name if set; fall back to the registered number.
  // Alphanumeric sender IDs are not supported in US/Canada — Twilio will reject and
  // the error will be logged in absence_message_log.
  const from  = senderName?.trim() || Deno.env.get('TWILIO_FROM')!

  const body = new URLSearchParams({ To: phone, From: from, Body: message })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      },
    )
    const data = await res.json()
    if (res.ok && !data.error_code) return { ok: true }
    return { ok: false, error: data.message ?? `Twilio HTTP ${res.status}` }
  } catch (err: unknown) {
    const msg = (err as Error)?.name === 'AbortError' ? 'Twilio request timed out' : String(err)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

async function sendAfricasTalking(
  phone: string, message: string, senderName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey   = Deno.env.get('AT_API_KEY')!
  const username = Deno.env.get('AT_USERNAME') ?? 'sandbox'
  const senderId = senderName?.trim() || Deno.env.get('AT_SENDER_ID') || ''

  const params = new URLSearchParams({ username, to: phone, message })
  if (senderId) params.set('from', senderId)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `AT HTTP ${res.status}: ${text.slice(0, 120)}` }
    }

    const data = await res.json()
    const recipient = (data?.SMSMessageData?.Recipients ?? [])[0]
    return recipient?.status === 'Success'
      ? { ok: true }
      : { ok: false, error: `AT: ${recipient?.status ?? 'no recipient in response'}` }
  } catch (err: unknown) {
    const msg = (err as Error)?.name === 'AbortError'
      ? "Africa's Talking request timed out"
      : String(err)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

function sendOnce(
  phone: string, message: string, senderName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (SMS_PROVIDER === 'africastalking') return sendAfricasTalking(phone, message, senderName)
  return sendTwilio(phone, message, senderName)
}

function isRetryableError(err: string): boolean {
  const lower = err.toLowerCase()
  return lower.includes('timed out') ||
         lower.includes('network') ||
         lower.includes('timeout') ||
         lower.includes('fetch') ||
         lower.includes('econnreset')
}

async function sendSMS(
  phone: string, message: string, senderName?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  let lastError = 'Unknown error'
  for (let attempt = 0; attempt < SMS_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1_000 * Math.pow(2, attempt - 1)))
    }
    const result = await sendOnce(phone, message, senderName)
    if (result.ok) return result
    lastError = result.error ?? lastError
    if (!isRetryableError(lastError)) break
  }
  return { ok: false, error: lastError }
}

// ─── Template helpers ─────────────────────────────────────────────────────────

function sanitizeTemplateVar(value: string): string {
  return value.replace(/\{\{.*?\}\}/g, '').trim()
}

function renderTemplate(template: string, name: string, event: string): string {
  return template
    .replace(/\{\{name\}\}/g,  sanitizeTemplateVar(name))
    .replace(/\{\{event\}\}/g, sanitizeTemplateVar(event))
}

function currentHourIn(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date())
    const h = parts.find(p => p.type === 'hour')?.value
    return h != null ? parseInt(h, 10) : new Date().getUTCHours()
  } catch {
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`)
    return new Date().getUTCHours()
  }
}

function todayIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceRow  { id: string; unit_id: string; date: string; service_type: string }
interface SettingsRow {
  enabled: boolean
  message_template: string
  send_hour: number
  timezone: string
  sender_name: string | null
  cooldown_days: number
}
interface MemberRow {
  id: string
  name: string
  phone: string | null
  checked_in: boolean
  sms_consent: boolean | null
}

// ─── Core per-service logic ───────────────────────────────────────────────────

async function processService(
  supabase: ReturnType<typeof createClient>,
  service: ServiceRow,
  dryRun: boolean,
): Promise<{ sent: number; failed: number; skipped: number; blocked: number; reason?: string }> {

  // ── 1. Check messaging settings ────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('unit_messaging_settings')
    .select('enabled, message_template, send_hour, timezone, sender_name, cooldown_days')
    .eq('unit_id', service.unit_id)
    .maybeSingle() as { data: SettingsRow | null }

  if (!settings?.enabled) {
    return { sent: 0, failed: 0, skipped: 0, blocked: 0, reason: 'messaging not enabled for this unit' }
  }

  const tz = settings.timezone || 'UTC'
  const localToday = todayIn(tz)
  if (service.date !== localToday) {
    return { sent: 0, failed: 0, skipped: 0, blocked: 0, reason: `service date ${service.date} is not today (${localToday} in ${tz})` }
  }

  // ── 2. Billing check: resolve org_id from unit ─────────────────────────────
  // We need org_id to check/deduct SMS credits.
  const { data: unitRow } = await supabase
    .from('units')
    .select('org_id')
    .eq('id', service.unit_id)
    .single() as { data: { org_id: string } | null }

  if (!unitRow?.org_id) {
    return { sent: 0, failed: 0, skipped: 0, blocked: 0, reason: 'unit has no organisation' }
  }

  const orgId = unitRow.org_id

  // Check subscription is active (or trialing). Block if canceled/past_due.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('org_id', orgId)
    .maybeSingle() as { data: { status: string } | null }

  const subStatus = sub?.status ?? 'none'
  const subActive = subStatus === 'active' || subStatus === 'trialing'

  if (!subActive && !dryRun) {
    console.warn(`Blocked: org ${orgId} subscription status is "${subStatus}"`)
    return {
      sent: 0, failed: 0, skipped: 0, blocked: 0,
      reason: `subscription is not active (status: ${subStatus}) — subscribe at /admin/billing`,
    }
  }

  // ── 3. Fetch eligible members ──────────────────────────────────────────────
  const { data: members, error: membersErr } = await supabase
    .rpc('get_service_members_full', { p_service_id: service.id, p_limit: MAX_MEMBERS, p_offset: 0 })
  if (membersErr) throw new Error(`get_service_members_full: ${membersErr.message}`)

  let eligible = (members as MemberRow[]).filter(
    m => !m.checked_in && m.sms_consent === true && m.phone?.trim()
  )

  if (eligible.length === 0) {
    const allAbsent = (members as MemberRow[]).filter(m => !m.checked_in)
    const noConsent = allAbsent.filter(m => m.sms_consent !== true).length
    const noPhone   = allAbsent.filter(m => m.sms_consent === true && !m.phone?.trim()).length
    const reasons = []
    if (noConsent > 0) reasons.push(`${noConsent} without consent`)
    if (noPhone   > 0) reasons.push(`${noPhone} without phone`)
    return {
      sent: 0, failed: 0, skipped: 0, blocked: 0,
      reason: allAbsent.length === 0
        ? 'no absent members'
        : `no eligible absent members (${reasons.join(', ')})`,
    }
  }

  // ── 4. Apply cooldown window ───────────────────────────────────────────────
  const cooldown = settings.cooldown_days ?? 7
  if (cooldown > 0 && eligible.length > 0) {
    const cutoff = new Date(Date.now() - cooldown * 86_400_000).toISOString()
    const { data: recentRows } = await supabase
      .from('absence_message_log')
      .select('member_id')
      .eq('status', 'sent')
      .gte('sent_at', cutoff)
      .in('member_id', eligible.map(m => m.id))
    const cooledDownIds = new Set(
      ((recentRows ?? []) as { member_id: string }[]).map(r => r.member_id)
    )
    eligible = eligible.filter(m => !cooledDownIds.has(m.id))
    if (eligible.length === 0) {
      return { sent: 0, failed: 0, skipped: 0, blocked: 0, reason: `all eligible members are within the ${cooldown}-day cooldown window` }
    }
  }

  const eventName  = service.service_type || "today's event"
  const senderName = settings.sender_name?.trim() || null
  let sent = 0, failed = 0, skipped = 0, blocked = 0

  // ── 5. Send loop ───────────────────────────────────────────────────────────
  for (const member of eligible) {
    const message = renderTemplate(settings.message_template, member.name, eventName)

    if (dryRun) { sent++; continue }

    // ── BILLING: atomic credit deduction ────────────────────────────────────
    // deduct_sms_credit uses FOR UPDATE to prevent race conditions.
    // Returns false if balance is 0 — we stop sending and log the block.
    const { data: credited, error: creditErr } = await supabase
      .rpc('deduct_sms_credit', { p_org_id: orgId })

    if (creditErr) {
      console.error(`Credit deduction error for org ${orgId}:`, creditErr.message)
      // Treat DB errors as blocked to be safe — don't send without billing
      blocked++
      await logUsageEvent(supabase, orgId, service, member.id, 'sms_blocked')
      continue
    }

    if (!credited) {
      // Credits exhausted — block all remaining members in this batch
      blocked++
      await logUsageEvent(supabase, orgId, service, member.id, 'sms_blocked')
      console.warn(`Credits exhausted for org ${orgId} — ${eligible.length - sent - failed - skipped - blocked} members not sent`)
      // Continue loop to count all blocked members accurately
      continue
    }

    // ── Log-first atomic pattern: claim the log slot before sending ──────────
    const { data: logRow, error: insertErr } = await supabase
      .from('absence_message_log')
      .insert({
        service_id: service.id,
        member_id:  member.id,
        phone:      member.phone,
        message,
        status:     'pending',
        error_text: '',
      })
      .select('id')
      .single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        // Another concurrent invocation already claimed and is processing this member.
        // Refund the credit we just deducted since we won't be sending.
        await supabase.rpc('refund_sms_credit', { p_org_id: orgId })
        skipped++
        continue
      }
      // Unexpected DB error — refund the credit and move on
      await supabase.rpc('refund_sms_credit', { p_org_id: orgId })
      console.error(`Failed to claim log slot for member ${member.id}:`, insertErr.message)
      continue
    }

    // Send the SMS
    const result = await sendSMS(member.phone!, message, senderName)

    // Update log row with final status
    const { error: updateErr } = await supabase
      .from('absence_message_log')
      .update({
        status:     result.ok ? 'sent' : 'failed',
        error_text: result.error ?? '',
      })
      .eq('id', logRow.id)

    if (updateErr) {
      console.error(`Failed to update log for member ${member.id}:`, updateErr.message)
    }

    // Record in generic usage_events for billing audit trail
    await logUsageEvent(supabase, orgId, service, member.id, result.ok ? 'sms_sent' : 'sms_failed')

    if (result.ok) sent++; else failed++
  }

  return { sent, failed, skipped, blocked }
}

// ─── Usage event logger ───────────────────────────────────────────────────────

async function logUsageEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  service: ServiceRow,
  memberId: string,
  eventType: 'sms_sent' | 'sms_failed' | 'sms_blocked',
): Promise<void> {
  await supabase.from('usage_events').insert({
    org_id:     orgId,
    unit_id:    service.unit_id,
    service_id: service.id,
    member_id:  memberId,
    event_type: eventType,
    quantity:   1,
    metadata:   { provider: SMS_PROVIDER },
  })
  // Non-fatal: if this fails, we log to console but don't abort the send
}

// ─── Request handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const authHeader = req.headers.get('Authorization') ?? ''

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const bearerToken    = authHeader.replace(/^Bearer\s+/i, '').trim()
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const isServiceRole  = serviceRoleKey.length > 0 && bearerToken === serviceRoleKey

  try {
    const body = await req.json() as {
      service_id?: string
      scheduled?:  boolean
      dry_run?:    boolean
    }
    const dryRun = body.dry_run ?? false

    // Validate SMS secrets only when we will actually send (skip for dry runs)
    if (!dryRun) {
      const secretsError = validateSecrets()
      if (secretsError) {
        console.error('SMS configuration error:', secretsError)
        return json(503, { error: `SMS provider not configured: ${secretsError}` })
      }
    }

    // ── Manual single-service send ─────────────────────────────────────────
    if (body.service_id) {
      if (!isServiceRole) {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        )
        const { data: { user }, error: authErr } = await userClient.auth.getUser()
        if (authErr || !user) return json(401, { error: 'Unauthenticated' })

        const { data: allowed } = await userClient
          .rpc('is_org_admin_by_service', { p_service_id: body.service_id })
        if (!allowed) return json(403, { error: 'You do not have permission for this service' })
      }

      const { data: service, error: svcErr } = await adminClient
        .from('services')
        .select('id, unit_id, date, service_type')
        .eq('id', body.service_id)
        .single() as { data: ServiceRow | null; error: unknown }

      if (svcErr || !service) return json(404, { error: 'Service not found' })

      const result = await processService(adminClient, service, dryRun)
      return json(200, { ...result, dry_run: dryRun })
    }

    // ── Scheduled (pg_cron) ───────────────────────────────────────────────
    if (body.scheduled) {
      if (!isServiceRole) {
        return json(401, { error: 'Scheduled mode requires service-role key' })
      }

      const { data: rows, error: rowsErr } = await adminClient
        .from('services')
        .select(`
          id, unit_id, date, service_type,
          unit_messaging_settings!inner(enabled, send_hour, timezone)
        `)
        .eq('unit_messaging_settings.enabled', true)

      if (rowsErr) return json(500, { error: rowsErr.message })

      const results: Record<string, unknown> = {}

      for (const row of (rows ?? []) as (ServiceRow & {
        unit_messaging_settings: SettingsRow[]
      })[]) {
        const cfg = row.unit_messaging_settings?.[0]
        if (!cfg) continue

        const tz = cfg.timezone || 'UTC'
        if (row.date !== todayIn(tz)) continue

        const localHour = currentHourIn(tz)
        if (localHour < cfg.send_hour) continue

        const { count } = await adminClient
          .from('absence_message_log')
          .select('id', { count: 'exact', head: true })
          .eq('service_id', row.id)
        if ((count ?? 0) > 0) continue

        results[row.id] = await processService(adminClient, row, dryRun)
      }

      return json(200, { processed: Object.keys(results).length, results, dry_run: dryRun })
    }

    return json(400, { error: 'Provide service_id (manual) or scheduled: true (cron)' })

  } catch (err) {
    console.error('send-absence-sms error:', err)
    return json(500, { error: String(err) })
  }
})

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
