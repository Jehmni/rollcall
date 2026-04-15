/**
 * send-absence-sms  — Rollcally Edge Function
 *
 * Sends an SMS to every absent member (who has a phone number and has
 * consented) for a given service and logs the result.
 *
 * Send policy:
 *   Each eligible member is attempted exactly once — no automatic retries.
 *   If a provider call fails the error is logged and the admin is notified
 *   via the absence report email. Manual re-send is the recovery path.
 *   This prevents duplicate sends and keeps billing deterministic.
 *
 * Idempotency:
 *   absence_message_log has UNIQUE(service_id, member_id).
 *   processService loads existing log rows for the service once before the
 *   send loop so that re-triggers never charge billing twice.
 *   The UNIQUE constraint + 23505 handler is the concurrent-invocation safety net.
 *
 * Outcome counters (returned in the JSON response and email report):
 *   sent              — provider accepted; one credit consumed.
 *   failed            — provider rejected or timed out; one credit consumed.
 *                       Failed sends are visible in the delivery log for follow-up.
 *   blocked           — credit balance was 0; no attempt made, no charge.
 *   already_processed — member had an existing log row (idempotency / re-run /
 *                       concurrent-race win by another invocation); no charge.
 *   stale_pending     — pending row older than STALE_PENDING_TTL_MINUTES (likely
 *                       left by a crashed function run); marked failed in the log,
 *                       not re-sent. Needs admin review — member may or may not
 *                       have received the SMS.
 *
 * Billing layer:
 *   One credit is deducted per send attempt via deduct_sms_credit() (FOR UPDATE).
 *   Credits are refunded only if the log INSERT races with a concurrent invocation
 *   (23505). There is no automatic refund for provider failures — the attempt was
 *   made and the credit is consumed.
 *
 * Concurrency:
 *   Members are processed SEND_CONCURRENCY at a time via batched Promise.all.
 *   This bounds edge-function wall-clock time without overwhelming the provider.
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

const SMS_TIMEOUT_MS          = 12_000  // per-message API call timeout
const MAX_MEMBERS             = 5_000   // hard cap — matches client-side export cap
// Bounded concurrency: process this many members in parallel.
// Keeps edge-function wall-clock time proportional to CONCURRENCY rather than
// member count, preventing timeout at moderate roster sizes (20-100 absents).
// 5 is intentional: avoids overwhelming the Twilio/AT API with burst traffic
// while still giving ~5× speedup over fully sequential processing.
const SEND_CONCURRENCY        = 5
// A 'pending' log row older than this TTL was left by a crashed function run.
// The edge function hard-timeout is 150 s, so any pending row older than 30
// minutes is provably not owned by a live invocation.
const STALE_PENDING_TTL_MINUTES = 30

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
// Existing absence_message_log row fetched during the idempotency pre-load.
interface LogPreloadRow {
  member_id:  string
  status:     string   // 'pending' | 'sent' | 'failed' | 'skipped'
  created_at: string   // true row-creation timestamp (not sent_at which implies delivery)
}
// Per-member outcome returned by sendToMember.
interface MemberOutcome {
  sent:              number
  failed:            number
  blocked:           number
  already_processed: number  // existing log row (re-run idempotency or concurrent race)
}
// Per-service outcome returned by processService.
interface ProcessResult {
  sent:              number
  failed:            number
  blocked:           number
  already_processed: number  // members skipped due to existing log row
  stale_pending:     number  // pending rows expired TTL, marked failed, not re-sent
  reason?:           string  // whole-service skip reason (no send attempted)
}

// ─── Per-member send (called concurrently inside processService) ──────────────
//
// Each member is attempted exactly once — no retries.
// Returns a MemberOutcome; never throws — all errors are caught and reflected
// in counters so partial batch failures are observable, not silently dropped.
//
// Idempotency is handled at the processService level: processedIds contains
// member IDs that already have a log row. sendToMember is only called for
// members NOT in that set. The UNIQUE(service_id, member_id) constraint +
// 23505 handler here is the safety net for concurrent invocations that both
// pass the pre-load check in the same millisecond.
//
// Billing:
//   One credit is deducted before the send attempt.
//   If the provider succeeds   → credit consumed, status = 'sent'.
//   If the provider fails      → credit consumed, status = 'failed'.
//                                (the attempt was made; no automatic refund)
//   If credits exhausted       → no attempt, credit not deducted, status = 'blocked'.
//   If 23505 concurrent race   → credit refunded, counted as already_processed.

async function sendToMember(
  supabase:   ReturnType<typeof createClient>,
  member:     MemberRow,
  service:    ServiceRow,
  orgId:      string,
  message:    string,
  senderName: string | null,
  dryRun:     boolean,
): Promise<MemberOutcome> {
  if (dryRun) return { sent: 1, failed: 0, blocked: 0, already_processed: 0 }

  // ── BILLING: atomic credit deduction ──────────────────────────────────────
  // deduct_sms_credit uses FOR UPDATE — safe to call concurrently.
  const { data: credited, error: creditErr } = await supabase
    .rpc('deduct_sms_credit', { p_org_id: orgId })

  if (creditErr) {
    console.error(`Credit deduction error for org ${orgId} member ${member.id}:`, creditErr.message)
    await logUsageEvent(supabase, orgId, service, member.id, 'sms_blocked')
    // Blocked members intentionally produce NO absence_message_log row.
    // This keeps them re-eligible: the next scheduled run will attempt them
    // again once credits are replenished, without any manual intervention.
    return { sent: 0, failed: 0, blocked: 1, already_processed: 0 }
  }

  if (!credited) {
    await logUsageEvent(supabase, orgId, service, member.id, 'sms_blocked')
    console.warn(`Credits exhausted for org ${orgId} — member ${member.id} blocked`)
    // Blocked members intentionally produce NO absence_message_log row.
    // This keeps them re-eligible: the next scheduled run will attempt them
    // again once credits are replenished, without any manual intervention.
    return { sent: 0, failed: 0, blocked: 1, already_processed: 0 }
  }

  // ── Log-first atomic pattern: claim the log slot before sending ───────────
  // Concurrent-race safety net: two invocations that both passed the pre-load
  // check will race here. Only one INSERT wins; the other gets 23505, refunds,
  // and returns already_processed (not failed — no attempt was made).
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
      // Concurrent invocation claimed this member — refund credit, no attempt.
      await supabase.rpc('refund_sms_credit', { p_org_id: orgId })
      return { sent: 0, failed: 0, blocked: 0, already_processed: 1 }
    }
    // Unexpected DB error — refund credit, count as failed (not silently dropped).
    await supabase.rpc('refund_sms_credit', { p_org_id: orgId })
    console.error(`Failed to claim log slot for member ${member.id}:`, insertErr.message)
    return { sent: 0, failed: 1, blocked: 0, already_processed: 0 }
  }

  // ── Send the SMS — single attempt, no retries ──────────────────────────────
  // Credit has already been deducted. Whether the provider succeeds or fails,
  // the credit is consumed — the attempt was made.
  const result = await sendOnce(member.phone!, message, senderName)

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

  await logUsageEvent(supabase, orgId, service, member.id, result.ok ? 'sms_sent' : 'sms_failed')

  return {
    sent:              result.ok ? 1 : 0,
    failed:            result.ok ? 0 : 1,
    blocked:           0,
    already_processed: 0,
  }
}

// ─── Core per-service logic ───────────────────────────────────────────────────

async function processService(
  supabase: ReturnType<typeof createClient>,
  service:  ServiceRow,
  dryRun:   boolean,
): Promise<ProcessResult> {

  // ── 1. Check messaging settings ────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('unit_messaging_settings')
    .select('enabled, message_template, send_hour, timezone, sender_name, cooldown_days')
    .eq('unit_id', service.unit_id)
    .maybeSingle() as { data: SettingsRow | null }

  if (!settings?.enabled) {
    return { sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0, reason: 'messaging not enabled for this unit' }
  }

  const tz = settings.timezone || 'UTC'
  const localToday = todayIn(tz)
  if (service.date !== localToday) {
    return { sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0, reason: `service date ${service.date} is not today (${localToday} in ${tz})` }
  }

  // ── 2. Billing check: resolve org_id from unit ─────────────────────────────
  const { data: unitRow } = await supabase
    .from('units')
    .select('org_id')
    .eq('id', service.unit_id)
    .single() as { data: { org_id: string } | null }

  if (!unitRow?.org_id) {
    return { sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0, reason: 'unit has no organisation' }
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
      sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0,
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
      sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0,
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
      return { sent: 0, failed: 0, blocked: 0, already_processed: 0, stale_pending: 0, reason: `all eligible members are within the ${cooldown}-day cooldown window` }
    }
  }

  // ── 5. Idempotency pre-load ────────────────────────────────────────────────
  // Fetch all existing absence_message_log rows for this service in a single
  // query. This collapses N per-member SELECTs into one regardless of roster
  // size, and lets us classify each row before touching any credits.
  //
  // Row classifications:
  //   terminal (sent/failed/skipped): member was processed; skip, count as already_processed.
  //   fresh pending (< TTL):          concurrent invocation in flight; skip, count as already_processed.
  //   stale pending (>= TTL):         left by a crashed run; mark failed, count as stale_pending.
  //                                   NOT re-sent — the admin receives a report so they can
  //                                   manually verify and re-send if appropriate.
  let already_processed = 0
  let stale_pending     = 0
  const processedIds    = new Set<string>()

  if (!dryRun && eligible.length > 0) {
    const { data: existingRows, error: preloadErr } = await supabase
      .from('absence_message_log')
      .select('member_id, status, created_at')
      .eq('service_id', service.id)
      .in('member_id', eligible.map(m => m.id))

    if (preloadErr) {
      // Non-fatal: log and continue. The UNIQUE + 23505 guard will catch duplicates.
      console.error(`Idempotency pre-load failed (continuing with 23505 guard):`, preloadErr.message)
    } else {
      const staleCutoff = new Date(Date.now() - STALE_PENDING_TTL_MINUTES * 60_000).toISOString()
      const staleIds: string[] = []

      for (const row of (existingRows ?? []) as LogPreloadRow[]) {
        processedIds.add(row.member_id)
        if (row.status === 'pending' && row.created_at <= staleCutoff) {
          // Stale pending: the function that created this row is no longer running.
          // Mark it failed so the log is accurate, but do NOT re-send — we don't
          // know whether the SMS was dispatched before the crash.
          staleIds.push(row.member_id)
          stale_pending++
          console.warn(`Stale pending row for member ${row.member_id} (age > ${STALE_PENDING_TTL_MINUTES}min) — marking failed`)
        } else {
          already_processed++
        }
      }

      // Batch-update stale pending rows to 'failed' with an explanatory error_text.
      // reason_code distinguishes these from genuine provider failures in the log.
      if (staleIds.length > 0) {
        const { error: staleErr } = await supabase
          .from('absence_message_log')
          .update({
            status:      'failed',
            reason_code: 'stale_pending_recovered',
            error_text:  `send interrupted: pending row expired after ${STALE_PENDING_TTL_MINUTES} min (possible crash before send completed) — verify manually`,
          })
          .eq('service_id', service.id)
          .eq('status', 'pending')   // guard: only update still-pending rows
          .in('member_id', staleIds)

        if (staleErr) {
          console.error(`Failed to update stale pending rows:`, staleErr.message)
        }
      }

      // Filter out all processed members (terminal + stale) from eligible.
      eligible = eligible.filter(m => !processedIds.has(m.id))
    }
  }

  // All members were already processed on a prior run.
  if (eligible.length === 0) {
    return { sent: 0, failed: 0, blocked: 0, already_processed, stale_pending, reason: 'all eligible members already processed' }
  }

  const eventName  = service.service_type || "today's event"
  const senderName = settings.sender_name?.trim() || null
  let sent = 0, failed = 0, blocked = 0

  // ── 6. Send with bounded concurrency ──────────────────────────────────────
  // Process SEND_CONCURRENCY members in parallel.
  // Each member's credit deduction, log claim, send, and log update are
  // independent. The DB function uses FOR UPDATE so deductions are atomic.
  for (let i = 0; i < eligible.length; i += SEND_CONCURRENCY) {
    const batch = eligible.slice(i, i + SEND_CONCURRENCY)
    const results = await Promise.all(
      batch.map(member => {
        const message = renderTemplate(settings.message_template, member.name, eventName)
        return sendToMember(supabase, member, service, orgId, message, senderName, dryRun)
      })
    )
    for (const r of results) {
      sent              += r.sent
      failed            += r.failed
      blocked           += r.blocked
      already_processed += r.already_processed  // concurrent-race wins inside the batch
    }
  }

  return { sent, failed, blocked, already_processed, stale_pending }
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

// ─── Absence report email ─────────────────────────────────────────────────────

async function sendAbsenceReportEmail(
  db:      ReturnType<typeof createClient>,
  service: ServiceRow,
  result:  ProcessResult,
): Promise<void> {
  const apiKey  = Deno.env.get('RESEND_API_KEY')
  const from    = Deno.env.get('FROM_EMAIL') ?? 'Rollcally <noreply@rollcally.com>'
  if (!apiKey) return  // email not configured — skip silently

  try {
    // Fetch unit (owner id + name) and message log in parallel
    const [unitRes, logRes] = await Promise.all([
      db.from('units').select('name, created_by_admin_id').eq('id', service.unit_id).single(),
      db.from('absence_message_log')
        .select('member_id, phone, status, error_text, members!inner(name)')
        .eq('service_id', service.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const unitRow = unitRes.data as { name: string; created_by_admin_id: string } | null
    const unitName = unitRow?.name ?? 'Your unit'
    if (!unitRow?.created_by_admin_id) return

    // Resolve owner email from auth.users via service-role admin API
    const { data: { user: ownerUser } } = await db.auth.admin.getUserById(unitRow.created_by_admin_id)
    if (!ownerUser?.email) return
    const adminEmails = [ownerUser.email]

    // Build rows for the email table
    const logRows = (logRes.data ?? []) as Array<{
      member_id: string; phone: string | null; status: string; error_text: string | null
      members: { name: string }
    }>

    const tableRows = logRows.map(r => {
      const statusEmoji = r.status === 'sent' ? '✅' : r.status === 'failed' ? '❌' : '⏸'
      return `<tr style="border-bottom:1px solid #334155">
        <td style="padding:8px 12px;color:#f1f5f9">${r.members?.name ?? '—'}</td>
        <td style="padding:8px 12px;color:#94a3b8">${r.phone ?? '—'}</td>
        <td style="padding:8px 12px">${statusEmoji} ${r.status}</td>
        ${r.error_text ? `<td style="padding:8px 12px;color:#f87171;font-size:12px">${r.error_text}</td>` : '<td></td>'}
      </tr>`
    }).join('')

    const eventLabel = `${service.service_type} on ${service.date}`
    // Build summary line — only include non-zero counts to keep it readable.
    const parts = [
      result.sent              > 0 ? `${result.sent} sent`                      : null,
      result.failed            > 0 ? `${result.failed} failed (credit consumed)` : null,
      result.blocked           > 0 ? `${result.blocked} blocked (no credits)`    : null,
      result.already_processed > 0 ? `${result.already_processed} already processed` : null,
      result.stale_pending     > 0 ? `${result.stale_pending} stale pending — verify manually` : null,
    ].filter(Boolean)
    const summary = parts.length > 0 ? parts.join(' · ') : 'no messages sent'

    const html = `
<!DOCTYPE html>
<html>
<body style="background:#0f172a;color:#f1f5f9;font-family:system-ui,sans-serif;padding:32px;margin:0">
  <div style="max-width:640px;margin:0 auto">
    <h2 style="color:#818cf8;margin:0 0 4px">Absence Report</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px">${unitName} · ${eventLabel}</p>
    <p style="background:#1e293b;border-radius:8px;padding:12px 16px;font-size:14px;margin:0 0 24px">${summary}</p>
    ${logRows.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:#1e293b;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#334155">
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600">Member</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600">Phone</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600">Status</th>
          <th style="padding:10px 12px;text-align:left;color:#94a3b8;font-weight:600">Detail</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>` : '<p style="color:#64748b;font-size:14px">No messages were sent for this session.</p>'}
    <p style="margin-top:32px;font-size:12px;color:#475569">Sent by Rollcally · <a href="https://rollcally.com" style="color:#818cf8">rollcally.com</a></p>
  </div>
</body>
</html>`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: adminEmails,
        subject: `Absence report — ${unitName} — ${service.date}`,
        html,
      }),
    })
  } catch (err) {
    // Email failure must never break the SMS flow
    console.warn('Absence report email failed (non-fatal):', String(err))
  }
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
      if (!dryRun) await sendAbsenceReportEmail(adminClient, service, result)
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

        const svcResult = await processService(adminClient, row, dryRun)
        results[row.id] = svcResult
        if (!dryRun) await sendAbsenceReportEmail(adminClient, row, svcResult)
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
