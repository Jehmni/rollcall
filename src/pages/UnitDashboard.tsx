import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, CalendarDays, Users, ChevronRight, LogOut, UserCog, Settings, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useServices, useUnitAdmins, useUnits } from '../hooks/useAdminDashboard'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
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

function ServiceCard({ service, unitId, onClick }: { service: Service; unitId: string; onClick: () => void }) {
  const status = serviceStatus(service.date)
  const statusStyle = { today: 'bg-brand-primary/10 text-brand-primary', upcoming: 'bg-green-100 text-green-700', past: 'bg-brand-secondary text-brand-slate' }[status]
  const statusLabel = { today: 'Today', upcoming: 'Upcoming', past: 'Past' }[status]
  const iconBg = { today: 'bg-brand-primary', upcoming: 'bg-green-600', past: 'bg-brand-secondary' }[status]
  const iconColor = status === 'past' ? 'text-brand-slate' : 'text-white'

  void unitId // used by parent for navigation

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-2xl bg-white px-4 py-4 border border-brand-border hover:border-brand-primary/30 hover:shadow-md transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <CalendarDays className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-brand-text">{EVENT_LABEL[service.service_type]}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
          </div>
          <p className="text-xs text-brand-slate/60 mt-0.5">{formatDate(service.date)}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
    </button>
  )
}

