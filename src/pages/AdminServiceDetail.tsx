import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { useToast } from '../contexts/ToastContext'
import type { AbsenceMessageLogEntry, DashboardMember, Service, UnitMessagingSettings } from '../types'

// ─── Location Toggle ─────────────────────────────────────────────────────────

function LocationToggle({ service, onUpdate }: { service: Service; onUpdate: (updated: Service) => void }) {
  const [saving, setSaving] = useState(false)

  async function toggle() {
    setSaving(true)
    const { data, error } = await supabase
      .from('services')
      .update({ require_location: !service.require_location })
      .eq('id', service.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) onUpdate(data as Service)
  }

  const on = service.require_location

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] disabled:opacity-40 ${on ? 'bg-primary/10 border-primary/30' : 'bg-surface-dark border-border-dark hover:border-slate-600'}`}
    >
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-2xl ${on ? 'text-primary-light' : 'text-slate-500'}`}>
          {on ? 'location_on' : 'location_off'}
        </span>
        <div className="text-left">
          <p className={`text-sm font-bold ${on ? 'text-white' : 'text-slate-400'}`}>
            {on ? 'In-person — Location enforced' : 'Online — No location check'}
          </p>
          <p className="text-2xs text-slate-500 font-medium">
            {on ? 'Members must be on-site to check in' : 'Members can check in from anywhere'}
          </p>
        </div>
      </div>
      <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${on ? 'bg-primary' : 'bg-border-dark'}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
      </div>
    </button>
  )
}

// ─── Go Live Button ───────────────────────────────────────────────────────────

