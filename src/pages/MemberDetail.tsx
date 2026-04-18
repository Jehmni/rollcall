import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'
import { ThemeToggle } from '../components/ThemeToggle'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Format a birthday — omits the year when it's the sentinel 1900 (year-unknown). */
function formatBirthday(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  if (d.getFullYear() === 1900) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
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
  serviceType: string
  status: AttendanceStatus
  checkinTime: string | null
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, color = 'gray',
}: { label: string; value: string | number; color?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const valueClass = {
    gray:  'text-white',
    green: 'text-teal',
    amber: 'text-amber-500',
    red:   'text-red',
    blue:  'text-amber-500',
  }[color]

  return (
    <div className="rounded-none bg-surface-low p-6 text-center shadow-none hover:-translate-y-1 transition-all group">
      <p className={`text-4xl font-display font-black tracking-tighter ${valueClass} group-hover:scale-110 transition-transform duration-500`}>{value}</p>
      <div className="h-px w-8 bg-white/5 mx-auto my-3" aria-hidden="true"></div>
      <p className="text-2xs font-black uppercase tracking-spaced text-slate-500 leading-tight">{label}</p>
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
          serviceType: s.service_type,
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

  // Last ≤10 past services displayed oldest→newest
  const recentTrend = pastRecords.slice(0, 10).reverse()

  const rateColor = rate >= 75 ? 'green' : rate >= 50 ? 'amber' : pastRecords.length === 0 ? 'gray' : 'red'

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark font-display">
        <div className="px-5 sm:px-8 pt-24 pb-24 bg-surface-low relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-none bg-primary/10 blur-[80px]" aria-hidden="true" />
          <div className="flex items-center justify-between relative z-10 w-full">
            <div className="h-12 w-12 rounded-none bg-white/5 animate-pulse" />
            <div className="flex-1 mx-4 space-y-2 flex flex-col items-center">
              <div className="h-5 w-36 rounded-none bg-white/5 animate-pulse" />
              <div className="h-3 w-20 rounded-none bg-white/5 animate-pulse" />
            </div>
            <div className="h-12 w-12 rounded-none bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="px-5 sm:px-8 py-8 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-none bg-surface-low p-6 space-y-2">
                <div className="h-3 w-12 rounded animate-pulse bg-white/5" />
                <div className="h-7 w-10 rounded animate-pulse bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-background-dark text-center font-display">
        <p className="text-slate-500">Member not found.</p>
        <button
          onClick={() => navigate(`/admin/units/${unitId}/members`)}
          className="text-sm text-primary-light font-semibold hover:text-white transition-colors"
        >
          Back to members
        </button>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background-dark font-display">

      {/* Header */}
      <header className="flex flex-col gap-8 px-5 sm:px-8 pt-24 pb-24 bg-surface-low text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-transparent from-primary/10 via-transparent to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-none bg-primary/10 blur-[80px] pointer-events-none" aria-hidden="true"></div>

        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate(`/admin/units/${unitId}/members`)}
            className="flex h-12 w-12 items-center justify-center rounded-none bg-white/5 hover:bg-primary/20 transition-all text-white active:scale-95"
            title="Back to Roster"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">arrow_back</span>
          </button>

          <div className="flex flex-col items-center flex-1 overflow-hidden px-4 text-center">
            <h1 className="text-3xl font-black tracking-tighter truncate w-full">{member.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {member.section && (
                <span className="text-2xs font-black uppercase tracking-spaced bg-primary/10 text-primary-light px-3 py-0.5 rounded-none">
                  {member.section}
                </span>
              )}
              {member.status === 'inactive' && (
                <span className="text-2xs font-black uppercase tracking-widest text-slate-500">Retired</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle className="rounded-none" />
            <button
              onClick={() => navigate('/help')}
              className="flex h-12 w-12 items-center justify-center rounded-none bg-white/5 hover:bg-primary/20 transition-all active:scale-95"
              title="User Guide"
            >
              <span className="material-symbols-outlined text-slate-400 hover:text-white transition-colors text-xl" aria-hidden="true">help</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="flex items-center gap-3 px-6 py-4 rounded-none bg-primary/10 text-primary-light border border-primary/20 font-black text-2xs uppercase tracking-spaced hover:bg-primary/20 hover:scale-105 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">phone</span>
              {member.phone}
            </a>
          )}
          {member.birthday && (
            <div className={`flex items-center gap-3 px-6 py-4 rounded-none font-black text-2xs uppercase tracking-spaced transition-all ${isBirthday(member.birthday) ? 'bg-amber-500/20 border border-amber-500/30 text-amber-500' : 'bg-white/5 text-slate-400'}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">cake</span>
              {formatBirthday(member.birthday)}
              {isBirthday(member.birthday) && <span className="ml-2">🎂 Anniversary</span>}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-12 flex flex-col gap-12">

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Attended" value={attendedCount} color="gray" />
          <StatCard label="Total Events" value={pastRecords.length} color="gray" />
          <StatCard label="Attendance Rate" value={`${rate}%`} color={rateColor} />
          <StatCard label="Current Streak" value={streak} color="blue" />
        </section>

        {/* ── Recent trend ─────────────────────────────────────────────────── */}
        {recentTrend.length > 0 && (
          <section className="rounded-[2.5rem] bg-surface-low p-8 sm:p-10 shadow-[0_20px_40px_rgba(7,13,31,0.4)] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-primary/10 rounded-none blur-3xl pointer-events-none" aria-hidden="true"></div>
            <div className="relative z-10">
              <h2 className="text-2xs font-black uppercase tracking-spread text-slate-500 mb-8">
                Activity Score · Last {recentTrend.length} Events
              </h2>

              <div className="flex items-center gap-2.5 flex-wrap">
                {recentTrend.map(r => (
                  <div
                    key={r.serviceId}
                    title={`${r.serviceType} · ${r.date}`}
                    className={`h-7 w-7 rounded-none flex-shrink-0 transition-all hover:scale-125 hover:rotate-6 cursor-help ${r.status === 'attended'
                        ? 'bg-teal shadow-md shadow-teal/20'
                        : 'bg-white/5'
                      }`}
                    aria-hidden="true"
                  />
                ))}
                <p className="ml-3 text-2xs font-display font-bold uppercase tracking-spaced text-slate-600">Timeline</p>
              </div>

              <div className="mt-8 flex items-center gap-6">
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-none bg-teal shadow-sm" aria-hidden="true" />
                  <span className="text-2xs font-black uppercase tracking-widest text-white">Check-in</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-none bg-white/10" aria-hidden="true" />
                  <span className="text-2xs font-black uppercase tracking-widest text-slate-500">Missed</span>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ── Event history ───────────────────────────────────────────────── */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="mb-8 px-2">
            <h2 className="text-2xs font-black uppercase tracking-spread text-slate-500">Historical Log</h2>
          </div>

          {records.length === 0 ? (
            <div className="rounded-[2.5rem] bg-surface-low p-16 text-center shadow-[0_20px_40px_rgba(7,13,31,0.4)]">
              <span className="material-symbols-outlined text-6xl text-primary/10 mb-6 block" aria-hidden="true">groups</span>
              <h3 className="text-xl font-display font-bold text-white uppercase tracking-tighter">No History Found</h3>
              <p className="text-sm font-medium text-slate-500 mt-2">This member hasn't participated in any events yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map(r => (
                <div
                  key={r.serviceId}
                  className="flex items-center gap-6 px-6 sm:px-8 py-6 rounded-none bg-surface-low hover:bg-surface-highest transition-colors group"
                >
                  <div
                    className={`h-4 w-4 rounded-none flex-shrink-0 shadow-none ${r.status === 'attended'
                        ? 'bg-teal ring-4 ring-teal/10'
                        : r.status === 'absent'
                          ? 'bg-red ring-4 ring-red/10'
                          : 'bg-white/10'
                      }`}
                    aria-hidden="true"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-lg font-bold text-white uppercase tracking-tight group-hover:text-primary-light transition-colors">
                        {r.serviceType}
                      </p>
                      <span
                        className={`rounded-none px-3 py-1 text-2xs font-black uppercase tracking-widest ${r.status === 'attended'
                            ? 'bg-teal/10 text-teal'
                            : r.status === 'absent'
                              ? 'bg-red/10 text-red'
                              : 'bg-white/5 text-slate-400'
                          }`}
                      >
                        {r.status === 'attended'
                          ? 'Present'
                          : r.status === 'absent'
                            ? 'Missed Action'
                            : 'On Orders'}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs font-black uppercase tracking-spaced text-slate-600">{formatDate(r.date)}</p>
                  </div>

                  {r.checkinTime && (
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-xs font-black text-white">{formatTime(r.checkinTime)}</p>
                      <p className="text-2xs font-bold text-slate-600 uppercase tracking-widest">Logged</p>
                    </div>
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


