import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useServices, useUnitAdmins, useUnits } from '../hooks/useAdminDashboard'
import { useAuth } from '../contexts/AuthContext'
import { ConfirmDialog } from '../components/ui/Modal'
import type { Service, ServiceType, Unit, OrgRole } from '../types'
import { NotificationBell } from '../components/NotificationBell'

const EVENT_LABEL: Record<ServiceType, string> = {
  rehearsal: 'Regular Meeting',
  sunday_service: 'Main Event',
}

function serviceStatus(dateStr: string): 'today' | 'upcoming' | 'past' {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr === today) return 'today'
  return dateStr > today ? 'upcoming' : 'past'
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Service card (dark style) ─────────────────────────────────────────────────
function ServiceCard({ service, onClick }: { service: Service; onClick: () => void }) {
  const status = serviceStatus(service.date)
  const isToday = status === 'today'
  const isPast  = status === 'past'

  const accentColor = isToday ? '#5247e6' : isPast ? '#475569' : '#10b981'
  const accentBg    = `${accentColor}1a`
  const statusLabel = { today: 'Active Today', upcoming: 'Scheduled', past: 'Archived' }[status]

  return (
    <button
      onClick={onClick}
      className={`w-full group rounded-xl border transition-all text-left duration-300 animate-in slide-in-from-bottom-2 overflow-hidden hover:scale-[1.01] active:scale-[0.99] ${
        isPast
          ? 'bg-surface-dark border-border-dark opacity-60 hover:opacity-80'
          : 'bg-surface-dark border-border-dark hover:border-primary/40'
      }`}
    >
      {/* Top accent line */}
      <div className="h-0.5 w-full" style={{ backgroundColor: isToday ? accentColor : 'transparent' }} />

      <div className="flex items-center gap-4 p-4 sm:p-5">
        {/* Icon */}
        <div
          className="size-12 sm:size-14 flex-shrink-0 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300"
          style={{ backgroundColor: accentBg }}
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl" style={{ color: accentColor }}>
            {isToday ? 'event_available' : isPast ? 'event' : 'calendar_month'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm sm:text-base font-bold text-slate-100 tracking-tight group-hover:text-primary transition-colors">
              {EVENT_LABEL[service.service_type]}
            </p>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border"
              style={{ color: accentColor, borderColor: `${accentColor}40`, backgroundColor: accentBg }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{formatDate(service.date)}</p>
        </div>

        <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0">
          chevron_right
        </span>
      </div>
    </button>
  )
}

// ── Create Event Modal ────────────────────────────────────────────────────────
function CreateEventModal({
  date, type, error, loading,
  onChangeDate, onChangeType, onSubmit, onClose,
}: {
  date: string; type: ServiceType; error: string | null; loading: boolean
  onChangeDate: (v: string) => void
  onChangeType: (v: ServiceType) => void
  onSubmit: (e: FormEvent) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />

        <div className="flex items-center gap-4 mb-6">
          <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl">calendar_add_on</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Schedule Event</h3>
            <p className="text-xs text-slate-500">Initialise a formal session for attendance tracking</p>
          </div>
          <button onClick={onClose} className="ml-auto size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Date</span>
            <input
              type="date"
              value={date}
              onChange={e => onChangeDate(e.target.value)}
              required
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Type</span>
            <select
              value={type}
              onChange={e => onChangeType(e.target.value as ServiceType)}
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
            >
              <option value="rehearsal">Regular Meeting</option>
              <option value="sunday_service">Main Event</option>
            </select>
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  name, desc, error, loading,
  onChangeName, onChangeDesc, onSubmit, onDelete, onClose,
}: {
  name: string; desc: string; error: string | null; loading: boolean
  onChangeName: (v: string) => void; onChangeDesc: (v: string) => void
  onSubmit: (e: FormEvent) => void; onDelete: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">settings</span>
            Unit Settings
          </h3>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unit Name</span>
            <input value={name} onChange={e => onChangeName(e.target.value)} required
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Description <span className="normal-case font-normal text-slate-600">(optional)</span></span>
            <input value={desc} onChange={e => onChangeDesc(e.target.value)} placeholder="Purpose of this unit…"
              className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all" />
          </label>
          {error && <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex items-center justify-between pt-2">
            <button type="button" onClick={onDelete} className="text-sm font-semibold text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors">
              <span className="material-symbols-outlined text-lg">delete</span> Delete Unit
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 rounded-xl hover:bg-border-dark transition-colors">Cancel</button>
              <button type="submit" disabled={loading}
                className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50">
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Admins Panel Modal (super only) ──────────────────────────────────────────
function AdminsModal({
  admins, newEmail, error, loading,
  onChangeEmail, onSubmit, onRemove, onClose,
}: {
  admins: any[]; newEmail: string; error: string | null; loading: boolean
  onChangeEmail: (v: string) => void; onSubmit: (e: FormEvent) => void
  onRemove: (id: string) => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-surface-dark border border-border-dark rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300 max-h-[80vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border-dark rounded-full mx-auto mb-5 sm:hidden" />
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">manage_accounts</span>
            Unit Admins
          </h3>
          <button onClick={onClose} className="size-9 flex items-center justify-center rounded-xl hover:bg-border-dark text-slate-400 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex gap-2 mb-5">
          <input
            type="email" value={newEmail} onChange={e => onChangeEmail(e.target.value)} placeholder="admin@email.com" required
            className="flex-1 bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 text-sm transition-all"
          />
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 flex-shrink-0">
            {loading ? '…' : 'Add'}
          </button>
        </form>
        {error && <p className="text-sm text-red-400 mb-4 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}
        <div className="flex flex-col gap-2">
          {admins.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No unit admins assigned yet.</p>
          ) : admins.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3 bg-background-dark border border-border-dark">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">person</span>
                </div>
                <span className="text-sm font-medium text-slate-300 truncate">{a.email !== '—' ? a.email : a.user_id}</span>
              </div>
              <button onClick={() => onRemove(a.id)} className="p-2 text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                <span className="material-symbols-outlined text-lg">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UnitDashboard() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const { isSuper, signOut, session } = useAuth()
  const { services, loading: servicesLoading, createService } = useServices(unitId ?? null)
  const { updateUnit, deleteUnit } = useUnits(null)
  const { admins, addAdmin, removeAdmin } = useUnitAdmins(isSuper ? unitId ?? null : null)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAdmins, setShowAdmins]     = useState(false)
  const [userRole, setUserRole] = useState<OrgRole>('member')
  const [isOwnerOrCreator, setIsOwnerOrCreator] = useState(false)

  // Forms state
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newType, setNewType] = useState<ServiceType>('rehearsal')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin]     = useState(false)
  const [adminError, setAdminError]       = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!unitId || !session?.user?.id) return
    supabase
      .from('units')
      .select('*, organization:organizations(*, organization_members!inner(role))')
      .eq('id', unitId)
      .eq('organization.organization_members.admin_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUnit(data)
          const org = data.organization as any
          setOrgName(org?.name ?? '')
          setOrgId(org?.id ?? '')
          setNewName(data.name)
          setNewDesc(data.description ?? '')
          const role = org?.organization_members?.[0]?.role || 'member'
          setUserRole(role)
          setIsOwnerOrCreator(isSuper || role === 'owner' || data.created_by_admin_id === session.user.id)
        }
      })
  }, [unitId, session?.user?.id, isSuper])

  async function handleCreate(e: FormEvent) {
    e.preventDefault(); setError(null); setIsUpdating(true)
    try {
      const svc = await createService(newDate, newType)
      setShowCreate(false)
      navigate(`/admin/units/${unitId}/events/${svc.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('unique') ? 'An event already exists for that date and type.' : msg)
    } finally { setIsUpdating(false) }
  }

  async function handleUpdateUnit(e: FormEvent) {
    e.preventDefault(); if (!unitId) return; setError(null); setIsUpdating(true)
    try {
      const updated = await updateUnit(unitId, newName.trim(), newDesc.trim() || undefined)
      setUnit(updated); setShowSettings(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update unit') }
    finally { setIsUpdating(false) }
  }

  async function handleDeleteUnit() {
    if (!unitId || !unit) return; setIsUpdating(true)
    try {
      await deleteUnit(unitId)
      navigate(isSuper ? `/admin/orgs/${unit.org_id}` : '/admin', { replace: true })
    } catch { setError('Failed to delete unit'); setIsUpdating(false) }
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault(); setAdminError(null); setAddingAdmin(true)
    try { await addAdmin(newAdminEmail.trim().toLowerCase()); setNewAdminEmail('') }
    catch (err) { setAdminError(err instanceof Error ? err.message : 'Failed to add admin') }
    finally { setAddingAdmin(false) }
  }

  const today    = new Date().toISOString().split('T')[0]
  const upcoming = services.filter(s => s.date >= today)
  const past     = services.filter(s => s.date < today)

  const totalSessions = services.length
  const todaySessions = services.filter(s => s.date === today).length

  const roleLabel = userRole === 'owner' ? 'Org Owner' : isOwnerOrCreator ? 'Command' : 'Observer'
  const roleBadgeColor = userRole === 'owner' ? '#5247e6' : isOwnerOrCreator ? '#10b981' : '#64748b'

  return (
    <div className="relative min-h-screen w-full bg-background-dark text-slate-100 font-display antialiased overflow-x-hidden">

      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden pb-8">
        {/* Background glows */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none" />
        <div className="absolute top-0 right-0 -mt-16 -mr-16 size-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-8 size-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between pt-4 pb-6 sm:pt-6">
            <button
              onClick={() => navigate(isSuper && orgId ? `/admin/orgs/${orgId}` : '/admin')}
              className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-white">arrow_back</span>
            </button>

            <span className="text-xs font-bold uppercase tracking-widest text-white/40">Rollcally</span>

            <div className="flex items-center gap-2">
              {unitId && <NotificationBell unitId={unitId} />}
              <button
                onClick={() => signOut()}
                className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-all active:scale-95"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-white text-xl">logout</span>
              </button>
            </div>
          </div>

          {/* Unit identity */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="size-20 sm:size-24 bg-primary/20 border-2 border-primary/40 rounded-3xl flex items-center justify-center mb-4 shadow-2xl shadow-primary/30">
              <span className="material-symbols-outlined text-primary text-4xl sm:text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">{unit?.name ?? 'Unit'}</h1>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {orgName && <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{orgName}</span>}
              {orgName && <span className="text-white/20">·</span>}
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border"
                style={{ color: roleBadgeColor, borderColor: `${roleBadgeColor}40`, backgroundColor: `${roleBadgeColor}15` }}
              >
                {roleLabel}
              </span>
            </div>
            {unit?.description && (
              <p className="text-sm text-white/40 mt-2 max-w-xs">{unit.description}</p>
            )}
          </div>

          {/* Quick stat pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-white">{servicesLoading ? '–' : upcoming.length}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mt-0.5">Upcoming</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-extrabold text-white">{servicesLoading ? '–' : totalSessions}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mt-0.5">Total</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-3 sm:p-4 text-center">
              <p className={`text-xl sm:text-2xl font-extrabold ${todaySessions > 0 ? 'text-emerald-300' : 'text-white'}`}>
                {servicesLoading ? '–' : todaySessions > 0 ? 'Live' : '—'}
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50 mt-0.5">Today</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Action Bar ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background-dark/90 backdrop-blur-md border-b border-border-dark/60">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
          {/* Members — always visible */}
          <button
            onClick={() => navigate(`/admin/units/${unitId}/members`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30 flex-1 sm:flex-none justify-center sm:justify-start"
          >
            <span className="material-symbols-outlined text-sm">group</span>
            Members
          </button>

          {/* Create Event */}
          {isOwnerOrCreator && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-surface-dark border border-border-dark text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl hover:border-primary/50 hover:text-primary active:scale-95 transition-all flex-1 sm:flex-none justify-center sm:justify-start"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Event
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Unit Calendar (QR Code shortcut) */}
            <button
              onClick={() => navigate(`/admin/units/${unitId}/members`)}
              className="size-10 flex items-center justify-center rounded-xl bg-surface-dark border border-border-dark text-slate-500 hover:text-primary hover:border-primary/40 transition-all"
              title="Unit Calendar"
            >
              <span className="material-symbols-outlined text-lg">qr_code</span>
            </button>

            {/* Settings */}
            {isOwnerOrCreator && (
              <button
                onClick={() => setShowSettings(true)}
                className="size-10 flex items-center justify-center rounded-xl bg-surface-dark border border-border-dark text-slate-500 hover:text-primary hover:border-primary/40 transition-all"
                title="Unit Settings"
              >
                <span className="material-symbols-outlined text-lg">settings</span>
              </button>
            )}

            {/* Manage Admins (super only) */}
            {isSuper && (
              <button
                onClick={() => setShowAdmins(true)}
                className="size-10 flex items-center justify-center rounded-xl bg-surface-dark border border-border-dark text-slate-500 hover:text-primary hover:border-primary/40 transition-all"
                title="Manage Admins"
              >
                <span className="material-symbols-outlined text-lg">manage_accounts</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">

        {/* Loading */}
        {servicesLoading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!servicesLoading && services.length === 0 && (
          <div className="bg-surface-dark rounded-2xl border border-dashed border-border-dark p-12 text-center animate-in fade-in duration-300">
            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-4xl text-primary">calendar_month</span>
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">No Events Yet</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mb-7">
              The calendar is clear. Create your first event to generate a check-in QR code and track attendance.
            </p>
            {isOwnerOrCreator && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/30"
              >
                Schedule First Event
              </button>
            )}
          </div>
        )}

        {/* Upcoming events */}
        {!servicesLoading && upcoming.length > 0 && (
          <section className="mb-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-100">Upcoming Sessions</h2>
              <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-wider">
                {upcoming.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {upcoming.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past sessions */}
        {!servicesLoading && past.length > 0 && (
          <section className="animate-in fade-in duration-300">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base font-bold text-slate-400">Past Sessions</h2>
              <span className="px-2 py-0.5 bg-slate-800 text-slate-500 border border-slate-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                {past.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 opacity-70">
              {past.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateEventModal
          date={newDate} type={newType} error={error} loading={isUpdating}
          onChangeDate={setNewDate} onChangeType={setNewType}
          onSubmit={handleCreate}
          onClose={() => { setShowCreate(false); setError(null) }}
        />
      )}
      {showSettings && (
        <SettingsModal
          name={newName} desc={newDesc} error={error} loading={isUpdating}
          onChangeName={setNewName} onChangeDesc={setNewDesc}
          onSubmit={handleUpdateUnit}
          onDelete={() => { setShowSettings(false); setConfirmDelete(true) }}
          onClose={() => { setShowSettings(false); setError(null) }}
        />
      )}
      {isSuper && showAdmins && (
        <AdminsModal
          admins={admins} newEmail={newAdminEmail} error={adminError} loading={addingAdmin}
          onChangeEmail={setNewAdminEmail}
          onSubmit={handleAddAdmin}
          onRemove={removeAdmin}
          onClose={() => { setShowAdmins(false); setAdminError(null) }}
        />
      )}
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteUnit}
        title="Delete Unit"
        description={`Are you sure you want to delete "${unit?.name}"? All events and attendance data will be permanently removed.`}
        confirmText="Delete Unit"
        variant="danger"
        isLoading={isUpdating}
      />
    </div>
  )
}
