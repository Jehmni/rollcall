import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import type { DashboardMember, Service } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EVENT_LABEL: Record<string, string> = {
  rehearsal:      'Regular Meeting',
  sunday_service: 'Main Event',
  meeting:        'Meeting',
}


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
  triggerDownload(lines.join('\n'), `absent-${label}.txt`, 'text/plain;charset=utf-8')
}

function exportCSV(members: DashboardMember[], label: string) {
  const BOM = '\uFEFF'
  const rows: string[][] = [
    [`Absence Report — ${label}`],
    [`Generated: ${new Date().toLocaleString('en-GB')}`],
    [`Total absent: ${members.length}`],
    [],
    ['#', 'Name', 'Section', 'Phone'],
    ...members.map((m, i) => [String(i + 1), m.name, m.section ?? '', m.phone ?? '']),
  ]
  const csv = BOM + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  triggerDownload(csv, `absent-${label}.csv`, 'text/csv;charset=utf-8')
}

function exportRTF(members: DashboardMember[], label: string) {
  const generated = new Date().toLocaleString('en-GB')
  const colX = [540, 3960, 5760, 8160]
  function rtfRow(cells: string[], isHeader = false) {
    const defs = colX.map(x => `\\cellx${x}`).join('')
    const content = cells.map(c => {
      const bold = isHeader ? '\\b ' : ''
      const bg   = isHeader ? '\\clshdng10000\\clcfpat2 ' : ''
      return `${bg}\\pard\\intbl\\ql ${bold}\\f0\\fs20 ${c}\\cell`
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
{\\pard\\f0\\fs24\\b ${label}\\par}
{\\pard\\f0\\fs20 Generated: ${generated}\\par}
{\\pard\\f0\\fs20 Total absent: ${members.length}\\par}
\\par
${tableRows}
}`
  triggerDownload(rtf, `absent-${label}.rtf`, 'application/rtf')
}

type Tab = 'all' | 'present' | 'absent'

function groupBySection(members: DashboardMember[]): Record<string, DashboardMember[]> {
  const sections = [...new Set(members.map(m => m.section ?? ''))].sort()
  return sections.reduce<Record<string, DashboardMember[]>>((acc, s) => {
    acc[s] = members.filter(m => (m.section ?? '') === s)
    return acc
  }, {})
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AdminServiceDetail() {
  const { unitId, serviceId } = useParams<{ unitId: string; serviceId: string }>()
  const navigate = useNavigate()
  const [service, setService] = useState<Service | null>(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const { present, absent, total, loading, loadingMore, hasMore, loadMore, markAttendance, refetch } = useAdminDashboard(serviceId ?? null)
  const attendanceRate = total > 0 ? Math.round((present.length / total) * 100) : 0
  const qrUrl = serviceId ? `${window.location.origin}/checkin?service_id=${serviceId}` : ''

  useEffect(() => {
    if (!serviceId) return
    supabase.from('services').select('*').eq('id', serviceId).single()
      .then(({ data }) => { setService(data); setServiceLoading(false) })
  }, [serviceId])

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
    ? `${EVENT_LABEL[service.service_type] ?? 'Event'} ${service.date}`
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
      <header className="sticky top-0 z-50 flex items-center justify-between bg-background-dark/80 backdrop-blur-md p-4 border-b border-primary/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/admin/units/${unitId}`)}
            className="size-10 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div>
            <h1 className="text-base font-bold leading-tight">{EVENT_LABEL[service.service_type] ?? 'Event'}</h1>
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
                <div className="border-t border-primary/20 bg-background-dark px-6 py-8 flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-300">
                  {/* QR canvas — white bg required for scanning */}
                  <div className="p-4 bg-white rounded-2xl shadow-2xl shadow-primary/30 ring-1 ring-primary/20">
                    <QRCodeCanvas id="service-qr" value={qrUrl} size={220} includeMargin level="H" />
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
                  className={`h-full rounded-full ${attendanceRate >= 75 ? 'bg-primary' : attendanceRate >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
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
                  className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors capitalize ${
                    tab === t
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => exportTXT(absent, eventLabel)}
                    title="Export TXT"
                    className="size-10 flex items-center justify-center rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">description</span>
                  </button>
                  <button
                    onClick={() => exportCSV(absent, eventLabel)}
                    title="Export CSV"
                    className="size-10 flex items-center justify-center rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">table_view</span>
                  </button>
                  <button
                    onClick={() => exportRTF(absent, eventLabel)}
                    title="Export RTF (Word)"
                    className="size-10 flex items-center justify-center rounded-lg bg-surface-dark border border-border-dark text-slate-400 hover:text-primary hover:border-primary/40 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">format_align_left</span>
                  </button>
                </div>
              )}
            </div>
          </div>

            {/* ── Member List ─────────────────────────────────────────────── */}
            <div>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                      <p className="px-2 pt-4 pb-2 text-2xs font-bold uppercase tracking-spaced text-primary/60">
                        {section || 'General'}
                      </p>
                    )}
                    {sectionMembers.map(m => (
                      <div
                        key={m.id}
                        className={`group flex items-center justify-between gap-4 rounded-xl bg-surface-dark p-4 border border-transparent hover:border-primary/30 transition-all cursor-pointer mb-1 ${
                          !m.checked_in ? 'opacity-80' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div>
                            <h4 className="font-bold text-slate-100 truncate">{m.name}</h4>
                            <p className="text-xs text-slate-400">{m.phone ?? 'No contact'}</p>
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
                                    className="text-2xs text-primary/60 hover:text-primary transition-colors"
                                  >
                                    Call
                                  </a>
                                ) : (
                                  <p className="text-2xs text-slate-600">No contact</p>
                                )}
                              </>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAttendance(m.id, !m.checked_in);
                            }}
                            className={`size-10 flex items-center justify-center rounded-xl transition-all active:scale-95 border ${
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
                    ))}
                  </div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-6 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 border border-border-dark hover:border-slate-600 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40"
                    >
                      {loadingMore
                        ? <><span className="size-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" /> Loading…</>
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
