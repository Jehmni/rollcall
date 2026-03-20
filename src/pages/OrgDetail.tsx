import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUnits, useOrganizations as useAdminOrgs, useOrgStats } from '../hooks/useAdminDashboard'
import { useOrganizations } from '../hooks/useOrganizations'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmDialog } from '../components/ui/Modal'
import type { Unit } from '../types'
import type { UnitStats } from '../hooks/useAdminDashboard'

// ── Accent palette ─────────────────────────────────────────────────────────────
const ACCENTS = ['#5247e6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']
const ICONS   = ['groups', 'hub', 'terminal', 'bolt', 'star', 'build', 'rocket_launch']
function unitAccent(name: string) {
  const i = name.charCodeAt(0) % ACCENTS.length
  return { color: ACCENTS[i], icon: ICONS[i], bg: `${ACCENTS[i]}1a` }
}

// ── Stat Pill ──────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, color = '#5247e6' }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
      <span className="material-symbols-outlined text-[14px]" style={{ color }}>{icon}</span>
      <span className="text-2xs font-semibold text-slate-400 leading-none">{value} <span className="text-slate-500">{label}</span></span>
    </div>
  )
}

// ── Unit Card ──────────────────────────────────────────────────────────────────
function UnitCard({
  unit, stats, canManage, onClick, onDelete, onEdit,
}: {
  unit: Unit; stats: UnitStats | undefined
  canManage: boolean; onClick: () => void; onDelete: () => void; onEdit: () => void
}) {
  const { color, icon, bg } = unitAccent(unit.name)
  const memberCount  = stats?.memberCount  ?? null
  const sessionCount = stats?.sessionCount ?? null

  return (
    <div
      className="group relative bg-surface-dark rounded-xl border border-border-dark hover:border-primary/40 transition-all cursor-pointer animate-in slide-in-from-bottom-2 duration-300 overflow-hidden"
      onClick={onClick}
    >
      {/* Subtle accent glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle at 20% 50%, ${color}0d 0%, transparent 60%)` }} />

      <div className="relative flex items-center gap-4 p-4 sm:p-5">
        {/* Icon */}
        <div className="size-12 sm:size-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-300" style={{ backgroundColor: bg }}>
          <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ color }}>{icon}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-base text-slate-100 truncate mb-1">{unit.name}</h4>
          {unit.description && (
            <p className="text-xs text-slate-500 truncate mb-2">{unit.description}</p>
          )}
          {/* Analytics pills */}
          <div className="flex flex-wrap gap-1.5">
            {memberCount !== null ? (
              <StatPill icon="person" label="members" value={memberCount} color={color} />
            ) : (
              <div className="h-5 w-20 bg-white/5 rounded-full animate-pulse" />
            )}
            {sessionCount !== null && (
              <StatPill
                icon={sessionCount > 0 ? 'event_available' : 'event'}
                label={sessionCount === 1 ? 'session' : 'sessions (30d)'}
                value={sessionCount}
                color={sessionCount > 0 ? '#10b981' : '#64748b'}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canManage && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit() }}
                className="size-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-primary hover:bg-primary/10 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Edit unit"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="size-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                title="Delete unit"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </>
          )}
          <span className="material-symbols-outlined text-slate-600 text-xl group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all">chevron_right</span>
        </div>
      </div>
    </div>
  )
}

