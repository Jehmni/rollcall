import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Cake } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Member, ServiceType } from '../types'

const SERVICE_LABEL: Record<ServiceType, string> = {
  rehearsal: 'Rehearsal',
  sunday_service: 'Sunday Service',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function isBirthday(birthday: string | null) {
  if (!birthday) return false
  const today = new Date()
  const bday = new Date(birthday)
  return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'attended' | 'absent' | 'upcoming'

interface ServiceRecord {
  serviceId: string
  date: string
  serviceType: ServiceType
  status: AttendanceStatus
  checkinTime: string | null
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color = 'gray',
}: { label: string; value: string | number; color?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const valueClass = {
    gray: 'text-gray-900',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    blue: 'text-blue-600',
  }[color]

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-100 text-center">
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-400 leading-tight">{label}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MemberDetail() {
  const { unitId, memberId } = useParams<{ unitId: string; memberId: string }>()
  const navigate = useNavigate()

  const [member, setMember] = useState<Member | null>(null)
  const [records, setRecords] = useState<ServiceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!unitId || !memberId) return

    Promise.all([
      supabase.from('members').select('*').eq('id', memberId).single(),
      supabase.from('services').select('*').eq('unit_id', unitId).order('date', { ascending: false }),
      supabase.from('attendance').select('service_id, checkin_time').eq('member_id', memberId),
    ]).then(([{ data: m }, { data: svcs }, { data: attn }]) => {
      setMember(m)

      const attended = new Map(
        (attn ?? []).map(a => [a.service_id as string, a.checkin_time as string])
      )
      const today = new Date().toISOString().split('T')[0]

      setRecords(
        (svcs ?? []).map((s: { id: string; date: string; service_type: string }) => ({
          serviceId: s.id,
          date: s.date,
          serviceType: s.service_type as ServiceType,
          status: (s.date > today
            ? 'upcoming'
            : attended.has(s.id)
              ? 'attended'
              : 'absent') as AttendanceStatus,
          checkinTime: attended.get(s.id) ?? null,
        }))
      )

      setLoading(false)
    })
  }, [unitId, memberId])

  // ── Derived stats ───────────────────────────────────────────────────────────

  const pastRecords = records.filter(r => r.status !== 'upcoming')
  const attendedCount = pastRecords.filter(r => r.status === 'attended').length
  const rate = pastRecords.length > 0
    ? Math.round((attendedCount / pastRecords.length) * 100)
    : 0

  // Consecutive services attended counting from most recent past service
  let streak = 0
  for (const r of pastRecords) {
    if (r.status === 'attended') streak++
    else break
  }

  // Last ≤10 past services displayed oldest→newest (left = older)
  const recentTrend = pastRecords.slice(0, 10).reverse()

  const rateColor = rate >= 75 ? 'green' : rate >= 50 ? 'amber' : pastRecords.length === 0 ? 'gray' : 'red'

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-600">Member not found.</p>
        <button
          onClick={() => navigate(`/admin/units/${unitId}/members`)}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to members
        </button>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white px-4 py-3 shadow-sm flex items-center gap-3">
        <button
          onClick={() => navigate(`/admin/units/${unitId}/members`)}
          className="flex items-center justify-center rounded-lg p-1.5 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">{member.name}</p>
            {member.section && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 flex-shrink-0">
                {member.section}
              </span>
            )}
            {member.status === 'inactive' && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400 flex-shrink-0">
                Inactive
              </span>
            )}
          </div>
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 hover:underline w-fit"
            >
              <Phone className="h-3 w-3" />
              {member.phone}
            </a>
          )}
          {member.birthday && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <Cake className="h-3 w-3" />
              {formatDate(member.birthday)}
              {isBirthday(member.birthday) && (
                <span className="ml-1 rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-600">
                  Birthday! 🎂
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Attended" value={attendedCount} color="gray" />
          <StatCard label="Total Services" value={pastRecords.length} color="gray" />
          <StatCard label="Attendance Rate" value={`${rate}%`} color={rateColor} />
          <StatCard label="Current Streak" value={streak} color="blue" />
        </section>

        {/* ── Recent trend ─────────────────────────────────────────────────── */}
        {recentTrend.length > 0 && (
          <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-100">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recent trend · last {recentTrend.length} service{recentTrend.length !== 1 ? 's' : ''}
            </h2>

            <div className="flex items-center gap-1.5 flex-wrap">
              {recentTrend.map(r => (
                <div
                  key={r.serviceId}
                  title={`${SERVICE_LABEL[r.serviceType]} · ${r.date}`}
                  className={`h-5 w-5 rounded-full border-2 flex-shrink-0 transition-colors ${r.status === 'attended'
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white border-red-300'
                    }`}
                />
              ))}
              <p className="ml-1 text-xs text-gray-300">← older · newer →</p>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500">Present</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-red-300 bg-white" />
                <span className="text-xs text-gray-500">Absent</span>
              </span>
            </div>
          </section>
        )}

        {/* ── Service history ───────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Service History
          </h2>

          {records.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-gray-100">
              <p className="text-sm text-gray-500">No services found for this unit.</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white ring-1 ring-gray-100 overflow-hidden">
              {records.map((r, i) => (
                <div
                  key={r.serviceId}
                  className={`flex items-center gap-3 px-4 py-3 ${i < records.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                >
                  {/* Status dot */}
                  <div
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${r.status === 'attended'
                        ? 'bg-green-500'
                        : r.status === 'absent'
                          ? 'bg-red-400'
                          : 'bg-gray-200'
                      }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">
                        {SERVICE_LABEL[r.serviceType]}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.status === 'attended'
                            ? 'bg-green-50 text-green-700'
                            : r.status === 'absent'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                      >
                        {r.status === 'attended'
                          ? 'Present'
                          : r.status === 'absent'
                            ? 'Absent'
                            : 'Upcoming'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(r.date)}</p>
                  </div>

                  {r.checkinTime && (
                    <p className="flex-shrink-0 text-xs text-gray-400">
                      {formatTime(r.checkinTime)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
