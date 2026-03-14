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
  const statusStyle = { 
    today: 'bg-brand-primary/10 text-brand-primary border-brand-primary/10', 
    upcoming: 'bg-green-50 text-green-700 border-green-100', 
    past: 'bg-brand-secondary/50 text-brand-slate opacity-60 border-brand-border/30' 
  }[status]
  const statusLabel = { today: 'Active Today', upcoming: 'Scheduled', past: 'Archived' }[status]
  const iconBg = { today: 'bg-brand-primary shadow-brand-primary/20', upcoming: 'bg-green-600 shadow-green-500/20', past: 'bg-brand-slate/10' }[status]
  const iconColor = status === 'past' ? 'text-brand-slate/40' : 'text-white'

  void unitId 

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-[2.5rem] bg-white px-10 py-8 border border-brand-border/50 hover:border-brand-primary/40 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99] transition-all text-left group animate-in slide-in-from-left-4 duration-500 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
      
      <div className="flex items-center gap-6 relative z-10">
        <div className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl ${iconBg} group-hover:rotate-3 transition-all duration-500 shadow-xl`}>
          <CalendarDays className={`h-8 w-8 ${iconColor}`} />
        </div>
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xl font-bold text-brand-text tracking-tighter uppercase italic group-hover:text-brand-primary transition-colors">{EVENT_LABEL[service.service_type]}</p>
            <span className={`inline-block w-fit rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm ${statusStyle}`}>{statusLabel}</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">{formatDate(service.date)}</p>
        </div>
      </div>
      <ChevronRight className="h-6 w-6 text-brand-slate opacity-20 group-hover:text-brand-primary group-hover:opacity-100 group-hover:translate-x-1 transition-all relative z-10" />
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
      <header className="flex flex-col gap-8 px-4 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden sticky top-0 z-30">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate(isSuper && unit ? `/admin/orgs/${unit.org_id}` : '/admin')}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          
          <div className="flex flex-col items-center flex-1 overflow-hidden px-4 text-center">
             <h1 className="text-3xl font-black tracking-tighter italic truncate w-full">{unit?.name ?? 'Unit'}</h1>
             <div className="flex items-center gap-2 mt-1">
                {orgName && <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{orgName}</p>}
                <span className="text-[8px] font-black uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                  {userRole === 'owner' ? 'Org Owner' : isOwnerOrCreator ? 'Command' : 'Observer'}
                </span>
             </div>
          </div>

          <div className="flex items-center gap-2">
            {unitId && <NotificationBell unitId={unitId} />}
            <button
               onClick={() => signOut()}
               className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
               title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 relative z-10">
           <button 
             onClick={() => navigate(`/admin/units/${unitId}/members`)}
             className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white text-brand-primary shadow-xl shadow-brand-primary/20 border border-white font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all active:scale-95"
           >
             <Users className="h-4 w-4" /> Members
           </button>
           {isOwnerOrCreator && (
            <button
               onClick={() => setShowSettings(!showSettings)}
               className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all border active:scale-95 ${showSettings ? 'bg-white text-brand-primary border-white shadow-xl' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
            >
              <Settings className="h-6 w-6" />
            </button>
          )}
          {isSuper && (
            <button
               onClick={() => setShowAdmins(!showAdmins)}
               className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all border active:scale-95 ${showAdmins ? 'bg-white text-brand-primary border-white shadow-xl' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
            >
              <UserCog className="h-6 w-6" />
            </button>
          )}
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
          <div className="flex items-center justify-between mb-8">
            <div>
               <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">Hub</h2>
               <p className="text-2xl font-black text-brand-text tracking-tight uppercase italic mt-1">Calendar</p>
            </div>
            {isOwnerOrCreator && (
              <Button size="lg" onClick={() => setShowCreate(!showCreate)} className="shadow-2xl shadow-brand-primary/30 rounded-2xl text-xs font-black uppercase tracking-[0.1em]">
                <Plus className="h-5 w-5 mr-3" /> New Event
              </Button>
            )}
          </div>

          {showCreate && (
             <div className="mb-10 rounded-[2.5rem] bg-white p-10 shadow-2xl shadow-brand-primary/5 border border-brand-border/50 animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
                <form onSubmit={handleCreate} className="flex flex-col gap-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="h-16 w-16 bg-brand-primary shadow-xl shadow-brand-primary/20 rounded-3xl flex items-center justify-center text-white">
                      <CalendarDays className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Schedule Event</h3>
                      <p className="text-sm font-medium text-brand-slate opacity-40">Add a new session to the command board</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input label="Event Date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required className="text-lg py-6" />
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 ml-1">Event Type</label>
                      <select
                        className="w-full rounded-2xl border border-brand-border bg-white px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-brand-primary/5 transition-all font-bold h-[62px] text-brand-text appearance-none cursor-pointer hover:border-brand-primary/30"
                        value={newType}
                        onChange={e => setNewType(e.target.value as ServiceType)}
                      >
                        <option value="rehearsal">Regular Meeting</option>
                        <option value="sunday_service">Main Event</option>
                      </select>
                    </div>
                  </div>
                  {error && <p className="text-sm font-bold text-red-600">{error}</p>}
                  <div className="flex gap-4 justify-end">
                    <Button variant="ghost" size="lg" type="button" onClick={() => { setShowCreate(false); setError(null) }} className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Cancel</Button>
                    <Button size="lg" type="submit" loading={isUpdating} className="px-10 shadow-xl shadow-brand-primary/20 text-xs font-black uppercase tracking-[0.2em] rounded-2xl">
                      Create Event
                    </Button>
                  </div>
                </form>
             </div>
          )}

          {/* Service list */}
          {servicesLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-[2.5rem] bg-white p-20 text-center border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02] relative overflow-hidden group">
               <div className="absolute -top-10 -right-10 h-40 w-40 bg-brand-primary/5 rounded-full opacity-50 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
               <CalendarDays className="mx-auto mb-6 h-20 w-20 text-brand-primary/10 group-hover:text-brand-primary/20 transition-colors" />
               <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">No Events Scheduled</h3>
               <p className="text-sm font-medium text-brand-slate opacity-40 mb-10 max-w-sm mx-auto mt-3">
                 The calendar is currently clear. Setup your first event to generate a check-in QR code and track attendance.
               </p>
               <Button onClick={() => setShowCreate(true)} className="px-12 py-6 shadow-2xl shadow-brand-primary/30 rounded-2xl text-xs font-black uppercase tracking-widest">
                 Setup first Event
               </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {upcoming.length > 0 && (
                <div className="flex flex-col gap-5">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 ml-4">Current & Coming</h3>
                  {upcoming.map(s => (
                    <ServiceCard key={s.id} service={s} unitId={unitId!} onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)} />
                  ))}
                </div>
              )}
              {past.length > 0 && (
                <div className="flex flex-col gap-5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40 ml-4">Past Sessions</h3>
                  <div className="flex flex-col gap-3 opacity-60">
                    {past.map(s => (
                      <ServiceCard key={s.id} service={s} unitId={unitId!} onClick={() => navigate(`/admin/units/${unitId}/events/${s.id}`)} />
                    ))}
                  </div>
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
