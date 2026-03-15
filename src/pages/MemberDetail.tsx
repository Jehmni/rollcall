import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Cake, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Member, ServiceType } from '../types'

const EVENT_LABEL: Record<ServiceType, string> = {
  rehearsal: 'Regular Meeting',
  sunday_service: 'Main Event',
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
    gray: 'text-brand-text',
    green: 'text-green-600',
    amber: 'text-brand-gold',
    red: 'text-red-500',
    blue: 'text-brand-primary',
  }[color]

  return (
    <div className="rounded-[1.5rem] bg-white p-6 border border-brand-border/50 text-center shadow-xl shadow-brand-primary/[0.02] hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 group">
      <p className={`text-4xl font-black tracking-tighter italic ${valueClass} group-hover:scale-110 transition-transform duration-500`}>{value}</p>
      <div className="h-px w-8 bg-brand-border/30 mx-auto my-3"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 leading-tight">{label}</p>
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
      <div className="flex min-h-screen items-center justify-center bg-brand-secondary">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    )
  }

  if (!member) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-brand-secondary text-center">
        <p className="text-brand-slate">Member not found.</p>
        <button
          onClick={() => navigate(`/admin/units/${unitId}/members`)}
          className="text-sm text-brand-primary font-semibold hover:underline"
        >
          Back to members
        </button>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-secondary">

      {/* Header */}
      <header className="flex flex-col gap-8 px-5 sm:px-8 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden sticky top-0 z-30">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate(`/admin/units/${unitId}/members`)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
            title="Back to Roster"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          
          <div className="flex flex-col items-center flex-1 overflow-hidden px-4 text-center">
             <h1 className="text-3xl font-black tracking-tighter italic truncate w-full">{member.name}</h1>
             <div className="flex items-center gap-2 mt-1">
                {member.section && (
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 px-3 py-0.5 rounded-full border border-white/10">
                    {member.section}
                  </span>
                )}
                {member.status === 'inactive' && (
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Retired</span>
                )}
             </div>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/20">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white text-brand-primary shadow-xl shadow-brand-primary/20 border border-white font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all active:scale-95"
            >
              <Phone className="h-4 w-4" /> {member.phone}
            </a>
          )}
          {member.birthday && (
            <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl border font-black text-[10px] uppercase tracking-[0.2em] transition-all ${isBirthday(member.birthday) ? 'bg-pink-600 border-pink-500 text-white shadow-xl shadow-pink-500/20' : 'bg-white/10 border-white/10 text-white'}`}>
              <Cake className="h-4 w-4" /> 
              {formatDate(member.birthday)}
              {isBirthday(member.birthday) && <span className="ml-2">🎂 Anniversary</span>}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-8 flex flex-col gap-8">

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Attended" value={attendedCount} color="gray" />
          <StatCard label="Total Events" value={pastRecords.length} color="gray" />
          <StatCard label="Attendance Rate" value={`${rate}%`} color={rateColor} />
          <StatCard label="Current Streak" value={streak} color="blue" />
        </section>

        {/* ── Recent trend ─────────────────────────────────────────────────── */}
        {recentTrend.length > 0 && (
          <section className="rounded-[2.5rem] bg-white p-6 sm:p-10 border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02] relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 mb-6">
                Activity Score · Last {recentTrend.length} Events
              </h2>

              <div className="flex items-center gap-2.5 flex-wrap">
                {recentTrend.map(r => (
                  <div
                    key={r.serviceId}
                    title={`${EVENT_LABEL[r.serviceType]} · ${r.date}`}
                    className={`h-7 w-7 rounded-lg border-2 flex-shrink-0 transition-all hover:scale-125 hover:rotate-6 cursor-help ${r.status === 'attended'
                        ? 'bg-green-500 border-green-500 shadow-md shadow-green-500/20'
                        : 'bg-white border-brand-border/50'
                      }`}
                  />
                ))}
                <p className="ml-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-20 italic">Timeline</p>
              </div>

              <div className="mt-8 flex items-center gap-6">
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-md bg-green-500 shadow-sm" />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-text">Check-in</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-md border-2 border-brand-border/50 bg-white" />
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-slate opacity-40">Missed</span>
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ── Event history ───────────────────────────────────────────────── */}
        <section className="animate-in fade-in slide-in-from-bottom-6 duration-700">
           <div className="flex items-center gap-3 mb-6 px-2">
             <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
               Historical Log
             </h2>
             <div className="h-px flex-1 bg-brand-border/30"></div>
          </div>

          {records.length === 0 ? (
            <div className="rounded-[2.5rem] bg-white p-16 text-center border border-brand-border/50 shadow-xl shadow-brand-primary/[0.02]">
               <Users className="h-16 w-16 text-brand-primary/5 mx-auto mb-6" />
               <h3 className="text-xl font-black text-brand-text uppercase tracking-tighter italic">No History Found</h3>
               <p className="text-sm font-medium text-brand-slate opacity-40 mt-2">This member hasn't participated in any events yet.</p>
            </div>
          ) : (
            <div className="rounded-[2rem] bg-white border border-brand-border/50 overflow-hidden shadow-2xl shadow-brand-primary/[0.02]">
              {records.map((r, i) => (
                <div
                  key={r.serviceId}
                  className={`flex items-center gap-6 px-6 sm:px-8 py-6 group hover:bg-brand-primary/[0.02] transition-colors ${i < records.length - 1 ? 'border-b border-brand-border/30' : ''
                    }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full flex-shrink-0 shadow-lg ${r.status === 'attended'
                        ? 'bg-green-500 ring-4 ring-green-500/10'
                        : r.status === 'absent'
                          ? 'bg-red-400 ring-4 ring-red-400/10'
                          : 'bg-brand-secondary border border-brand-border/50'
                      }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-lg font-bold text-brand-text uppercase tracking-tight italic group-hover:text-brand-primary transition-colors">
                        {EVENT_LABEL[r.serviceType]}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${r.status === 'attended'
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : r.status === 'absent'
                              ? 'bg-red-50 text-red-600 border-red-100'
                              : 'bg-brand-secondary text-brand-slate border-brand-border/50'
                          }`}
                      >
                        {r.status === 'attended'
                          ? 'Duty Fulfilled'
                          : r.status === 'absent'
                            ? 'Missed Action'
                            : 'On Orders'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-30">{formatDate(r.date)}</p>
                  </div>

                  {r.checkinTime && (
                    <div className="flex flex-col items-end flex-shrink-0">
                       <p className="text-xs font-black text-brand-text">{formatTime(r.checkinTime)}</p>
                       <p className="text-[10px] font-bold text-brand-slate opacity-20 uppercase tracking-widest">Logged</p>
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
