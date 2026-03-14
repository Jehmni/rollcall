import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ChevronRight, Users, Trash2, Settings, Edit2, X } from 'lucide-react'
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
    <div className="flex items-center gap-2">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between rounded-2xl bg-white px-4 py-4 border border-brand-border hover:border-brand-primary/30 hover:shadow-md transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-text">{unit.name}</p>
            {unit.description && <p className="text-xs text-brand-slate">{unit.description}</p>}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-brand-slate/40 flex-shrink-0 group-hover:text-brand-primary transition-colors" />
      </button>
      {canManage && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-slate/40 hover:bg-brand-primary/5 hover:text-brand-primary transition-colors"
            title="Edit Unit"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-slate/40 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete Unit"
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
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-brand-border">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-brand-secondary transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-brand-slate" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-brand-text truncate">{org?.name ?? 'Organization'}</h1>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-wider">
            {isOwner ? 'Organization Owner' : 'Member Admin'}
          </p>
        </div>
        {isOwner && (
          <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)} className={showSettings ? 'bg-brand-primary/5' : ''}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-8">
                {isOwner && (
          <div className="flex p-1 bg-brand-primary/5 rounded-xl max-w-sm border border-brand-primary/5">
            <button
              onClick={() => setActiveTab('units')}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'units' ? 'bg-white text-brand-primary shadow-sm border border-brand-primary/10' : 'text-brand-slate/60 hover:text-brand-primary'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'requests' ? 'bg-white text-brand-primary shadow-sm border border-brand-primary/10' : 'text-brand-slate/60 hover:text-brand-primary'
              }`}
            >
              Join Requests {joinRequests.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-brand-primary text-white rounded-full text-[10px]">
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
             <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate">Units</h2>
              <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingUnit(null); setNewName(''); setNewDesc('') }} className="shadow-lg shadow-brand-primary/20">
                <Plus className="h-4 w-4 mr-1.5" /> New Unit
              </Button>
            </div>

             {(showCreate || editingUnit) && (
              <form onSubmit={editingUnit ? handleUpdateUnit : handleCreate} className="mb-8 rounded-2xl bg-white p-6 shadow-xl shadow-brand-primary/5 border border-brand-border flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 bg-brand-primary/5 rounded-lg">
                    {editingUnit ? <Edit2 className="h-5 w-5 text-brand-primary" /> : <Plus className="h-5 w-5 text-brand-primary" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-text">{editingUnit ? 'Edit Unit' : 'Create New Unit'}</h3>
                    <p className="text-brand-slate text-sm">
                      Distribute responsibility by creating units you manage.
                    </p>
                  </div>
                </div>

                <Input
                  label="Unit Name"
                  placeholder="e.g. Volunteers, Teams, Classes"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  error={error ?? undefined}
                  required
                  autoFocus
                />
                <Input
                  label="Description (optional)"
                  placeholder="What is this unit for?"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="secondary" size="sm" type="button" onClick={() => { setShowCreate(false); setEditingUnit(null) }}>Cancel</Button>
                  <Button size="sm" type="submit" loading={isUpdating}>
                    {editingUnit ? 'Save Changes' : 'Create Unit'}
                  </Button>
                </div>
              </form>
            )}

             {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
              </div>
            ) : units.length === 0 ? (
              <Card className="rounded-3xl bg-white p-12 text-center border-brand-border overflow-hidden relative">
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
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
              </div>
             ) : joinRequests.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-brand-border text-brand-slate italic">
                No pending requests to join this organization.
              </div>
            ) : (
              <div className="space-y-4">
                {joinRequests.map(req => (
                  <div key={req.id} className="p-5 bg-white rounded-2xl border border-brand-border shadow-sm flex justify-between items-center group hover:border-brand-primary/30 transition-all">
                    <div>
                      <p className="font-bold text-brand-text">{req.admin?.email}</p>
                      <p className="text-xs text-brand-slate">Requested {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          await respondToJoinRequest(req.id, 'rejected')
                          setJoinRequests(prev => prev.filter(r => r.id !== req.id))
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await respondToJoinRequest(req.id, 'approved')
                          setJoinRequests(prev => prev.filter(r => r.id !== req.id))
                        }}
                      >
                        Accept
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
