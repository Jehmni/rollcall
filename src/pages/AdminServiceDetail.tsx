import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, QrCode, ArrowLeft, RefreshCw, Download, FileText, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { Button } from '../components/ui/Button'
import type { DashboardMember, Service } from '../types'

const EVENT_LABEL: Record<string, string> = {
  rehearsal: 'Regular Meeting',
  sunday_service: 'Main Event',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
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
    ...members.map(
      (m, i) =>
        `  ${String(i + 1).padStart(2)}.  ${m.name.padEnd(32)}${(m.section ?? '—').padEnd(14)}${m.phone ?? '—'}`,
    ),
    '',
    rule,
  ]
  triggerDownload(lines.join('\n'), `absent-${label}.txt`, 'text/plain;charset=utf-8')
}

function exportCSV(members: DashboardMember[], label: string) {
  // UTF-8 BOM so Excel opens without an encoding prompt
  const BOM = '\uFEFF'
  const rows: string[][] = [
    [`Absence Report — ${label}`],
    [`Generated: ${new Date().toLocaleString('en-GB')}`],
    [`Total absent: ${members.length}`],
    [],
    ['#', 'Name', 'Section', 'Phone'],
    ...members.map((m, i) => [
      String(i + 1),
      m.name,
      m.section ?? '',
      m.phone ?? '',
    ]),
  ]
  const csv = BOM + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  triggerDownload(csv, `absent-${label}.csv`, 'text/csv;charset=utf-8')
}