// ── Unit Form Modal ─────────────────────────────────────────────────────────────
function UnitFormModal({ editing, name, desc, error, loading, onChangeName, onChangeDesc, onSubmit, onClose }: {
  editing: Unit | null; name: string; desc: string; error: string | null; loading: boolean
  onChangeName: (v: string) => void; onChangeDesc: (v: string) => void
  onSubmit: (e: FormEvent) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100">{editing ? 'Edit Unit' : 'New Unit'}</h3>
          <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 active:scale-95 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit Name</span>
            <input className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
              placeholder="e.g. Volunteers, Backend Team…" value={name} onChange={e => onChangeName(e.target.value)} required autoFocus />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description <span className="text-slate-500 normal-case font-normal">(optional)</span></span>
            <input className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
              placeholder="Purpose of this group…" value={desc} onChange={e => onChangeDesc(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-border-dark">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50">
              {loading ? 'Saving…' : editing ? 'Update Unit' : 'Create Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Settings Modal ──────────────────────────────────────────────────────────────
function SettingsModal({ orgName, onChange, onSave, onDelete, onClose, loading, error }: {
  orgName: string; onChange: (v: string) => void; onSave: (e: FormEvent) => void
  onDelete: () => void; onClose: () => void; loading: boolean; error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">settings</span>
            Organisation Settings
          </h3>
          <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 active:scale-95 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Organisation Name</span>
            <input className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
              value={orgName} onChange={e => onChange(e.target.value)} required />
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onDelete} className="text-sm font-semibold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors">
              <span className="material-symbols-outlined text-lg">delete</span> Delete Organisation
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function OrgDetail() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const { session, isSuper } = useAuth()
  const { orgs, updateOrg, deleteOrg } = useAdminOrgs()
  const { units, loading, createUnit, updateUnit, deleteUnit } = useUnits(orgId ?? null)
  const { getOrgJoinRequests, respondToJoinRequest } = useOrganizations()

  const org = orgs.find(o => o.id === orgId)
  const isOwner = isSuper || org?.userRole === 'owner'

  // Analytics
  const unitIds = units.map(u => u.id)
  const { stats, loading: statsLoading } = useOrgStats(orgId ?? null, unitIds)

  const [activeTab, setActiveTab] = useState<'units' | 'requests'>('units')
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [createdUnit, setCreatedUnit] = useState<Unit | null>(null)

  const [joinRequests, setJoinRequests] = useState<{ id: string; admin_id: string; admin_email: string; status: string; created_at: string }[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)

  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [orgName, setOrgName] = useState(org?.name ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false)
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!isOwner) return
    const doFetch = async () => {
      setLoadingRequests(true)
      const data = await getOrgJoinRequests(orgId!)
      setJoinRequests(data)
      setLoadingRequests(false)
    }
    doFetch()
  }, [isOwner, orgId, getOrgJoinRequests])

  if (org && !orgName && !isUpdating) setOrgName(org.name)

  const pendingCount = joinRequests.filter(r => r.status === 'pending').length

  // ── handlers ─────────────────────────────────────────────────────────────────

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setError(null); setIsUpdating(true)
    try {
      const unit = await createUnit(newName.trim(), newDesc.trim() || undefined)
      setNewName(''); setNewDesc(''); setShowCreate(false); setCreatedUnit(unit)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create unit') }
    finally { setIsUpdating(false) }
  }

  async function handleUpdateOrg(e: FormEvent) {
    e.preventDefault(); if (!orgId) return; setError(null); setIsUpdating(true)
    try { await updateOrg(orgId, orgName.trim()); setShowSettings(false) }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to update') }
    finally { setIsUpdating(false) }
  }

  async function handleDeleteOrg() {
    if (!orgId) return; setIsUpdating(true)
    try { await deleteOrg(orgId); navigate('/admin', { replace: true }) }
    catch { setError('Failed to delete'); setIsUpdating(false) }
  }

  async function handleUpdateUnit(e: FormEvent) {
    e.preventDefault(); if (!editingUnit) return; setError(null); setIsUpdating(true)
    try {
      await updateUnit(editingUnit.id, newName.trim(), newDesc.trim() || undefined)
      setEditingUnit(null); setNewName(''); setNewDesc('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update unit') }
    finally { setIsUpdating(false) }
  }

  async function handleDeleteUnit() {
    if (!confirmDeleteUnit) return
    await deleteUnit(confirmDeleteUnit.id); setConfirmDeleteUnit(null)
  }

  const openCreate = () => { setEditingUnit(null); setNewName(''); setNewDesc(''); setError(null); setShowCreate(true) }
  const startEdit = (u: Unit) => { setEditingUnit(u); setNewName(u.name); setNewDesc(u.description ?? ''); setError(null); setShowCreate(false) }

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (createdUnit) {
    return (
      <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased">
        <header className="grid grid-cols-3 items-center px-4 py-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-border-dark/60">
          <button onClick={() => navigate(`/admin/units/${createdUnit.id}`)} className="size-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors">
            <span className="material-symbols-outlined text-white">close</span>
          </button>
          <span className="text-center font-display font-bold text-white uppercase italic tracking-tighter text-sm">Unit Created</span>
          <div />
        </header>
        <main className="flex-1 flex flex-col items-center px-5 pt-8 pb-12">
          <div className="w-full max-w-sm pt-4 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <div className="relative flex flex-col items-center justify-center mb-8">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150" />
                <div className="relative bg-primary text-white rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(82,71,230,0.5)] border border-white/20">
                  <span className="material-symbols-outlined !text-7xl">check_circle</span>
                </div>
              </div>
              <div className="text-center space-y-3 mb-12">
                <h1 className="text-white text-5xl font-display font-bold tracking-tighter uppercase italic">Unit Launched!</h1>
                <p className="text-slate-400 text-lg font-medium tracking-tight">New unit is online and ready</p>
              </div>
              <div className="w-full bg-primary/5 border border-primary/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm relative">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 size-32 bg-primary/10 rounded-full blur-3xl" />
                <div className="p-8 text-center border-b border-primary/10">
                  <div className="inline-flex size-20 rounded-[2rem] bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-primary text-4xl">groups</span>
                  </div>
                  <h2 className="text-white text-3xl font-display font-bold uppercase italic tracking-tighter mb-1">{createdUnit.name}</h2>
                  <p className="text-primary font-black uppercase tracking-spaced text-2xs">Active Unit Node</p>
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20">
                      <span className="material-symbols-outlined text-2xl">corporate_fare</span>
                    </div>
                    <div>
                      <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Organisation</p>
                      <p className="text-white font-display font-bold uppercase italic text-lg tracking-tight">{org?.name || 'Hub'}</p>
                    </div>
                  </div>
                  {createdUnit.description && (
                    <div className="flex items-center gap-5">
                      <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20">
                        <span className="material-symbols-outlined text-2xl">info</span>
                      </div>
                      <div>
                        <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Objective</p>
                        <p className="text-white font-bold text-lg tracking-tight">{createdUnit.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full mt-10">
                <button onClick={() => navigate(`/admin/units/${createdUnit.id}`)}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-3xl shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 uppercase tracking-spread text-xs">
                  <span>Enter Unit</span>
                  <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <button onClick={() => setCreatedUnit(null)} className="w-full text-2xs font-black uppercase tracking-spread text-slate-500 hover:text-primary transition-colors py-4 mt-2">
                  Back to Organisation
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ── Main Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-dark text-slate-100 font-display antialiased">

      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-background-dark/90 px-4 py-4 backdrop-blur-md border-b border-border-dark/60">
        <button onClick={() => navigate('/admin')} className="size-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors">
          <span className="material-symbols-outlined text-slate-100">arrow_back</span>
        </button>
        <h1 className="text-base font-bold tracking-tight text-slate-100 truncate max-w-[60vw]">{org?.name ?? 'Organisation'}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/help')}
            className="size-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors"
            title="User Guide"
          >
            <span className="material-symbols-outlined text-slate-400 hover:text-slate-100 transition-colors">help</span>
          </button>
          {isOwner && (
            <button onClick={() => setShowSettings(true)} className="size-10 flex items-center justify-center rounded-full hover:bg-surface-dark transition-colors">
              <span className="material-symbols-outlined text-slate-400 hover:text-slate-100 transition-colors">settings</span>
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-16">

        {/* Hero */}
        <section className="pt-6 pb-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">{org?.name ?? 'Organization'}</h2>
          <p className="mt-1 text-slate-500 text-sm">Manage your units, members, and requests</p>
        </section>

        {/* ── Top Analytics Row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Total Members */}
          <div className="bg-surface-dark p-4 rounded-xl border border-border-dark col-span-1">
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Members</p>
            {statsLoading ? (
              <div className="h-7 w-16 bg-white/5 rounded animate-pulse mb-2" />
            ) : (
              <p className="text-2xl font-bold text-slate-100 mb-1">{stats.totalMembers}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <span className="material-symbols-outlined text-sm">people</span>
              <span>active</span>
            </div>
          </div>

          {/* Total Units */}
          <div className="bg-surface-dark p-4 rounded-xl border border-border-dark col-span-1">
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Units</p>
            {loading ? (
              <div className="h-7 w-8 bg-white/5 rounded animate-pulse mb-2" />
            ) : (
              <p className="text-2xl font-bold text-slate-100 mb-1">{units.length}</p>
            )}
            <div className="flex items-center gap-1 text-xs text-primary font-medium">
              <span className="material-symbols-outlined text-sm">hub</span>
              <span>units</span>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-surface-dark p-4 rounded-xl border border-border-dark col-span-1">
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Requests</p>
            <p className="text-2xl font-bold text-slate-100 mb-1">{loadingRequests ? '—' : pendingCount}</p>
            <div className={`flex items-center gap-1 text-xs font-medium ${pendingCount > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
              <span className="material-symbols-outlined text-sm">{pendingCount > 0 ? 'notifications_active' : 'check_circle'}</span>
              <span>{pendingCount > 0 ? 'pending' : 'all clear'}</span>
            </div>
          </div>

          {/* Sessions (30d) */}
          <div className="bg-surface-dark p-4 rounded-xl border border-border-dark col-span-1">
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Sessions (30d)</p>
            {statsLoading ? (
              <div className="h-7 w-10 bg-white/5 rounded animate-pulse mb-2" />
            ) : (
              <p className="text-2xl font-bold text-slate-100 mb-1">
                {Object.values(stats.unitStats).reduce((s, u) => s + u.sessionCount, 0)}
              </p>
            )}
            <div className="flex items-center gap-1 text-xs text-cyan-400 font-medium">
              <span className="material-symbols-outlined text-sm">event_available</span>
              <span>meetings</span>
            </div>
          </div>
        </div>

        {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
        {isOwner && (
          <div className="flex gap-1 bg-surface-dark border border-border-dark p-1 rounded-xl mb-5">
            <button
              onClick={() => setActiveTab('units')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'units' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Active Units
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'requests' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Requests
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1 bg-amber-400 text-black text-2xs font-black size-4 flex items-center justify-center rounded-full">{pendingCount}</span>
              )}
            </button>
          </div>
        )}

        {/* ── Units Tab ───────────────────────────────────────────────────────── */}
        {(activeTab === 'units' || !isOwner) && (
          <section className="animate-in fade-in duration-200">
            {/* Section header + prominent New Unit button */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-100">Active Units</h3>
            </div>

            {/* Prominent "New Unit" CTA — visible to all org members */}
            {(isOwner || org?.userRole === 'member') && (
              <button
                onClick={openCreate}
                className="w-full mb-5 flex items-center justify-center gap-2 py-4 rounded-xl bg-primary/10 border-2 border-dashed border-primary/40 text-primary font-bold text-sm hover:bg-primary/20 hover:border-primary/70 active:scale-[0.98] transition-all group"
              >
                <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform duration-300">add_circle</span>
                Create New Unit
              </button>
            )}

            {loading ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-surface-dark border border-border-dark p-4 flex items-center gap-4">
                    <div className="size-12 rounded-xl flex-shrink-0 animate-pulse bg-white/[0.06]" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.06]" />
                      <div className="h-3 w-20 animate-pulse rounded-lg bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : units.length === 0 ? (
              <div className="bg-surface-dark rounded-xl border border-dashed border-border-dark p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-700 block mb-3">groups</span>
                <p className="font-bold text-slate-300 mb-1">No units yet</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs mx-auto">
                  Create a unit to start managing members and tracking attendance.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {units.map(u => (
                  <UnitCard
                    key={u.id}
                    unit={u}
                    stats={stats.unitStats[u.id]}
                    canManage={isOwner || u.created_by_admin_id === session?.user?.id}
                    onClick={() => navigate(`/admin/units/${u.id}`)}
                    onEdit={() => startEdit(u)}
                    onDelete={() => setConfirmDeleteUnit({ id: u.id, name: u.name })}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Requests Tab ────────────────────────────────────────────────────── */}
        {activeTab === 'requests' && isOwner && (
          <section className="animate-in fade-in duration-200">
            <h3 className="text-lg font-bold text-slate-100 mb-4">
              Membership Requests
              {pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center size-5 bg-amber-400 text-black rounded-full text-2xs font-black">{pendingCount}</span>
              )}
            </h3>
            {loadingRequests ? (
              <div className="space-y-2 animate-in fade-in duration-200">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-surface-dark border border-border-dark p-4 flex items-center gap-3">
                    <div className="size-9 rounded-full flex-shrink-0 animate-pulse bg-white/[0.06]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 animate-pulse rounded-md bg-white/[0.06]" />
                      <div className="h-2.5 w-20 animate-pulse rounded-md bg-white/[0.06]" />
                    </div>
                    <div className="flex gap-2">
                      <div className="size-9 rounded-xl animate-pulse bg-white/[0.06]" />
                      <div className="size-9 rounded-xl animate-pulse bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="bg-surface-dark rounded-xl border border-border-dark p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-700 block mb-2">inbox</span>
                <p className="font-semibold text-slate-400 mb-1">No requests</p>
                <p className="text-sm text-slate-500">All membership requests will appear here.</p>
              </div>
            ) : (
              <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
                <div className="divide-y divide-border-dark">
                  {joinRequests.map(req => (
                    <div key={req.id} className="p-4 flex items-center justify-between gap-4 hover:bg-border-dark/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary text-xl">person</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-100 truncate">{req.admin_email || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {req.status === 'pending'
                              ? `Requested ${new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                              : `Status: ${req.status}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {req.status === 'pending' ? (
                          <>
                            <button
                              onClick={async () => { await respondToJoinRequest(req.id, 'rejected'); setJoinRequests(p => p.filter(r => r.id !== req.id)) }}
                              className="size-10 flex items-center justify-center rounded-xl bg-border-dark text-slate-500 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all" title="Decline">
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                            <button
                              onClick={async () => { await respondToJoinRequest(req.id, 'approved'); setJoinRequests(p => p.filter(r => r.id !== req.id)) }}
                              className="size-10 flex items-center justify-center rounded-xl bg-primary text-white hover:opacity-90 active:scale-95 transition-all" title="Approve">
                              <span className="material-symbols-outlined text-lg">check</span>
                            </button>
                          </>
                        ) : (
                          <span className={`px-3 py-1 rounded-lg text-2xs font-bold uppercase tracking-wider ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Bottom Nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-surface-dark/95 backdrop-blur-xl border-t border-border-dark px-2 pt-2 pb-[env(safe-area-inset-bottom,1rem)]">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button onClick={() => setActiveTab('units')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'units' ? 'text-primary' : 'text-slate-500'}`}>
            <span className="material-symbols-outlined" style={activeTab === 'units' ? { fontVariationSettings: "'FILL' 1" } : {}}>dashboard</span>
            <span className="text-2xs font-bold">Dashboard</span>
          </button>
          {isOwner && (
            <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center gap-1 p-2 transition-colors relative ${activeTab === 'requests' ? 'text-primary' : 'text-slate-500'}`}>
              {pendingCount > 0 && <span className="absolute top-1 right-1 bg-amber-400 size-2 rounded-full" />}
              <span className="material-symbols-outlined" style={activeTab === 'requests' ? { fontVariationSettings: "'FILL' 1" } : {}}>group_add</span>
              <span className="text-2xs font-bold">Requests</span>
            </button>
          )}
          <button onClick={() => navigate('/admin')} className="flex flex-col items-center gap-1 p-2 text-slate-500 transition-colors">
            <span className="material-symbols-outlined">home</span>
            <span className="text-2xs font-medium">Home</span>
          </button>
          <button onClick={() => navigate('/admin/discover')} className="flex flex-col items-center gap-1 p-2 text-slate-500 transition-colors">
            <span className="material-symbols-outlined">explore</span>
            <span className="text-2xs font-medium">Explore</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {(showCreate || editingUnit) && (
        <UnitFormModal
          editing={editingUnit} name={newName} desc={newDesc} error={error} loading={isUpdating}
          onChangeName={setNewName} onChangeDesc={setNewDesc}
          onSubmit={editingUnit ? handleUpdateUnit : handleCreate}
          onClose={() => { setShowCreate(false); setEditingUnit(null); setError(null) }}
        />
      )}
      {showSettings && (
        <SettingsModal
          orgName={orgName} onChange={setOrgName} onSave={handleUpdateOrg}
          onDelete={() => { setShowSettings(false); setConfirmDeleteOrg(true) }}
          onClose={() => { setShowSettings(false); setError(null) }}
          loading={isUpdating} error={error}
        />
      )}
      <ConfirmDialog isOpen={confirmDeleteOrg} onClose={() => setConfirmDeleteOrg(false)} onConfirm={handleDeleteOrg}
        title="Delete Organisation" description={`DANGER: Delete "${org?.name}"? All units, members, and historical records will be permanently removed.`}
        confirmText="Delete Everything" variant="danger" isLoading={isUpdating} />
      <ConfirmDialog isOpen={!!confirmDeleteUnit} onClose={() => setConfirmDeleteUnit(null)} onConfirm={handleDeleteUnit}
        title="Delete Unit" description={`Delete "${confirmDeleteUnit?.name}"? All events and attendance data will be permanently lost.`}
        confirmText="Delete Unit" variant="danger" isLoading={isUpdating} />
    </div>
  )
}
