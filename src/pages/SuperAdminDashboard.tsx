import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface Stats {
  orgs: number
  units: number
  members: number
  services: number
  attendance: number
  unitAdmins: number
}

interface OrgRow {
  id: string
  name: string
  created_at: string
  unit_count: number
  member_count: number
}

interface RecentSignup {
  id: string
  email: string
  created_at: string
  org_name: string | null
}

interface AttendanceTrend {
  date: string
  count: number
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="material-symbols-outlined text-base">{icon}</span>
        <span className="text-2xs font-black uppercase tracking-spaced">{label}</span>
      </div>
      <div className="text-3xl font-extrabold text-white tabular-nums">{value}</div>
      {sub && <div className="text-2xs text-slate-500 font-medium">{sub}</div>}
    </div>
  )
}

export default function SuperAdminDashboard() {
  const { signOut } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([])
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { count: orgCount },
        { count: unitCount },
        { count: memberCount },
        { count: serviceCount },
        { count: attendanceCount },
        { count: unitAdminCount },
      ] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('services').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('*', { count: 'exact', head: true }),
        supabase.from('unit_admins').select('*', { count: 'exact', head: true }),
      ])

      setStats({
        orgs: orgCount ?? 0,
        units: unitCount ?? 0,
        members: memberCount ?? 0,
        services: serviceCount ?? 0,
        attendance: attendanceCount ?? 0,
        unitAdmins: unitAdminCount ?? 0,
      })

      // Top orgs by units + members
      const { data: orgData } = await supabase
        .from('organizations')
        .select(`
          id, name, created_at,
          units(count),
          organization_members(count)
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (orgData) {
        setOrgs(
          orgData.map((o: any) => ({
            id: o.id,
            name: o.name,
            created_at: o.created_at,
            unit_count: o.units?.[0]?.count ?? 0,
            member_count: o.organization_members?.[0]?.count ?? 0,
          }))
        )
      }

      // Recent org_member signups (admin users joining orgs)
      const { data: signupData } = await supabase
        .from('organization_members')
        .select(`
          id,
          created_at,
          organizations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (signupData) {
        setRecentSignups(
          signupData.map((s: any, i: number) => ({
            id: s.id ?? String(i),
            email: '—',
            created_at: s.created_at,
            org_name: s.organizations?.name ?? null,
          }))
        )
      }

      // Attendance by day (last 14 days)
      const since = new Date()
      since.setDate(since.getDate() - 13)
      const { data: attData } = await supabase
        .from('attendance')
        .select('checkin_time')
        .gte('checkin_time', since.toISOString())
        .order('checkin_time', { ascending: true })

      if (attData) {
        const buckets: Record<string, number> = {}
        for (let i = 0; i < 14; i++) {
          const d = new Date(since)
          d.setDate(d.getDate() + i)
          buckets[d.toISOString().slice(0, 10)] = 0
        }
        for (const row of attData) {
          const day = (row.checkin_time as string).slice(0, 10)
          if (day in buckets) buckets[day]++
        }
        setAttendanceTrend(Object.entries(buckets).map(([date, count]) => ({ date, count })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const maxAttendance = Math.max(...attendanceTrend.map((t) => t.count), 1)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="relative size-14">
            <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-2xs font-black uppercase tracking-spaced text-slate-500">Loading</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-dark font-display text-white antialiased">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background-dark/90 backdrop-blur border-b border-primary/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-base">shield_person</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-spaced leading-none">Super Admin</h1>
            <p className="text-2xs text-slate-500 font-medium mt-0.5">Rollcally founder console</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-spaced text-slate-500 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Stats grid */}
        <section>
          <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Platform Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon="domain" label="Organizations" value={stats!.orgs} />
            <StatCard icon="groups" label="Units" value={stats!.units} />
            <StatCard icon="person" label="Members" value={stats!.members} />
            <StatCard icon="event" label="Services" value={stats!.services} />
            <StatCard icon="how_to_reg" label="Check-ins" value={stats!.attendance} />
            <StatCard icon="manage_accounts" label="Unit Admins" value={stats!.unitAdmins} />
          </div>
        </section>

        {/* Attendance trend — last 14 days */}
        <section>
          <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Check-ins — Last 14 Days</h2>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5">
            {attendanceTrend.every((t) => t.count === 0) ? (
              <p className="text-slate-500 text-sm text-center py-4">No check-ins in the last 14 days.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-24">
                {attendanceTrend.map(({ date, count }) => (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div
                      className="w-full bg-primary/40 group-hover:bg-primary/70 rounded-sm transition-colors"
                      style={{ height: `${Math.max(4, (count / maxAttendance) * 80)}px` }}
                      title={`${date}: ${count}`}
                    />
                    <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors hidden sm:block">
                      {date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Organizations table */}
        <section>
          <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Organizations</h2>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10">
                  <th className="text-left px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Name</th>
                  <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Units</th>
                  <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Admins</th>
                  <th className="text-right px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500 text-sm">No organizations yet.</td>
                  </tr>
                )}
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/5 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-white">{org.name}</td>
                    <td className="px-3 py-3.5 text-center text-slate-400 tabular-nums">{org.unit_count}</td>
                    <td className="px-3 py-3.5 text-center text-slate-400 tabular-nums">{org.member_count}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
                      {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent admin activity */}
        <section>
          <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Recent Admin Enrollments</h2>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10">
                  <th className="text-left px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Organization</th>
                  <th className="text-right px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentSignups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center py-8 text-slate-500 text-sm">No recent activity.</td>
                  </tr>
                )}
                {recentSignups.map((s) => (
                  <tr key={s.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/5 transition-colors">
                    <td className="px-5 py-3.5 text-slate-300 font-medium">{s.org_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
                      {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