function exportRTF(members: DashboardMember[], label: string) {
  const generated = new Date().toLocaleString('en-GB')

  // RTF table: column right-edges in twips (1440 twips = 1 inch)
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
    ...members.map((m, i) =>
      rtfRow([String(i + 1), m.name, m.section ?? '—', m.phone ?? '—'])
    ),
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

type Tab = 'absent' | 'present' | 'all'

function groupBySection(members: DashboardMember[]): Record<string, DashboardMember[]> {
  const sections = [...new Set(members.map(m => m.section ?? ''))].sort()
  return sections.reduce<Record<string, DashboardMember[]>>((acc, s) => {
    acc[s] = members.filter(m => (m.section ?? '') === s)
    return acc
  }, {})
}

export default function AdminServiceDetail() {
  const { unitId, serviceId } = useParams<{ unitId: string; serviceId: string }>()
  const navigate = useNavigate()
  const [service, setService] = useState<Service | null>(null)
  const [serviceLoading, setServiceLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [tab, setTab] = useState<Tab>('absent')

  const { present, absent, total, loading, loadingMore, hasMore, loadMore, refetch } = useAdminDashboard(serviceId ?? null)
  const attendanceRate = total > 0 ? Math.round((present.length / total) * 100) : 0
  const qrUrl = serviceId ? `${window.location.origin}/checkin?event_id=${serviceId}` : ''

  useEffect(() => {
    if (!serviceId) return
    supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()
      .then(({ data }) => {
        setService(data)
        setServiceLoading(false)
      })
  }, [serviceId])

  function downloadQR() {
    const canvas = document.getElementById('service-qr') as HTMLCanvasElement | null
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${service?.date ?? serviceId}.png`
    a.click()
  }

  const displayMembers =
    tab === 'absent' ? absent : tab === 'present' ? present : [...present, ...absent]

  const grouped = groupBySection(displayMembers)

  const eventLabel = service
    ? `${EVENT_LABEL[service.service_type]} ${service.date}`
    : 'event'

  if (serviceLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-brand-secondary text-center">
        <p className="text-brand-slate">Event not found.</p>
        <Button variant="secondary" onClick={() => navigate(`/admin/units/${unitId}`)}>Back to unit</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-secondary">
      {/* Header */}
      <header className="flex flex-col gap-8 px-4 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate(`/admin/units/${unitId}`)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
            title="Back to Unit"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          
          <div className="flex flex-col items-center flex-1 overflow-hidden px-4 text-center">
             <h1 className="text-3xl font-black tracking-tighter italic truncate w-full uppercase">
               {EVENT_LABEL[service.service_type]}
             </h1>
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mt-1">
               {formatDate(service.date)}
             </p>
          </div>

          <button
            onClick={refetch}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className="h-6 w-6" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">

         {/* QR Code section */}
        <section className="rounded-[2rem] bg-white border border-brand-border/50 overflow-hidden shadow-2xl shadow-brand-primary/[0.02]">
          <button
            onClick={() => setShowQR(v => !v)}
            className="w-full flex items-center justify-between px-8 py-6 hover:bg-brand-primary/[0.02] transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/5">
                <QrCode className="h-6 w-6 text-brand-primary" />
              </div>
              <div className="text-left">
                <p className="text-lg font-black text-brand-text italic uppercase tracking-tighter">Attendance QR</p>
                <p className="text-xs font-medium text-brand-slate opacity-40">get event qrcode</p>
              </div>
            </div>
            <div className={`h-8 px-4 rounded-full flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all ${showQR ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-brand-secondary text-brand-primary border border-brand-primary/10'}`}>
              {showQR ? 'Hide Panel' : 'Expand'}
            </div>
          </button>

           {showQR && (
            <div className="border-t border-brand-border/30 px-8 py-8 flex flex-col items-center gap-6 bg-brand-secondary/30 animate-in fade-in zoom-in-95 duration-500">
              <div className="p-4 bg-white rounded-[2.5rem] shadow-2xl shadow-brand-primary/10 border border-brand-border/50">
                <QRCodeCanvas
                  id="service-qr"
                  value={qrUrl}
                  size={240}
                  includeMargin
                  level="H"
                />
              </div>
              <p className="text-[10px] font-medium text-brand-slate opacity-40 text-center break-all max-w-xs">{qrUrl}</p>
              <Button variant="secondary" onClick={downloadQR} className="px-8 py-6 bg-white border-brand-border/50 shadow-xl shadow-brand-primary/[0.02] rounded-2xl hover:scale-105 active:scale-95 transition-all text-xs font-black uppercase tracking-widest gap-3">
                <Download className="h-5 w-5" />
                Prepare for Printing
              </Button>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 border border-brand-border/50 text-center shadow-lg shadow-brand-primary/[0.02]">
             <p className="text-3xl font-black tracking-tighter italic text-brand-text">{total}</p>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">Total</p>
          </div>
          <div className="rounded-2xl bg-white p-6 border border-brand-border/50 text-center shadow-lg shadow-brand-primary/[0.02]">
             <p className="text-3xl font-black tracking-tighter italic text-green-600">{present.length}</p>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">present</p>
          </div>
          <div className="rounded-2xl bg-white p-6 border border-brand-border/50 text-center shadow-lg shadow-brand-primary/[0.02]">
             <p className="text-3xl font-black tracking-tighter italic text-red-500">{absent.length}</p>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">absent</p>
          </div>
          <div className="rounded-2xl bg-white p-6 border border-brand-border/50 text-center shadow-lg shadow-brand-primary/[0.02]">
             <p className="text-3xl font-black tracking-tighter italic text-brand-primary">{attendanceRate}%</p>
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">Rate</p>
          </div>
        </section>

        {/* Tabs */}
         <section>
          <div className="mb-6 flex rounded-2xl bg-brand-primary/[0.03] p-1.5 border border-brand-primary/5">
            {(['absent', 'present', 'all'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  tab === t
                    ? 'bg-white text-brand-primary shadow-xl shadow-brand-primary/[0.05] border border-brand-primary/10'
                    : 'text-brand-slate/40 hover:text-brand-primary/60'
                }`}
              >
                {t === 'absent'
                  ? `absent (${absent.length})`
                  : t === 'present'
                  ? `present (${present.length})`
                  : `Total (${total})`}
              </button>
            ))}
          </div>
   {/* Export buttons — shown when viewing absent list */}
          {tab === 'absent' && absent.length > 0 && (
            <div className="mb-8 flex gap-3 flex-wrap items-center animate-in fade-in slide-in-from-left-4 duration-500">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-text mr-2">Personnel Report:</span>
              <button
                onClick={() => exportTXT(absent, eventLabel)}
                className="flex items-center gap-2.5 rounded-xl border border-brand-border/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-slate hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95 shadow-sm"
              >
                <FileText className="h-4 w-4" />
                TXT
              </button>
              <button
                onClick={() => exportCSV(absent, eventLabel)}
                className="flex items-center gap-2.5 rounded-xl border border-brand-border/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-slate hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95 shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>
              <button
                onClick={() => exportRTF(absent, eventLabel)}
                className="flex items-center gap-2.5 rounded-xl border border-brand-border/50 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-slate hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-95 shadow-sm"
              >
                <FileText className="h-4 w-4" />
                RTF
              </button>
            </div>
          )}
        </section>

        <section>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            </div>
           ) : displayMembers.length === 0 ? (
            <div className="rounded-[2.5rem] bg-white p-20 text-center border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02]">
               <CheckCircle2 className="h-20 w-20 text-green-500/10 mx-auto mb-6" />
               <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Mission Clear</h3>
               <p className="text-sm font-medium text-brand-slate opacity-40 mt-3">
                 {tab === 'absent' ? 'Every member of the unit has been accounted for.' : 'No personnel records found for this query.'}
               </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {Object.entries(grouped).map(([section, members]) => (
                <div key={section} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center gap-3 mb-4 px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
                      {section || 'General'}
                    </h3>
                    <div className="h-px flex-1 bg-brand-border/30"></div>
                  </div>
                  <div className="rounded-[2rem] bg-white border border-brand-border/50 overflow-hidden shadow-2xl shadow-brand-primary/[0.02]">
                    {members.map((m, i) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between px-8 py-5 group hover:bg-brand-primary/[0.02] transition-all ${
                          i < members.length - 1 ? 'border-b border-brand-border/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={`h-4 w-4 rounded-full flex-shrink-0 shadow-lg ${
                              m.checked_in 
                                ? 'bg-green-500 ring-4 ring-green-500/10' 
                                : 'bg-red-400 ring-4 ring-red-400/10'
                            }`}
                          />
                           <div>
                            <p className="text-lg font-bold text-brand-text uppercase tracking-tight italic group-hover:text-brand-primary transition-colors">{m.name}</p>
                            {m.checkin_time ? (
                              <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mt-1">
                                Secure Check-in · {new Date(m.checkin_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            ) : (
                              <p className="text-[10px] font-black uppercase tracking-widest text-brand-slate opacity-30 mt-1">{m.phone || 'No Contact Listed'}</p>
                            )}
                          </div>
                        </div>
                         {m.phone && !m.checked_in && (
                          <a
                            href={`tel:${m.phone}`}
                            className="flex items-center gap-3 rounded-xl bg-brand-primary text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-primary/20"
                          >
                            <Phone className="h-4 w-4" />
                            Call
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button 
                    variant="secondary" 
                    onClick={loadMore} 
                    loading={loadingMore}
                    className="w-full h-14 rounded-2xl bg-white border-brand-border/50 text-brand-text font-black uppercase tracking-widest shadow-xl shadow-brand-primary/[0.02] hover:scale-[1.02] transition-all"
                  >
                    Load More Personnel
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Quick contact list for absent */}
        {tab === 'absent' && absent.filter(m => m.phone).length > 0 && (
          <section className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <div className="flex items-center gap-4 mb-8 px-4">
               <div className="h-px flex-1 bg-brand-border/50"></div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-slate opacity-40">Rapid Response Log</h2>
               <div className="h-px flex-1 bg-brand-border/50"></div>
            </div>
            <div className="rounded-[2.5rem] bg-white border border-brand-border/50 overflow-hidden shadow-2xl shadow-brand-primary/[0.02]">
               {absent.filter(m => m.phone).map((m, i, arr) => (
                <a
                  key={m.id}
                  href={`tel:${m.phone}`}
                  className={`flex items-center justify-between px-8 py-5 group hover:bg-brand-primary/[0.02] transition-all ${i < arr.length - 1 ? 'border-b border-brand-border/30' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-2 w-2 rounded-full bg-brand-primary/20 group-hover:bg-brand-primary group-hover:animate-pulse transition-all"></div>
                    <span className="text-lg font-bold text-brand-text uppercase italic tracking-tight group-hover:text-brand-primary transition-colors">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-brand-primary opacity-40 group-hover:opacity-100 transition-all uppercase tracking-widest">{m.phone}</span>
                    <Phone className="h-4 w-4 text-brand-primary opacity-0 group-hover:opacity-100 transition-all transform group-hover:scale-110" />
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
