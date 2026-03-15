import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Users, Trash2, Settings, Edit2, X, ShieldCheck } from 'lucide-react'
import { useUnits, useOrganizations as useAdminOrgs } from '../hooks/useAdminDashboard'
import { useOrganizations } from '../hooks/useOrganizations'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/Modal'
import type { Unit } from '../types'

function UnitCard({ 
  unit, 
  canManage,
  onClick, 
  onDelete, 
  onEdit 
}: { 
  unit: Unit; 
  canManage: boolean; 
  onClick: () => void; 
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 group animate-in slide-in-from-left-4 duration-500">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between rounded-[2.5rem] bg-white px-6 sm:px-10 py-6 sm:py-8 border border-brand-border/50 hover:border-brand-primary/40 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99] transition-all text-left group/card overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl group-hover/card:scale-150 transition-transform duration-700"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-primary/5 group-hover/card:bg-brand-primary group-hover/card:-rotate-3 transition-all duration-500 relative">
            <Users className="h-8 w-8 text-brand-primary group-hover/card:text-white transition-colors" />
          </div>
          <div>
            <p className="text-xl font-bold text-brand-text tracking-tighter uppercase italic group-hover/card:text-brand-primary transition-colors">{unit.name}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1 truncate max-w-[150px] sm:max-w-xs">
              {unit.description || 'Access Unit Command'}
            </p>
          </div>
        </div>
        <ChevronRight className="h-6 w-6 text-brand-slate opacity-20 group-hover/card:text-brand-primary group-hover/card:opacity-100 group-hover/card:translate-x-1 transition-all relative z-10" />
      </button>
      
      {canManage && (
        <div className="flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-brand-border/50 text-brand-slate hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all active:scale-90 shadow-sm"
            title="Edit Identity"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-brand-border/50 text-red-300 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-90 shadow-sm"
            title="Decommission"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function OrgDetail() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const { session, isSuper } = useAuth()
  const { orgs, updateOrg, deleteOrg } = useAdminOrgs()
  const { units, loading, createUnit, updateUnit, deleteUnit } = useUnits(orgId ?? null)
  const { getOrgJoinRequests, respondToJoinRequest } = useOrganizations()

  const org = orgs.find(o => o.id === orgId)
  const isOwner = isSuper || (org && (org as any).userRole === 'owner')

  const [activeTab, setActiveTab] = useState<'units' | 'requests'>('units')
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  
  // Join Requests state
  const [joinRequests, setJoinRequests] = useState<any[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)

  // Forms state
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [orgName, setOrgName] = useState(org?.name ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOwner && activeTab === 'requests') {
      const fetchRequests = async () => {
        setLoadingRequests(true)
        const requests = await getOrgJoinRequests(orgId!)
        setJoinRequests(requests)
        setLoadingRequests(false)
      }
      fetchRequests()
    }
  }, [isOwner, activeTab, orgId, getOrgJoinRequests])
  // Sync org name when it loads
  if (org && !orgName && !isUpdating) setOrgName(org.name)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsUpdating(true)
    try {
      const unit = await createUnit(newName.trim(), newDesc.trim() || undefined)
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      navigate(`/admin/units/${unit.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setIsUpdating(false)
    }
  }

  const [confirmDeleteOrg, setConfirmDeleteOrg] = useState(false)
  const [confirmDeleteUnit, setConfirmDeleteUnit] = useState<{ id: string, name: string } | null>(null)

  async function handleUpdateOrg(e: FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setError(null)
    setIsUpdating(true)
    try {
      await updateOrg(orgId, orgName.trim())
      setShowSettings(false)
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'Failed to update')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDeleteOrg() {
    if (!orgId || !org) return
    setIsUpdating(true)
    try {
      await deleteOrg(orgId)
      navigate('/admin', { replace: true })
    } catch {
      setError('Failed to delete organization')
      setIsUpdating(false)
    }
  }

  async function handleUpdateUnit(e: FormEvent) {
    e.preventDefault()
    if (!editingUnit) return
    setError(null)
    setIsUpdating(true)
    try {
      await updateUnit(editingUnit.id, newName.trim(), newDesc.trim() || undefined)
      setEditingUnit(null)
      setNewName('')
      setNewDesc('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleDeleteUnit() {
    if (!confirmDeleteUnit) return
    await deleteUnit(confirmDeleteUnit.id)
    setConfirmDeleteUnit(null)
  }

  const startEditUnit = (u: Unit) => {
    setEditingUnit(u)
    setNewName(u.name)
    setNewDesc(u.description ?? '')
    setShowCreate(false)
  }

  return (
    <div className="min-h-screen bg-brand-secondary">
      <header className="flex flex-col gap-8 px-5 sm:px-8 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden sticky top-0 z-30">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate('/admin')}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex flex-col items-center flex-1 overflow-hidden px-4">
             <h1 className="text-3xl font-black tracking-tighter italic truncate w-full text-center">{org?.name ?? 'Hub'}</h1>
             <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">Control Center</p>
          </div>
          {isOwner && (
            <button
               onClick={() => setShowSettings(!showSettings)}
               className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-95 ${showSettings ? 'bg-white text-brand-primary border-white' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
            >
              <Settings className="h-6 w-6" />
            </button>
          )}
        </div>

        <div className="text-center relative z-10 mt-4 animate-in fade-in slide-in-from-top-4 duration-700">
           <h2 className="text-2xl font-black leading-tight uppercase tracking-tight">Organization Detail</h2>
           <p className="mt-2 text-sm font-medium text-white/60">
             {isOwner ? 'Full Administrative Oversight' : 'Standard Access Control'}
           </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-8 flex flex-col gap-8">
                {isOwner && (
          <div className="flex p-2 bg-brand-primary/5 rounded-[2rem] max-w-sm mx-auto border border-brand-primary/5 shadow-inner">
            <button
              onClick={() => setActiveTab('units')}
              className={`flex-1 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                activeTab === 'units' ? 'bg-white text-brand-primary shadow-xl shadow-brand-primary/10 scale-105' : 'text-brand-slate/40 hover:text-brand-primary'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
                activeTab === 'requests' ? 'bg-white text-brand-primary shadow-xl shadow-brand-primary/10 scale-105' : 'text-brand-slate/40 hover:text-brand-primary'
              }`}
            >
              Requests
              {joinRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-brand-gold text-white rounded-full text-[8px] font-black ring-4 ring-brand-secondary">
                  {joinRequests.length}
                </span>
              )}
            </button>
          </div>
        )}
        
        {showSettings && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
              <Card className="p-6 border-brand-border bg-white shadow-xl shadow-brand-primary/5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-brand-text flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-primary" /> Organization Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateOrg} className="space-y-4">
                <Input
                  label="Organization Name"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Enter new name"
                  required
                />
                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" type="button" onClick={() => setConfirmDeleteOrg(true)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Organization
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

        {activeTab === 'units' ? (
          <section>
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">Section</h2>
                   <p className="text-2xl font-black text-brand-text tracking-tight uppercase italic mt-1">Active Units</p>
                </div>
                <Button size="lg" onClick={() => { setShowCreate(!showCreate); setEditingUnit(null); setNewName(''); setNewDesc('') }} className="shadow-2xl shadow-brand-primary/30 rounded-2xl text-xs font-black uppercase tracking-[0.1em]">
                  <Plus className="h-5 w-5 mr-3" /> New Unit
                </Button>
            </div>

             {(showCreate || editingUnit) && (
              <div className="mb-10 rounded-[2.5rem] bg-white p-6 sm:p-10 shadow-2xl shadow-brand-primary/5 border border-brand-border/50 animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
                <form onSubmit={editingUnit ? handleUpdateUnit : handleCreate} className="flex flex-col gap-8 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="h-16 w-16 bg-brand-primary shadow-xl shadow-brand-primary/20 rounded-3xl flex items-center justify-center text-white">
                      {editingUnit ? <Edit2 className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">{editingUnit ? 'Edit Unit' : 'Launch Unit'}</h3>
                      <p className="text-sm font-medium text-brand-slate opacity-40">
                         {editingUnit ? 'Refine group details' : 'Deploy a new organizational node'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Input
                      label="Unit Identity"
                      placeholder="e.g. Volunteers, Lead Team..."
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      error={error ?? undefined}
                      required
                      autoFocus
                      className="text-lg"
                    />
                    <Input
                      label="Objective / Description"
                      placeholder="Define the purpose of this group..."
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex gap-4 justify-end pt-4">
                    <Button variant="ghost" size="lg" type="button" onClick={() => { setShowCreate(false); setEditingUnit(null) }} className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Cancel</Button>
                    <Button size="lg" type="submit" loading={isUpdating} className="px-10 shadow-xl shadow-brand-primary/20 text-xs font-black uppercase tracking-[0.2em] rounded-2xl">
                      {editingUnit ? 'Update Unit' : 'Create Unit'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

             {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
              </div>
            ) : units.length === 0 ? (
              <Card className="rounded-3xl bg-white p-8 sm:p-12 text-center border-brand-border overflow-hidden relative">
                <div className="absolute -bottom-10 -left-10 h-40 w-40 bg-brand-primary/5 rounded-full opacity-50 blur-3xl"></div>
                <Users className="mx-auto mb-6 h-16 w-16 text-brand-primary/10" />
                <h3 className="text-xl font-bold text-brand-text mb-2">No units yet</h3>
                <p className="text-brand-slate mb-8 max-w-sm mx-auto">
                  Create a unit to start managing members and tracking attendance for this organization.
                </p>
                <Button onClick={() => setShowCreate(true)} className="px-8 shadow-xl shadow-brand-primary/20">
                  Setup your first Unit
                </Button>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {units.map(u => (
                  <UnitCard
                    key={u.id}
                    unit={u}
                    canManage={isOwner || u.created_by_admin_id === session?.user?.id}
                    onClick={() => navigate(`/admin/units/${u.id}`)}
                    onEdit={() => startEditUnit(u)}
                    onDelete={() => setConfirmDeleteUnit({ id: u.id, name: u.name })}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
           <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate">Pending Join Requests</h2>
            </div>
            
             {loadingRequests ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
              </div>
             ) : joinRequests.length === 0 ? (
              <div className="rounded-[2.5rem] bg-white p-10 sm:p-20 text-center border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02]">
                 <Users className="h-20 w-20 text-brand-primary/10 mx-auto mb-6" />
                 <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">Silent Comms</h3>
                 <p className="text-sm font-medium text-brand-slate opacity-40 mt-3">
                   No pending requests to join this organization.
                 </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                 {joinRequests.map(req => (
                  <div key={req.id} className="p-6 sm:p-8 bg-white rounded-[2rem] border border-brand-border/50 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:border-brand-primary/30 hover:shadow-2xl transition-all animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-5">
                      <div className="h-14 w-14 bg-brand-primary/5 rounded-2xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-all">
                         <ShieldCheck className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-brand-text uppercase italic tracking-tight">{req.admin_email || req.admin?.email || 'Unknown Protocol'}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-slate opacity-40 mt-1">
                          Requested {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button
                        onClick={async () => {
                          await respondToJoinRequest(req.id, 'rejected')
                          setJoinRequests(prev => prev.filter(r => r.id !== req.id))
                        }}
                        className="flex-1 sm:flex-none h-12 rounded-xl bg-white border-brand-border/50 text-red-500 hover:bg-red-50 text-[10px] font-black uppercase tracking-widest"
                      >
                        Decline
                      </Button>
                      <Button
                        onClick={async () => {
                          await respondToJoinRequest(req.id, 'approved')
                          setJoinRequests(prev => prev.filter(r => r.id !== req.id))
                        }}
                        className="flex-1 sm:flex-none h-12 rounded-xl bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest px-8 shadow-lg shadow-brand-primary/20"
                      >
                        Authorize
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        <ConfirmDialog
          isOpen={confirmDeleteOrg}
          onClose={() => setConfirmDeleteOrg(false)}
          onConfirm={handleDeleteOrg}
          title="Delete Organization"
          description={`DANGER: Delete organization "${org?.name}"? All units, members, and historical records will be permanently removed.`}
          confirmText="Delete Everything"
          variant="danger"
          isLoading={isUpdating}
        />

        <ConfirmDialog
          isOpen={!!confirmDeleteUnit}
          onClose={() => setConfirmDeleteUnit(null)}
          onConfirm={handleDeleteUnit}
          title="Delete Unit"
          description={`Are you sure you want to delete "${confirmDeleteUnit?.name}"? All events and attendance data for this unit will be lost.`}
          confirmText="Delete Unit"
          variant="danger"
          isLoading={isUpdating}
        />
      </div>
    </div>
  )
}
