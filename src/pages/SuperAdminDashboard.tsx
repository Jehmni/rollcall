import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  orgs: number; units: number; members: number
  services: number; attendance: number; unitAdmins: number
}

interface OrgRow {
  id: string; name: string; created_at: string
  unit_count: number; member_count: number; blocked_at: string | null
}

interface AdminRow {
  user_id: string; email: string; created_at: string
  org_name: string | null; blocked: boolean
}

interface AttendanceTrend { date: string; count: number }

type Tab = 'overview' | 'orgs' | 'admins'

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="bg-surface-low rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="material-symbols-outlined text-base">{icon}</span>
        <span className="text-2xs font-black uppercase tracking-spaced">{label}</span>
      </div>
      <div className="text-3xl font-extrabold text-white tabular-nums">{value}</div>
    </div>
  )
}

function ConfirmModal({
  title, body, confirmLabel, danger,
  onConfirm, onClose,
}: {
  title: string; body: string; confirmLabel: string; danger?: boolean
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-surface-dark border border-border-dark rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-border-dark transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 text-sm font-bold rounded-xl transition-all active:scale-95 ${danger ? 'bg-red-500 hover:bg-red-400 text-white' : 'bg-primary hover:opacity-90 text-white'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SuperAdminDashboard() {
  const { signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [admins, setAdmins] = useState<AdminRow[]>([])
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; body: string; label: string; danger?: boolean; onConfirm: () => void } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Load overview + orgs ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [
        { count: orgCount }, { count: unitCount }, { count: memberCount },
        { count: serviceCount }, { count: attendanceCount }, { count: unitAdminCount },
      ] = await Promise.all([
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('units').select('*', { count: 'exact', head: true }),
        supabase.from('members').select('*', { count: 'exact', head: true }),
        supabase.from('services').select('*', { count: 'exact', head: true }),
        supabase.from('attendance').select('*', { count: 'exact', head: true }),
        supabase.from('unit_admins').select('*', { count: 'exact', head: true }),
      ])

      setStats({
        orgs: orgCount ?? 0, units: unitCount ?? 0, members: memberCount ?? 0,
        services: serviceCount ?? 0, attendance: attendanceCount ?? 0, unitAdmins: unitAdminCount ?? 0,
      })

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id, name, created_at, blocked_at, units(count), organization_members(count)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (orgData) {
        type Raw = { id: string; name: string; created_at: string; blocked_at: string | null; units: { count: number }[]; organization_members: { count: number }[] }
        setOrgs((orgData as Raw[]).map(o => ({
          id: o.id, name: o.name, created_at: o.created_at, blocked_at: o.blocked_at,
          unit_count: o.units?.[0]?.count ?? 0, member_count: o.organization_members?.[0]?.count ?? 0,
        })))
      }

      // Attendance trend — last 14 days
      const since = new Date(); since.setDate(since.getDate() - 13)
      const { data: attData } = await supabase.from('attendance')
        .select('checkin_time').gte('checkin_time', since.toISOString()).order('checkin_time', { ascending: true })

      if (attData) {
        const buckets: Record<string, number> = {}
        for (let i = 0; i < 14; i++) {
          const d = new Date(since); d.setDate(d.getDate() + i)
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

  // ── Load admins when tab switches ──────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'admins' || admins.length > 0) return
    setAdminsLoading(true)
    supabase.rpc('list_admin_users').then(({ data, error }) => {
      if (!error && data) {
        setAdmins(data as AdminRow[])
      }
      setAdminsLoading(false)
    })
  }, [tab, admins.length])

  // ── Org actions ────────────────────────────────────────────────────────────

  async function blockOrg(org: OrgRow) {
    const { error } = await supabase.from('organizations')
      .update({ blocked_at: new Date().toISOString() }).eq('id', org.id)
    if (error) { setActionError(error.message); return }
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, blocked_at: new Date().toISOString() } : o))
  }

  async function unblockOrg(org: OrgRow) {
    const { error } = await supabase.from('organizations')
      .update({ blocked_at: null }).eq('id', org.id)
    if (error) { setActionError(error.message); return }
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, blocked_at: null } : o))
  }

  async function deleteOrg(org: OrgRow) {
    const { error } = await supabase.from('organizations').delete().eq('id', org.id)
    if (error) { setActionError(error.message); return }
    setOrgs(prev => prev.filter(o => o.id !== org.id))
    setStats(prev => prev ? { ...prev, orgs: prev.orgs - 1 } : prev)
  }

  // ── Admin actions ──────────────────────────────────────────────────────────

  async function blockAdmin(admin: AdminRow) {
    const { error } = await supabase.from('blocked_admins')
      .upsert({ user_id: admin.user_id, blocked_at: new Date().toISOString() })
    if (error) { setActionError(error.message); return }
    setAdmins(prev => prev.map(a => a.user_id === admin.user_id ? { ...a, blocked: true } : a))
  }

  async function unblockAdmin(admin: AdminRow) {
    const { error } = await supabase.from('blocked_admins').delete().eq('user_id', admin.user_id)
    if (error) { setActionError(error.message); return }
    setAdmins(prev => prev.map(a => a.user_id === admin.user_id ? { ...a, blocked: false } : a))
  }

  async function deleteAdmin(admin: AdminRow) {
    // Remove from org and unit admin roles, then call Edge Function to delete auth user
    await supabase.from('organization_members').delete().eq('admin_id', admin.user_id)
    await supabase.from('unit_admins').delete().eq('user_id', admin.user_id)
    const { error } = await supabase.functions.invoke('delete-user', {
      body: { user_id: admin.user_id },
    })
    if (error) { setActionError('Roles removed but could not delete auth account: ' + error.message); return }
    setAdmins(prev => prev.filter(a => a.user_id !== admin.user_id))
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const maxAttendance = Math.max(...attendanceTrend.map(t => t.count), 1)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-dark">
        <div className="relative size-14">
          <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-dark font-display text-white antialiased">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-background-dark/90 backdrop-blur px-6 py-4 flex items-center justify-between border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-base">shield_person</span>
          </div>
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-spaced leading-none">Super Admin</h1>
            <p className="text-2xs text-slate-500 font-medium mt-0.5">Rollcally founder console</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-2xs font-black uppercase tracking-spaced text-slate-500 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="sticky top-[65px] z-20 bg-background-dark/90 backdrop-blur border-b border-white/[0.06] px-6 flex gap-1">
        {(['overview', 'orgs', 'admins'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-spaced transition-colors border-b-2 -mb-px ${tab === t ? 'text-white border-primary' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            {t === 'overview' ? 'Overview' : t === 'orgs' ? 'Organisations' : 'Admins'}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* Global error banner */}
        {actionError && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
            <span className="material-symbols-outlined text-red-400 text-xl flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1">
              <p className="text-sm text-red-400 font-medium">{actionError}</p>
            </div>
            <button onClick={() => setActionError(null)} className="text-slate-500 hover:text-white">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <>
            <section>
              <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Platform Overview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon="domain" label="Organisations" value={stats!.orgs} />
                <StatCard icon="groups" label="Units" value={stats!.units} />
                <StatCard icon="person" label="Members" value={stats!.members} />
                <StatCard icon="event" label="Services" value={stats!.services} />
                <StatCard icon="how_to_reg" label="Check-ins" value={stats!.attendance} />
                <StatCard icon="manage_accounts" label="Unit Admins" value={stats!.unitAdmins} />
              </div>
            </section>

            <section>
              <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">Check-ins — Last 14 Days</h2>
              <div className="bg-surface-low rounded-2xl p-5">
                {attendanceTrend.every(t => t.count === 0) ? (
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
          </>
        )}

        {/* ── ORGANISATIONS TAB ── */}
        {tab === 'orgs' && (
          <section>
            <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">
              All Organisations <span className="text-slate-600">({orgs.length})</span>
            </h2>
            <div className="bg-surface-low rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Name</th>
                    <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500 hidden sm:table-cell">Units</th>
                    <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500 hidden sm:table-cell">Admins</th>
                    <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Status</th>
                    <th className="text-right px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500 text-sm">No organisations yet.</td></tr>
                  )}
                  {orgs.map(org => (
                    <tr key={org.id} className={`border-b border-white/[0.04] last:border-0 transition-colors ${org.blocked_at ? 'bg-red-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white leading-tight">{org.name}</div>
                        <div className="text-2xs text-slate-600 mt-0.5">
                          {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center text-slate-400 tabular-nums hidden sm:table-cell">{org.unit_count}</td>
                      <td className="px-3 py-3.5 text-center text-slate-400 tabular-nums hidden sm:table-cell">{org.member_count}</td>
                      <td className="px-3 py-3.5 text-center">
                        {org.blocked_at ? (
                          <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-2xs font-bold px-2 py-1 rounded-full">
                            <span className="material-symbols-outlined text-xs">block</span>Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-2xs font-bold px-2 py-1 rounded-full">
                            <span className="material-symbols-outlined text-xs">check_circle</span>Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {org.blocked_at ? (
                            <button
                              onClick={() => setConfirm({
                                title: 'Unblock Organisation',
                                body: `Restore access for "${org.name}" and all its admins?`,
                                label: 'Unblock',
                                onConfirm: () => { unblockOrg(org); setConfirm(null) },
                              })}
                              className="text-2xs font-bold text-emerald-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirm({
                                title: 'Block Organisation',
                                body: `Block "${org.name}"? All its admins will be suspended immediately.`,
                                label: 'Block', danger: true,
                                onConfirm: () => { blockOrg(org); setConfirm(null) },
                              })}
                              className="text-2xs font-bold text-amber-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                            >
                              Block
                            </button>
                          )}
                          <button
                            onClick={() => setConfirm({
                              title: 'Delete Organisation',
                              body: `Permanently delete "${org.name}"? This will remove all units, members, and attendance records. This cannot be undone.`,
                              label: 'Delete', danger: true,
                              onConfirm: () => { deleteOrg(org); setConfirm(null) },
                            })}
                            className="text-2xs font-bold text-red-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── ADMINS TAB ── */}
        {tab === 'admins' && (
          <section>
            <h2 className="text-2xs font-black uppercase tracking-spaced text-slate-500 mb-4">
              All Admins <span className="text-slate-600">({admins.length})</span>
            </h2>
            {adminsLoading ? (
              <div className="bg-surface-low rounded-2xl p-10 flex items-center justify-center">
                <div className="relative size-8">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
              </div>
            ) : (
              <div className="bg-surface-low rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Email</th>
                      <th className="text-left px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500 hidden sm:table-cell">Organisation</th>
                      <th className="text-center px-3 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Status</th>
                      <th className="text-right px-5 py-3 text-2xs font-black uppercase tracking-spaced text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 && (
                      <tr><td colSpan={4} className="text-center py-8 text-slate-500 text-sm">No admins found.</td></tr>
                    )}
                    {admins.map(admin => (
                      <tr key={admin.user_id} className={`border-b border-white/[0.04] last:border-0 transition-colors ${admin.blocked ? 'bg-red-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-white leading-tight text-sm">{admin.email}</div>
                          <div className="text-2xs text-slate-600 mt-0.5">
                            {new Date(admin.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-400 text-sm hidden sm:table-cell">{admin.org_name ?? '—'}</td>
                        <td className="px-3 py-3.5 text-center">
                          {admin.blocked ? (
                            <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 text-2xs font-bold px-2 py-1 rounded-full">
                              <span className="material-symbols-outlined text-xs">block</span>Blocked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-2xs font-bold px-2 py-1 rounded-full">
                              <span className="material-symbols-outlined text-xs">check_circle</span>Active
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            {admin.blocked ? (
                              <button
                                onClick={() => setConfirm({
                                  title: 'Unblock Admin',
                                  body: `Restore access for ${admin.email}?`,
                                  label: 'Unblock',
                                  onConfirm: () => { unblockAdmin(admin); setConfirm(null) },
                                })}
                                className="text-2xs font-bold text-emerald-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                              >
                                Unblock
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirm({
                                  title: 'Block Admin',
                                  body: `Block ${admin.email}? They will be suspended immediately.`,
                                  label: 'Block', danger: true,
                                  onConfirm: () => { blockAdmin(admin); setConfirm(null) },
                                })}
                                className="text-2xs font-bold text-amber-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                              >
                                Block
                              </button>
                            )}
                            <button
                              onClick={() => setConfirm({
                                title: 'Delete Admin',
                                body: `Permanently delete ${admin.email}? Their account will be removed from the platform. This cannot be undone.`,
                                label: 'Delete', danger: true,
                                onConfirm: () => { deleteAdmin(admin); setConfirm(null) },
                              })}
                              className="text-2xs font-bold text-red-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </main>

      {/* Confirmation modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
