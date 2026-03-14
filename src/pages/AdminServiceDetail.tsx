import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, QrCode, ArrowLeft, RefreshCw, Download, FileText, FileSpreadsheet } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabase'
import { useAdminDashboard } from '../hooks/useAdminDashboard'
import { StatCard } from '../components/ui/Card'
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  if (!service) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600">Event not found.</p>
        <Button variant="secondary" onClick={() => navigate(`/admin/units/${unitId}`)}>Back to unit</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white px-4 py-3 shadow-sm flex items-center gap-3">
        <button
          onClick={() => navigate(`/admin/units/${unitId}`)}
          className="flex items-center justify-center rounded-lg p-1.5 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {EVENT_LABEL[service.service_type]}
          </p>
          <p className="text-xs text-gray-400">{formatDate(service.date)}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">

        {/* QR Code section */}
        <section className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden">
          <button
            onClick={() => setShowQR(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <QrCode className="h-5 w-5 text-blue-700" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">QR Code</p>
                <p className="text-xs text-gray-400">Tap to {showQR ? 'hide' : 'show or print'}</p>
              </div>
            </div>
            <span className="text-xs font-medium text-blue-600">{showQR ? 'Hide' : 'Show'}</span>
          </button>

          {showQR && (
            <div className="border-t border-gray-50 px-5 py-5 flex flex-col items-center gap-4">
              <QRCodeCanvas
                id="service-qr"
                value={qrUrl}
                size={240}
                includeMargin
                level="H"
              />
              <p className="text-xs text-gray-400 text-center break-all max-w-xs">{qrUrl}</p>
              <Button variant="secondary" size="sm" onClick={downloadQR}>
                <Download className="h-4 w-4" />
                Download PNG
              </Button>
              <p className="text-xs text-gray-400">Display on a screen or print for members to scan</p>
            </div>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Members" value={total} color="gray" />
          <StatCard label="Present" value={present.length} color="green" />
          <StatCard label="Absent" value={absent.length} color="red" />
          <StatCard label="Attendance Rate" value={`${attendanceRate}%`} color="blue" />
        </section>

        {/* Tabs */}
        <section>
          <div className="mb-4 flex rounded-xl bg-gray-100 p-1">
            {(['absent', 'present', 'all'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'absent'
                  ? `Absent (${absent.length})`
                  : t === 'present'
                  ? `Present (${present.length})`
                  : `All (${total})`}
              </button>
            ))}
          </div>

          {/* Export buttons — shown when viewing absent list */}
          {tab === 'absent' && absent.length > 0 && (
            <div className="mb-4 flex gap-2 flex-wrap">
              <span className="text-xs text-gray-400 self-center mr-1">Export absent list:</span>
              <button
                onClick={() => exportTXT(absent, eventLabel)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <FileText className="h-3.5 w-3.5" />
                TXT
              </button>
              <button
                onClick={() => exportCSV(absent, eventLabel)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel (CSV)
              </button>
              <button
                onClick={() => exportRTF(absent, eventLabel)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <FileText className="h-3.5 w-3.5" />
                Word (RTF)
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
            </div>
          ) : displayMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {tab === 'absent' ? 'All members have checked in!' : 'No members to show.'}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(grouped).map(([section, members]) => (
                <div key={section}>
                  {section && (
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {section}
                    </h3>
                  )}
                  <div className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden">
                    {members.map((m, i) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between px-4 py-3 ${
                          i < members.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                              m.checked_in ? 'bg-green-500' : 'bg-red-400'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{m.name}</p>
                            {m.checkin_time ? (
                              <p className="text-xs text-gray-400">
                                Checked in at{' '}
                                {new Date(m.checkin_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400">{m.phone ?? 'No phone'}</p>
                            )}
                          </div>
                        </div>
                        {m.phone && !m.checked_in && (
                          <a
                            href={`tel:${m.phone}`}
                            className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <Phone className="h-3.5 w-3.5" />
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
                    className="w-full sm:w-auto"
                  >
                    Load More Members
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Quick contact list for absent */}
        {tab === 'absent' && absent.filter(m => m.phone).length > 0 && (
          <section className="rounded-2xl bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">
              Quick contact list
            </p>
            <div className="flex flex-col gap-1">
              {absent.filter(m => m.phone).map(m => (
                <a
                  key={m.id}
                  href={`tel:${m.phone}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-amber-100"
                >
                  <span className="text-sm text-gray-900">{m.name}</span>
                  <span className="text-sm text-blue-700">{m.phone}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