export default function UnitDashboard() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const { isSuper, signOut, session } = useAuth()
  const { services, loading: servicesLoading, createService } = useServices(unitId ?? null)
  const { updateUnit, deleteUnit } = useUnits(null) // pass null because we don't need a list here
  const { admins, addAdmin, removeAdmin } = useUnitAdmins(isSuper ? unitId ?? null : null)

  const [unit, setUnit] = useState<Unit | null>(null)
  const [orgName, setOrgName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showAdmins, setShowAdmins] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
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
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)

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
          setNewName(data.name)
          setNewDesc(data.description ?? '')
          
          const role = org?.organization_members?.[0]?.role || 'member'
          setUserRole(role)
          setIsOwnerOrCreator(isSuper || role === 'owner' || data.created_by_admin_id === session.user.id)
        }
      })
  }, [unitId, session?.user?.id, isSuper])


  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsUpdating(true)
    try {
      const svc = await createService(newDate, newType)
      setShowCreate(false)
      navigate(`/admin/units/${unitId}/events/${svc.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('unique') ? 'An event already exists for that date and type.' : msg)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleUpdateUnit(e: FormEvent) {
    e.preventDefault()
    if (!unitId) return
    setError(null)
    setIsUpdating(true)
    try {
      const updated = await updateUnit(unitId, newName.trim(), newDesc.trim() || undefined)
      setUnit(updated)
      setShowSettings(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit')
    } finally {
      setIsUpdating(false)
    }
  }

  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleDeleteUnit() {
    if (!unitId || !unit) return
    setIsUpdating(true)
    try {
      await deleteUnit(unitId)
      navigate(isSuper ? `/admin/orgs/${unit.org_id}` : '/admin', { replace: true })
    } catch {
      setError('Failed to delete unit')
      setIsUpdating(false)
    }
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault()
    setAdminError(null)
    setAddingAdmin(true)
    try {
      await addAdmin(newAdminEmail.trim().toLowerCase())
      setNewAdminEmail('')
    } catch (_err) {
      setAdminError(_err instanceof Error ? _err.message : 'Failed to add admin')
    } finally {
      setAddingAdmin(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = services.filter(s => s.date >= today)
  const past = services.filter(s => s.date < today)

  return (
    <div className="min-h-screen bg-brand-secondary">
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-brand-border">
        <button
          onClick={() => navigate(isSuper && unit ? `/admin/orgs/${unit.org_id}` : '/admin')}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-gray-100 transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-brand-text truncate">{unit?.name ?? 'Unit'}</h1>
          <div className="flex items-center gap-2">
            {orgName && <p className="text-xs text-brand-primary font-medium">{orgName}</p>}
            <span className="text-[10px] text-brand-slate uppercase tracking-wider bg-brand-secondary px-1.5 py-0.5 rounded-md border border-brand-border">
              {userRole === 'owner' ? 'Org Owner' : isOwnerOrCreator ? 'Unit Manager' : 'View Only'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {unitId && <NotificationBell unitId={unitId} />}
          <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/units/${unitId}/members`)} title="View Members">
            <Users className="h-4 w-4" />
          </Button>
          {isOwnerOrCreator && (
            <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className={showSettings ? 'bg-brand-secondary' : ''} title="Unit Settings">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {isSuper && (
            <Button variant="ghost" size="sm" onClick={() => setShowAdmins(v => !v)} className={showAdmins ? 'bg-brand-secondary' : ''} title="Unit Admins">
              <UserCog className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} title="Sign Out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-8">

        {showSettings && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
             <Card className="p-6 border-brand-primary/10 bg-white shadow-xl shadow-brand-primary/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-primary" /> Unit Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-brand-slate hover:text-brand-text">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateUnit} className="space-y-4">
                <Input
                  label="Unit Name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Volunteers, Youth Group, or Staff"
                  required
                />
                <Input
                  label="Description"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Optional description"
                />
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" type="button" onClick={() => setConfirmDelete(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Unit
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" type="button" onClick={() => setShowSettings(false)}>Cancel</Button>
                    <Button size="sm" type="submit" loading={isUpdating}>Save Changes</Button>
                  </div>
                </div>
              </form>
             </Card>
          </section>
        )}

        {/* Unit admins panel (super admin only) */}
        {isSuper && showAdmins && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <Card className="p-6 border-brand-border bg-white shadow-xl shadow-brand-slate/5">
              <h3 className="text-lg font-bold text-brand-text flex items-center gap-2 mb-4">
                <UserCog className="h-5 w-5 text-brand-slate" /> Managed Unit Admins
              </h3>
              <form onSubmit={handleAddAdmin} className="flex gap-2 mb-4">
                <Input
                  placeholder="admin@email.com"
                  type="email"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                  error={adminError ?? undefined}
                  required
                  className="flex-1"
                />
                <Button size="sm" type="submit" loading={addingAdmin}>Add Admin</Button>
              </form>
              {admins.length > 0 && (
                <div className="flex flex-col gap-2">
                  {admins.map(a => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl px-4 py-3 bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                          ID
                        </div>
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{a.user_id}</span>
                      </div>
                      <button onClick={() => removeAdmin(a.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Create service */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate">Events</h2>
            {isOwnerOrCreator && (
              <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="shadow-lg shadow-blue-200/50">
                <Plus className="h-4 w-4 mr-1.5" /> New Event
              </Button>
            )}
          </div>

          {showCreate && (
            <form onSubmit={handleCreate} className="mb-8 rounded-2xl bg-white p-6 shadow-xl shadow-brand-primary/5 border border-brand-border flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-brand-primary/5 rounded-lg">
                  <CalendarDays className="h-5 w-5 text-brand-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-brand-text">Schedule Event</h3>
                  <p className="text-xs text-brand-slate">Set a date and type for your next gathering.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-brand-text">Event Type</label>
                  <select
                    className="w-full rounded-xl border border-brand-border bg-brand-secondary px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all font-medium h-[50px] text-brand-text"
                    value={newType}
                    onChange={e => setNewType(e.target.value as ServiceType)}
                  >
                    <option value="rehearsal">Regular Meeting</option>
                    <option value="sunday_service">Main Event</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => { setShowCreate(false); setError(null) }}>Cancel</Button>
                <Button size="sm" type="submit" loading={isUpdating}>Create &amp; Start Admin</Button>
              </div>
            </form>
          )}

          {/* Service list */}
          {servicesLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            </div>
          ) : services.length === 0 ? (
            <Card className="rounded-3xl bg-white p-12 text-center border-brand-border overflow-hidden relative">
               <div className="absolute -top-10 -right-10 h-40 w-40 bg-brand-primary/5 rounded-full opacity-50 blur-3xl"></div>
              <CalendarDays className="mx-auto mb-6 h-16 w-16 text-brand-primary/10" />
              <h3 className="text-xl font-bold text-brand-text mb-2">No events scheduled</h3>
              <p className="text-brand-slate mb-8 max-w-sm mx-auto">
                Create your first event to generate a check-in QR code and track attendance.
              </p>
              <Button onClick={() => setShowCreate(true)} className="px-8 shadow-xl shadow-brand-primary/20">
                Setup your first Event
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-8">
              {upcoming.length > 0 && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Current &amp; Coming</p>
                  {upcoming.map(s => (
                    <ServiceCard key={s.id} service={s} unitId={unitId!} onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="flex flex-col gap-3 opacity-80">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-slate ml-1">History</p>
                  {past.map(s => (
                    <ServiceCard key={s.id} service={s} unitId={unitId!} onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

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
    </div>
  )
}