function GoLiveButton({ service }: { service: Service }) {
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(
    service.notification_sent_at
      ? new Date(service.notification_sent_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : null
  )
  const [subCount, setSubCount] = useState(0)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('member_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', service.unit_id)
      .then(({ count }) => setSubCount(count ?? 0))
  }, [service.unit_id])

  async function goLive() {
    setSending(true)
    setSendError(null)
    try {
      const { error } = await supabase.functions.invoke('send-push', {
        body: { service_id: service.id, unit_id: service.unit_id },
      })
      if (error) {
        setSendError(error.message ?? 'Failed to send notifications. Check that VAPID secrets are set in Supabase.')
      } else {
        const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        setSentAt(now)
      }
    } catch (err: unknown) {
      setSendError((err as { message?: string })?.message ?? 'Unexpected error sending notifications.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {sentAt ? (
        <div className="rounded-xl bg-surface-dark border border-emerald-500/20 px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">cell_tower</span>
            <div>
              <p className="text-sm font-bold text-white">Notified at {sentAt}</p>
              <p className="text-2xs text-slate-500 font-medium">Members were sent a push notification</p>
            </div>
          </div>
          <button
            onClick={goLive}
            disabled={sending}
            className="text-2xs font-black uppercase tracking-spaced text-emerald-400 hover:text-white transition-colors disabled:opacity-40"
          >
            Re-send
          </button>
        </div>
      ) : (
        <button
          onClick={goLive}
          disabled={sending || subCount === 0}
          className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/40 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl group-disabled:text-slate-500">cell_tower</span>
            <div className="text-left">
              <p className="text-sm font-bold text-white">
                {sending ? 'Sending notifications…' : 'Notify Members — Go Live'}
              </p>
              <p className="text-2xs text-slate-500 font-medium">
                {subCount === 0 ? 'No subscribers yet — members opt in after check-in' : `${subCount} subscriber${subCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-primary text-xl group-disabled:text-slate-600">chevron_right</span>
        </button>
      )}
      {sendError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2.5">
          <span className="material-symbols-outlined text-red-400 text-base mt-0.5 flex-shrink-0">error</span>
          <p className="text-xs text-red-400 font-medium">{sendError}</p>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#5247e6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function getInitials(name: string) { return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() }


function formatTime(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase()
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

/** Timestamp suffix for unique filenames: YYYY-MM-DD_HH-MM */
function fileTimestamp(): string {
  return new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-').replace(':', '-')
}

/** Escape RTF special characters so member names never corrupt the document. */
function escapeRTF(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

function exportTXT(members: DashboardMember[], label: string) {
  const rule = '─'.repeat(66)
  const lines = [
    rule,
    `  ABSENCE REPORT — ${label}`,
    rule,
    `  Generated  : ${new Date().toLocaleString('en-GB')}`,
    `  Total absent : ${members.length}`,
    rule,
    '',
    `  ${'#'.padStart(2)}  ${'Name'.padEnd(32)}${'Section'.padEnd(14)}Phone`,
    `  ${'─'.repeat(62)}`,
    ...members.map((m, i) =>
      `  ${String(i + 1).padStart(2)}.  ${m.name.padEnd(32)}${(m.section ?? '—').padEnd(14)}${m.phone ?? '—'}`,
    ),
    '',
    rule,
  ]
  triggerDownload(lines.join('\n'), `absent-${label}_${fileTimestamp()}.txt`, 'text/plain;charset=utf-8')
}

function exportCSV(members: DashboardMember[], label: string) {
  // No BOM — UTF-8 without BOM is standard and works correctly in Google Sheets and modern Excel
  const rows: string[][] = [
    [`Absence Report — ${label}`],
    [`Generated: ${new Date().toLocaleString('en-GB')}`],
    [`Total absent: ${members.length}`],
    [],
    ['#', 'Name', 'Section', 'Phone'],
    ...members.map((m, i) => [String(i + 1), m.name, m.section ?? '', m.phone ?? '']),
  ]
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  triggerDownload(csv, `absent-${label}_${fileTimestamp()}.csv`, 'text/csv;charset=utf-8')
}

function exportRTF(members: DashboardMember[], label: string) {
  const generated = new Date().toLocaleString('en-GB')
  const colX = [540, 3960, 5760, 8160]
  function rtfRow(cells: string[], isHeader = false) {
    const defs = colX.map(x => `\\cellx${x}`).join('')
    const content = cells.map(c => {
      const bold = isHeader ? '\\b ' : ''
      const bg   = isHeader ? '\\clshdng10000\\clcfpat2 ' : ''
      return `${bg}\\pard\\intbl\\ql ${bold}\\f0\\fs20 ${escapeRTF(c)}\\cell`
    })
    return `{\\trowd\\trgaph108${defs}${content.join('')}\\row}`
  }
  const tableRows = [
    rtfRow(['#', 'Name', 'Section', 'Phone'], true),
    ...members.map((m, i) => rtfRow([String(i + 1), m.name, m.section ?? '—', m.phone ?? '—'])),
  ].join('\n')
  const rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0
{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}
{\\colortbl ;\\red255\\green255\\blue255;\\red29\\green78\\blue216;}
\\margl1440\\margr1440\\margt1440\\margb1440
{\\pard\\f0\\fs32\\b\\cf2 Absence Report\\par}
{\\pard\\f0\\fs24\\b ${escapeRTF(label)}\\par}
{\\pard\\f0\\fs20 Generated: ${escapeRTF(generated)}\\par}
{\\pard\\f0\\fs20 Total absent: ${members.length}\\par}
\\par
${tableRows}
}`
  triggerDownload(rtf, `absent-${label}_${fileTimestamp()}.rtf`, 'application/rtf')
}

type Tab = 'all' | 'present' | 'absent'

function groupBySection(members: DashboardMember[]): Record<string, DashboardMember[]> {
  const sections = [...new Set(members.map(m => m.section ?? ''))].sort()
  return sections.reduce<Record<string, DashboardMember[]>>((acc, s) => {
    acc[s] = members.filter(m => (m.section ?? '') === s)
    return acc
  }, {})
}

// ─── Messaging Panel ──────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE =
  'Hi {{name}}, we missed you at {{event}} today. Hope all is well — we look forward to seeing you next time! 🙏'

const SEND_HOUR_OPTIONS = [
  { value: 12, label: '12:00 noon' },
  { value: 13, label: '1:00 pm' },
  { value: 14, label: '2:00 pm' },
  { value: 15, label: '3:00 pm' },
  { value: 16, label: '4:00 pm' },
  { value: 17, label: '5:00 pm' },
  { value: 18, label: '6:00 pm (default)' },
  { value: 19, label: '7:00 pm' },
  { value: 20, label: '8:00 pm' },
  { value: 21, label: '9:00 pm' },
]

// Curated global timezone list — covers ~95% of users worldwide
const TIMEZONE_OPTIONS = [
  { group: 'Africa',    value: 'Africa/Lagos',                    label: 'Lagos / Abuja (WAT, UTC+1)' },
  { group: 'Africa',    value: 'Africa/Johannesburg',             label: 'Johannesburg / Cape Town (SAST, UTC+2)' },
  { group: 'Africa',    value: 'Africa/Nairobi',                  label: 'Nairobi / Kampala (EAT, UTC+3)' },
  { group: 'Africa',    value: 'Africa/Accra',                    label: 'Accra / Dakar (GMT, UTC+0)' },
  { group: 'Africa',    value: 'Africa/Cairo',                    label: 'Cairo (EET, UTC+2)' },
  { group: 'Americas',  value: 'America/New_York',                label: 'New York / Eastern (ET)' },
  { group: 'Americas',  value: 'America/Chicago',                 label: 'Chicago / Central (CT)' },
  { group: 'Americas',  value: 'America/Denver',                  label: 'Denver / Mountain (MT)' },
  { group: 'Americas',  value: 'America/Los_Angeles',             label: 'Los Angeles / Pacific (PT)' },
  { group: 'Americas',  value: 'America/Toronto',                 label: 'Toronto / Eastern Canada' },
  { group: 'Americas',  value: 'America/Vancouver',               label: 'Vancouver / Pacific Canada' },
  { group: 'Americas',  value: 'America/Sao_Paulo',               label: 'São Paulo / Brasília (BRT, UTC-3)' },
  { group: 'Americas',  value: 'America/Argentina/Buenos_Aires',  label: 'Buenos Aires (ART, UTC-3)' },
  { group: 'Americas',  value: 'America/Bogota',                  label: 'Bogotá / Lima (COT, UTC-5)' },
  { group: 'Americas',  value: 'America/Mexico_City',             label: 'Mexico City (CST, UTC-6)' },
  { group: 'Europe',    value: 'Europe/London',                   label: 'London (GMT/BST)' },
  { group: 'Europe',    value: 'Europe/Paris',                    label: 'Paris / Berlin / Rome (CET/CEST)' },
  { group: 'Europe',    value: 'Europe/Moscow',                   label: 'Moscow (MSK, UTC+3)' },
  { group: 'Europe',    value: 'Europe/Istanbul',                 label: 'Istanbul (TRT, UTC+3)' },
  { group: 'Asia',      value: 'Asia/Dubai',                      label: 'Dubai / Abu Dhabi (GST, UTC+4)' },
  { group: 'Asia',      value: 'Asia/Karachi',                    label: 'Karachi (PKT, UTC+5)' },
  { group: 'Asia',      value: 'Asia/Kolkata',                    label: 'Mumbai / Delhi (IST, UTC+5:30)' },
  { group: 'Asia',      value: 'Asia/Dhaka',                      label: 'Dhaka (BST, UTC+6)' },
  { group: 'Asia',      value: 'Asia/Bangkok',                    label: 'Bangkok / Jakarta (ICT, UTC+7)' },
  { group: 'Asia',      value: 'Asia/Singapore',                  label: 'Singapore / KL (SGT, UTC+8)' },
  { group: 'Asia',      value: 'Asia/Shanghai',                   label: 'Beijing / Shanghai (CST, UTC+8)' },
  { group: 'Asia',      value: 'Asia/Tokyo',                      label: 'Tokyo (JST, UTC+9)' },
  { group: 'Asia',      value: 'Asia/Seoul',                      label: 'Seoul (KST, UTC+9)' },
  { group: 'Oceania',   value: 'Australia/Sydney',                label: 'Sydney / Melbourne (AEST/AEDT)' },
  { group: 'Oceania',   value: 'Pacific/Auckland',                label: 'Auckland (NZST/NZDT)' },
  { group: 'UTC',       value: 'UTC',                             label: 'UTC (Coordinated Universal Time)' },
]

const LOG_PAGE_SIZE = 50

function MessagingPanel({ service, absentMembers }: { service: Service; absentMembers: DashboardMember[] }) {
  const { toast } = useToast()

  const [open, setOpen]               = useState(false)
  const [settings, setSettings]       = useState<UnitMessagingSettings | null>(null)
  const [log, setLog]                 = useState<AbsenceMessageLogEntry[]>([])
  const [logHasMore, setLogHasMore]   = useState(false)
  const [logLoading, setLogLoading]   = useState(false)
  const [template, setTemplate]       = useState(DEFAULT_TEMPLATE)
  const [sendHour, setSendHour]       = useState(18)
  const [timezone, setTimezone]       = useState('UTC')
  const [senderName, setSenderName]   = useState('')
  const [cooldownDays, setCooldownDays] = useState(7)
  const [saving, setSaving]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const sendingRef                    = useRef(false) // CRITICAL-6: ref guard against double-fire

  // CRITICAL-1 + MEDIUM-17: load settings and populate all local state from DB
  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('unit_messaging_settings')
      .select('*')
      .eq('unit_id', service.unit_id)
      .maybeSingle()
    if (data) {
      const s = data as UnitMessagingSettings
      setSettings(s)
      setTemplate(s.message_template)
      // LOW-21: clamp send_hour to valid range in case DB has a stale value
      setSendHour(Math.min(21, Math.max(12, s.send_hour)))
      setTimezone(s.timezone || 'UTC')
      setSenderName(s.sender_name ?? '')
      setCooldownDays(Math.min(90, Math.max(0, s.cooldown_days ?? 7)))
    }
  }, [service.unit_id])

  // HIGH-8: paginated delivery log, LOW-20: secondary sort by id
  const loadLog = useCallback(async (reset = true) => {
    setLogLoading(true)
    try {
      const offset = reset ? 0 : log.length
      const { data, error } = await supabase
        .from('absence_message_log')
        .select('*')
        .eq('service_id', service.id)
        .order('sent_at', { ascending: false })
        .order('id',      { ascending: false })
        .range(offset, offset + LOG_PAGE_SIZE - 1)
      if (error) throw error
      const rows = (data ?? []) as AbsenceMessageLogEntry[]
      setLog(prev => reset ? rows : [...prev, ...rows])
      setLogHasMore(rows.length === LOG_PAGE_SIZE)
    } finally {
      setLogLoading(false)
    }
  }, [service.id, log.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSettings(); loadLog(true) }, [loadSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  // Validate sender name: 1-11 chars, must start with a letter, alphanumeric + spaces
  function senderNameError(value: string): string | null {
    const v = value.trim()
    if (!v) return null  // empty is fine — falls back to phone number
    if (v.length > 11) return 'Max 11 characters'
    if (!/^[A-Za-z]/.test(v)) return 'Must start with a letter'
    if (!/^[A-Za-z0-9 ]+$/.test(v)) return 'Letters, numbers and spaces only'
    return null
  }

  function buildUpsertPayload(enabled: boolean) {
    return {
      unit_id:          service.unit_id,
      enabled,
      message_template: template,
      send_hour:        sendHour,
      timezone,
      sender_name:      senderName.trim() || null,
      cooldown_days:    cooldownDays,
      updated_at:       new Date().toISOString(),
    }
  }

  async function toggleEnabled() {
    const newEnabled = !(settings?.enabled ?? false)
    const { data, error } = await supabase
      .from('unit_messaging_settings')
      .upsert(buildUpsertPayload(newEnabled))
      .select()
      .single()
    if (error) {
      toast(`Failed to update: ${error.message}`, 'error')
      return
    }
    if (data) setSettings(data as UnitMessagingSettings)
  }

  async function saveSettings() {
    const nameErr = senderNameError(senderName)
    if (nameErr) { toast(`Sender name: ${nameErr}`, 'error'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('unit_messaging_settings')
        .upsert(buildUpsertPayload(settings?.enabled ?? false))
        .select()
        .single()
      if (error) throw error
      if (data) setSettings(data as UnitMessagingSettings)
      toast('Settings saved', 'success')
    } catch (err: unknown) {
      toast(`Failed to save: ${(err as { message?: string })?.message ?? String(err)}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendNow() {
    // CRITICAL-6: ref guard — prevents double-fire before React re-render disables the button
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-absence-sms', {
        body: { service_id: service.id },
      })
      if (error) throw error
      await loadLog(true)
      const r = data as { sent?: number; failed?: number; skipped?: number; reason?: string }
      if (r.reason) {
        toast(`Nothing sent: ${r.reason}`, 'info')
      } else {
        toast(`Done — ${r.sent ?? 0} sent · ${r.failed ?? 0} failed · ${r.skipped ?? 0} already sent`, 'success')
      }
    } catch (err: unknown) {
      toast(`Send failed: ${(err as { message?: string })?.message ?? String(err)}`, 'error')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const enabled      = settings?.enabled ?? false
  const sentCount    = log.filter(l => l.status === 'sent').length
  const failedCount  = log.filter(l => l.status === 'failed').length
  const skippedCount = log.filter(l => l.status === 'skipped').length

  // Reachability breakdown across absent members
  const absentNoPhone     = absentMembers.filter(m => !m.phone?.trim()).length
  const absentNoConsent   = absentMembers.filter(m => m.phone?.trim() && m.sms_consent !== true).length
  const absentEligible    = absentMembers.filter(m => m.phone?.trim() && m.sms_consent === true).length

  // MEDIUM-16: use a real absent member name in preview, not a hardcoded placeholder
  const previewName = absentMembers[0]?.name ?? 'A member'
  const previewMsg  = renderMsgPreview(template, previewName, service.service_type || 'Rehearsal')

  // Group timezone options by continent for the <optgroup> select
  const tzGroups = TIMEZONE_OPTIONS.reduce<Record<string, typeof TIMEZONE_OPTIONS>>((acc, tz) => {
    if (!acc[tz.group]) acc[tz.group] = []
    acc[tz.group].push(tz)
    return acc
  }, {})

  return (
    <div className={`rounded-xl border transition-all ${enabled ? 'border-amber-500/30 bg-amber-500/5' : 'border-border-dark bg-surface-dark'}`}>
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <span className={`material-symbols-outlined text-2xl ${enabled ? 'text-amber-400' : 'text-slate-500'}`}>
            sms
          </span>
          <div className="text-left">
            <p className={`text-sm font-bold ${enabled ? 'text-white' : 'text-slate-400'}`}>
              Absence Messaging
            </p>
            <p className="text-2xs text-slate-500">
              {log.length === 0
                ? (enabled ? `Auto-sends at ${sendHour}:00 ${timezone}` : 'SMS to absent members')
                : `${sentCount} sent · ${failedCount} failed${skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick enable toggle */}
          <div
            role="switch"
            aria-checked={enabled}
            onClick={e => { e.stopPropagation(); toggleEnabled() }}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 cursor-pointer ${enabled ? 'bg-amber-500' : 'bg-border-dark'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className={`material-symbols-outlined text-slate-500 text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">

          {/* Delivery log — HIGH-8: paginated, LOW-20: sorted by sent_at + id */}
          {log.length > 0 && (
            <div className="rounded-lg bg-background-dark p-3 space-y-1">
              <p className="text-2xs font-black uppercase tracking-spaced text-slate-600 mb-2">
                Delivery log
                {logLoading && <span className="ml-2 text-slate-700">loading…</span>}
              </p>
              {log.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-2 text-2xs">
                  <span className="text-slate-400 truncate">{entry.phone}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {entry.status === 'failed' && entry.error_text && (
                      <span className="text-red-500/70 truncate max-w-[120px]" title={entry.error_text}>
                        {entry.error_text.slice(0, 30)}
                      </span>
                    )}
                    <span className={`font-bold uppercase ${entry.status === 'sent' ? 'text-emerald-400' : entry.status === 'failed' ? 'text-red-400' : 'text-slate-500'}`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
              {logHasMore && (
                <button
                  onClick={() => loadLog(false)}
                  disabled={logLoading}
                  className="mt-1 text-2xs text-amber-500/70 hover:text-amber-400 transition-colors disabled:opacity-40"
                >
                  Load more…
                </button>
              )}
            </div>
          )}

          {/* Reachability summary */}
          {absentMembers.length > 0 && (
            <div className="rounded-lg bg-background-dark border border-border-dark px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-2xs font-bold text-emerald-400">
                {absentEligible} will receive SMS
              </span>
              {absentNoConsent > 0 && (
                <span className="text-2xs text-slate-500" title="Members who haven't consented via the check-in prompt yet">
                  {absentNoConsent} haven't consented
                </span>
              )}
              {absentNoPhone > 0 && (
                <span className="text-2xs text-slate-500">
                  {absentNoPhone} have no phone
                </span>
              )}
            </div>
          )}

          {/* Message template */}
          <div>
            <label className="block text-2xs font-black uppercase tracking-spaced text-slate-500 mb-1.5">
              Message template
              <span className="normal-case font-medium tracking-normal ml-1 text-slate-600">— use {'{{name}}'} and {'{{event}}'}</span>
            </label>
            <textarea
              value={template}
              onChange={e => setTemplate(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-background-dark border border-border-dark px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
            />
          </div>

          {/* Preview — MEDIUM-16: uses real absent member's name */}
          {showPreview && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
              <p className="text-2xs font-black uppercase tracking-spaced text-amber-500/60 mb-1">
                Preview {absentMembers[0] ? `(${absentMembers[0].name})` : ''}
              </p>
              <p className="text-xs text-amber-100 leading-relaxed">{previewMsg}</p>
            </div>
          )}

          {/* Schedule: send hour + timezone — CRITICAL-1 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-black uppercase tracking-spaced text-slate-500 mb-1.5">
                Auto-send time
              </label>
              <select
                value={sendHour}
                onChange={e => setSendHour(Number(e.target.value))}
                className="w-full rounded-lg bg-background-dark border border-border-dark px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                {SEND_HOUR_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-2xs font-black uppercase tracking-spaced text-slate-500 mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className="w-full rounded-lg bg-background-dark border border-border-dark px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              >
                {Object.entries(tzGroups).map(([group, zones]) => (
                  <optgroup key={group} label={group}>
                    {zones.map(tz => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Sender name + cooldown */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-black uppercase tracking-spaced text-slate-500 mb-1.5">
                Sender name
                <span className="normal-case font-normal tracking-normal ml-1 text-slate-600">— max 11 chars</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={e => setSenderName(e.target.value.slice(0, 11))}
                placeholder="e.g. GraceChoir"
                maxLength={11}
                className={`w-full rounded-lg bg-background-dark border px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 transition-all ${
                  senderNameError(senderName) ? 'border-red-500/50 focus:ring-red-500/30' : 'border-border-dark focus:ring-amber-500/50'
                }`}
              />
              {senderNameError(senderName) && (
                <p className="text-2xs text-red-400 mt-1">{senderNameError(senderName)}</p>
              )}
              {!senderNameError(senderName) && !senderName.trim() && (
                <p className="text-2xs text-slate-600 mt-1">Uses provider phone number if blank</p>
              )}
            </div>
            <div>
              <label className="block text-2xs font-black uppercase tracking-spaced text-slate-500 mb-1.5">
                Cooldown
                <span className="normal-case font-normal tracking-normal ml-1 text-slate-600">— days between SMS</span>
              </label>
              <input
                type="number"
                value={cooldownDays}
                min={0}
                max={90}
                onChange={e => setCooldownDays(Math.min(90, Math.max(0, Number(e.target.value))))}
                className="w-full rounded-lg bg-background-dark border border-border-dark px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <p className="text-2xs text-slate-600 mt-1">
                {cooldownDays === 0 ? 'No cooldown — messages every missed event' : `Min ${cooldownDays} day${cooldownDays !== 1 ? 's' : ''} between messages`}
              </p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-2xs font-bold rounded-lg bg-background-dark border border-border-dark text-slate-400 hover:text-white transition-all"
            >
              <span className="material-symbols-outlined text-base">visibility</span>
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-2xs font-bold rounded-lg bg-background-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">save</span>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {/* Sends only to consented members with a phone — absentEligible is the real count */}
            <button
              onClick={sendNow}
              disabled={sending || absentEligible === 0}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-2xs font-bold rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-40"
              title={
                absentEligible === 0
                  ? `No eligible members (${absentNoConsent} haven't consented, ${absentNoPhone} have no phone)`
                  : `Send to ${absentEligible} consented absent member${absentEligible !== 1 ? 's' : ''} with a phone`
              }
            >
              <span className="material-symbols-outlined text-base">send</span>
              {sending ? 'Sending…' : `Send to all (${absentEligible})`}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

function renderMsgPreview(template: string, name: string, event: string): string {
  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{event\}\}/g, event)
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminServiceDetail() {
  const { unitId, serviceId } = useParams<{ unitId: string; serviceId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [service, setService] = useState<Service | null>(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const { present, absent, total, loading, loadingMore, hasMore, loadMore, markAttendance, refetch } = useAdminDashboard(serviceId ?? null)
  const effectiveTotal = total > 0 ? total : present.length + absent.length
  const attendanceRate = effectiveTotal > 0 ? Math.round((present.length / effectiveTotal) * 100) : 0
  const qrUrl = serviceId ? `${window.location.origin}/checkin?service_id=${serviceId}` : ''
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!serviceId) return
    supabase.from('services').select('*').eq('id', serviceId).single()
      .then(({ data }) => { setService(data); setServiceLoading(false) })
  }, [serviceId])

  /**
   * Fetch every absent member before exporting.
   * Warns + aborts if the count is unusually large to protect browser memory.
   */
  async function fetchAllAbsent(): Promise<DashboardMember[]> {
    const EXPORT_CAP = 5_000
    // If the list fits in what's already loaded, use it directly
    if (!hasMore) return absent

    // Count first to guard against unexpectedly large datasets
    const { count } = await supabase
      .rpc('get_service_members_full', { p_service_id: serviceId, p_limit: 1, p_offset: 0 }, { count: 'exact', head: true })
    const absentEstimate = (count ?? 0)
    if (absentEstimate > EXPORT_CAP) {
      throw new Error(`Too many absent members to export at once (${absentEstimate.toLocaleString()}). Please contact support for large-batch exports.`)
    }

    const { data, error } = await supabase.rpc('get_service_members_full', {
      p_service_id: serviceId,
      p_limit: EXPORT_CAP,
      p_offset: 0,
    })
    if (error) throw error
    return ((data ?? []) as DashboardMember[]).filter(m => !m.checked_in)
  }

  async function handleExport(format: 'txt' | 'csv' | 'rtf') {
    setExporting(true)
    try {
      const members = await fetchAllAbsent()
      if (format === 'txt') exportTXT(members, eventLabel)
      else if (format === 'csv') exportCSV(members, eventLabel)
      else exportRTF(members, eventLabel)
    } catch (err: unknown) {
      toast(`Export failed: ${(err as { message?: string })?.message ?? 'Unknown error'}`, 'error')
    } finally {
      setExporting(false)
    }
  }

  function downloadQR() {
    const canvas = document.getElementById('service-qr') as HTMLCanvasElement | null
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url; a.download = `qr-${service?.date ?? serviceId}.png`; a.click()
  }

  const baseList = tab === 'absent' ? absent : tab === 'present' ? present : [...present, ...absent]
  const displayMembers = search.trim()
    ? baseList.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : baseList

  const grouped = groupBySection(displayMembers)

  const eventLabel = service
    ? `${service.service_type || 'Event'} ${service.date}`
    : 'event'

  if (serviceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-dark">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-background-dark text-center">
        <p className="text-slate-400">Event not found.</p>
        <button onClick={() => navigate(`/admin/units/${unitId}`)} className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all">
          Back to Unit
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-dark text-slate-100 font-display antialiased">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-background-dark/80 backdrop-blur-md p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/units/${unitId}`)}
            className="size-10 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-base font-bold leading-tight">{service.service_type || 'Event'}</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {formatTime(service.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/help')}
            className="size-10 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors text-slate-400 hover:text-slate-100"
            title="User Guide"
          >
            <span className="material-symbols-outlined">help</span>
          </button>
          <button
            onClick={refetch}
            className="size-10 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors text-slate-400 hover:text-slate-100"
            title="Refresh"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="flex-1 pb-8 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Desktop: 2-col layout. Mobile: single column */}
          <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-6 lg:pt-4">

          {/* Left column: QR + Stats */}
          <div className="lg:sticky lg:top-[73px] lg:self-start flex flex-col gap-4">
        {/* ── QR Section (Collapsed by default) ─────────────────────────── */}
        <section className="p-4">
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary/60 p-[1px]">
            <div className="rounded-xl bg-surface-dark overflow-hidden">
              {/* Toggle row */}
              <button
                onClick={() => setShowQR(v => !v)}
                className="w-full flex items-center justify-between gap-4 p-4 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="size-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <span className="material-symbols-outlined text-2xl">qr_code_2</span>
                  </div>
                  <div className="text-left space-y-0.5">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-white">Attendance QR Code</h3>
                    <p className="text-2xs text-slate-400 font-medium">
                      {showQR ? 'Click to collapse check-in code' : 'Click expand to show check-in code'}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/20 px-4 py-1.5 text-xs font-bold text-white uppercase tracking-wider transition-all hover:bg-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95 border border-primary/30 flex-shrink-0">
                  {showQR ? 'Collapse' : 'Expand'}
                </span>
              </button>

              {/* Expanded QR */}
              {showQR && (
                <div className="mt-2 bg-background-dark px-6 py-8 flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-300">
                  {/* QR canvas — white bg required for scanning */}
                  <div className="p-4 bg-white rounded-2xl shadow-2xl shadow-primary/30 ring-1 ring-primary/20">
                    <QRCodeCanvas id="service-qr" value={qrUrl} size={220} marginSize={2} level="H" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-300">Scan to check in</p>
                    <p className="text-2xs text-slate-500 break-all max-w-xs">{qrUrl}</p>
                  </div>
                  <button
                    onClick={downloadQR}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Download QR PNG
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Location Toggle ────────────────────────────────────────── */}
        <section className="px-4">
          <LocationToggle service={service} onUpdate={setService} />
        </section>

        {/* ── Go Live ────────────────────────────────────────────────────── */}
        <section className="px-4">
          <GoLiveButton service={service} />
        </section>

        {/* ── Real-time Stats ────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
          {/* Total */}
          <div className="flex flex-col gap-1 rounded-xl bg-surface-dark p-4 border border-primary/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</p>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold">{total}</p>
              <span className="text-2xs font-bold text-slate-400">MEMBERS</span>
            </div>
          </div>
          {/* Present */}
          <div className="flex flex-col gap-1 rounded-xl bg-surface-dark p-4 border border-primary/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Present</p>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-emerald-500">{present.length}</p>
              <span className="text-2xs font-bold text-emerald-500/80">
                {total > 0 ? `${Math.round((present.length / total) * 100)}%` : '—'}
              </span>
            </div>
          </div>
          {/* Absent */}
          <div className="flex flex-col gap-1 rounded-xl bg-surface-dark p-4 border border-primary/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Absent</p>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-rose-500">{absent.length}</p>
              <span className="text-2xs font-bold text-rose-500/80">
                {total > 0 ? `${Math.round((absent.length / total) * 100)}%` : '—'}
              </span>
            </div>
          </div>
          {/* Rate */}
          <div className="flex flex-col gap-1 rounded-xl bg-surface-dark p-4 border border-primary/10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rate</p>
            <div className="flex items-baseline justify-between">
              <p className={`text-2xl font-bold ${attendanceRate >= 75 ? 'text-primary' : attendanceRate >= 50 ? 'text-amber-400' : 'text-rose-500'}`}>
                {attendanceRate}%
              </p>
              <div className="h-1.5 w-8 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${attendanceRate >= 75 ? 'bg-primary' : attendanceRate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Absence Messaging ─────────────────────────────────────────── */}
        <section className="px-4">
          <MessagingPanel service={service} absentMembers={absent} />
        </section>

          </div> {/* End left column */}

          {/* Right column: Tabs + Member List */}
          <div>
          {/* ── Tabs + Search ──────────────────────────────────────────────── */}
          <section className="mt-4">
            <div className="sticky top-[73px] z-40 bg-background-dark/95 backdrop-blur-sm pt-2">
            {/* Tab pills */}
            <div className="flex gap-1 rounded-lg bg-surface-dark p-1">
              {(['all', 'present', 'absent'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-md py-2 text-sm font-bold transition-all duration-150 capitalize active:scale-[0.97] ${
                    tab === t
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t === 'all' ? `All (${total})` : t === 'present' ? `Present (${present.length})` : `Absent (${absent.length})`}
                </button>
              ))}
            </div>

            {/* Search row */}
            <div className="flex items-center gap-2 py-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search members…"
                  className="w-full rounded-lg bg-surface-dark pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all border border-border-dark"
                />
              </div>
              {/* Export (absent tab only) */}
              {tab === 'absent' && absent.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport('txt')}
                    disabled={exporting}
                    title="Download plain-text absence list"
                    className="flex items-center gap-1.5 px-2.5 py-2 text-2xs font-bold rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">description</span>
                    {exporting ? '…' : 'TXT'}
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                    title="Download CSV for Excel / Google Sheets"
                    className="flex items-center gap-1.5 px-2.5 py-2 text-2xs font-bold rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">table_view</span>
                    {exporting ? '…' : 'CSV'}
                  </button>
                  <button
                    onClick={() => handleExport('rtf')}
                    disabled={exporting}
                    title="Download RTF (opens in Word / Pages)"
                    className="flex items-center gap-1.5 px-2.5 py-2 text-2xs font-bold rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-base">format_align_left</span>
                    {exporting ? '…' : 'DOC'}
                  </button>
                </div>
              )}
            </div>
          </div>

            {/* ── Member List ─────────────────────────────────────────────── */}
            <div>
            {loading ? (
              <div className="space-y-1 mt-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-surface-dark p-3 border border-border-dark mb-1">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="size-9 rounded-full flex-shrink-0 animate-pulse bg-white/[0.06]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-28 animate-pulse rounded-md bg-white/[0.06]" />
                        <div className="h-2.5 w-20 animate-pulse rounded-md bg-white/[0.06]" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="h-5 w-16 rounded-full animate-pulse bg-white/[0.06]" />
                      <div className="size-10 rounded-xl animate-pulse bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayMembers.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-700" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {tab === 'absent' ? 'check_circle' : 'group_off'}
                </span>
                <p className="font-bold text-slate-300">
                  {tab === 'absent' ? 'All members accounted for!' : search ? 'No results' : 'No members found'}
                </p>
                <p className="text-sm text-slate-500">
                  {tab === 'absent' && 'Every member has checked in.'}
                  {tab !== 'absent' && search && `No members match "${search}"`}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {Object.entries(grouped).map(([section, sectionMembers]) => (
                  <div key={section}>
                    {/* Section header — only show if there are named sections */}
                    {(section || Object.keys(grouped).length > 1) && (
                      <p className="px-2 pt-4 pb-2 text-2xs font-bold uppercase tracking-spaced text-primary/80">
                        {section || 'General'}
                      </p>
                    )}
                    {sectionMembers.map(m => {
                      const color = avatarColor(m.name)
                      return (
                      <div
                        key={m.id}
                        className="group flex items-center justify-between gap-3 rounded-xl bg-surface-dark p-3 border border-transparent hover:border-primary/20 hover:bg-primary/[0.03] transition-all duration-150 cursor-default mb-1"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <div
                            className="size-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                            style={{ backgroundColor: `${color}25`, border: `1.5px solid ${color}40` }}
                          >
                            <span style={{ color }}>{getInitials(m.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-100 truncate">{m.name}</h4>
                            <p className="text-2xs text-slate-500">{m.phone ?? 'No contact'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex flex-col items-end gap-1">
                            {m.checked_in ? (
                              <>
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-bold text-emerald-500 uppercase">Checked In</span>
                                {m.checkin_time && (
                                  <p className="text-2xs text-slate-500">
                                    {new Date(m.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-2xs font-bold text-rose-500 uppercase">Absent</span>
                                {m.phone ? (
                                  <a
                                    href={`tel:${m.phone}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-2xs text-primary/80 hover:text-primary transition-colors"
                                  >
                                    Call
                                  </a>
                                ) : (
                                  <p className="text-2xs text-slate-500">No contact</p>
                                )}
                              </>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAttendance(m.id, !m.checked_in);
                            }}
                            className={`size-11 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 border ${
                              m.checked_in
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                            }`}
                            title={m.checked_in ? "Mark Absent" : "Mark Present"}
                          >
                            <span className="material-symbols-outlined text-xl">
                              {m.checked_in ? 'person_remove' : 'person_check'}
                            </span>
                          </button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-100 border border-border-dark hover:border-primary/40 hover:bg-primary/5 rounded-xl transition-all duration-150 flex items-center gap-2 disabled:opacity-40 active:scale-[0.97]"
                    >
                      {loadingMore
                        ? <><span className="size-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Loading…</>
                        : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        </div> {/* End right column */}

        </div> {/* End lg:grid */}
        </div> {/* End max-w container */}
      </main>
    </div>
  )
}
