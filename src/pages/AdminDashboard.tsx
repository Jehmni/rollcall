import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, ChevronRight, Building2, Users, Trash2, Edit2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizations } from '../hooks/useAdminDashboard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/Modal'
import type { Organization, OrgRole } from '../types'

function OrgCard({ 
  org, 
  userRole,
  isSuper,
  onClick, 
  onDelete, 
  onRename 
}: { 
  org: Organization; 
  userRole: OrgRole;
  isSuper: boolean;
  onClick: () => void; 
  onDelete: () => void;
  onRename: () => void;
}) {
  const canManage = isSuper || userRole === 'owner';

  return (
    <div className="flex items-center gap-3 group animate-in slide-in-from-left-4 duration-500">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between rounded-[2rem] bg-white px-8 py-7 border border-brand-border/50 hover:border-brand-primary/40 hover:shadow-2xl hover:-translate-y-1 active:scale-[0.99] transition-all text-left"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-primary/5 group-hover:bg-brand-primary group-hover:rotate-3 transition-all duration-500 relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-10 scale-150 blur-xl transition-opacity"></div>
            <Building2 className="h-8 w-8 text-brand-primary group-hover:text-white transition-colors relative z-10" />
          </div>
          <div>
            <p className="text-xl font-bold text-brand-text tracking-tight uppercase italic">{org.name}</p>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">
              Established {new Date(org.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {userRole === 'owner' && (
             <span className="hidden sm:inline-block rounded-full bg-brand-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-brand-primary border border-brand-primary/10">
               Owner
             </span>
           )}
           <ChevronRight className="h-6 w-6 text-brand-slate opacity-20 group-hover:text-brand-primary group-hover:opacity-100 transition-all" />
        </div>
      </button>
      
      {canManage && (
        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-brand-border text-brand-slate hover:bg-brand-primary/5 hover:text-brand-primary hover:border-brand-primary/20 shadow-sm transition-all active:scale-90"
            title="Rename"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white border border-brand-border text-gray-300 hover:bg-red-50 hover:text-red-500 hover:border-red-200 shadow-sm transition-all active:scale-90"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isSuper, adminUnits, refreshPermissions, signOut } = useAuth()
  const { orgs, loading, createOrg, updateOrg, deleteOrg } = useOrganizations()

  const [showCreate, setShowCreate] = useState(false)
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)
  
  const [newName, setNewName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsUpdating(true)
    try {
      const org = await createOrg(newName.trim())
      setNewName('')
      setShowCreate(false)
      navigate(`/admin/orgs/${org.id}`)
    } catch {
      setError('Failed to create')
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    if (!editingOrg) return
    setError(null)
    setIsUpdating(true)
    try {
      await updateOrg(editingOrg.id, newName.trim())
      setEditingOrg(null)
      setNewName('')
    } catch (_err) {
      const msg = _err instanceof Error ? _err.message : String(_err)
      setError(msg || 'Failed to rename organization')
    } finally {
      setIsUpdating(false)
    }
  }

  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null)

  async function handleDelete() {
    if (!confirmDelete) return
    setIsUpdating(true)
    try {
      await deleteOrg(confirmDelete.id)
      setConfirmDelete(null)
    } catch {
      setError('Failed to delete organization')
      setIsUpdating(false)
    }
  }

  function startRename(o: Organization) {
    setEditingOrg(o)
    setNewName(o.name)
    setShowCreate(false)
  }

  return (
    <div className="min-h-screen bg-brand-secondary">
      <header className="flex flex-col gap-8 px-4 pt-24 pb-24 bg-brand-primary text-white shadow-2xl shadow-brand-primary/20 relative overflow-hidden sticky top-0 z-30">
        {/* Abstract background glow */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 rounded-full bg-white/5 blur-[80px]"></div>
        
        <div className="flex items-center justify-between relative z-10 w-full">
          <button
            onClick={() => navigate('/')}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 active:scale-95"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex flex-col items-center flex-1">
             <h1 className="text-3xl font-black tracking-tighter italic">Rollcally Admin</h1>
             <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">Management Hub</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} title="Sign Out" className="text-white hover:bg-white/10 h-12 w-12 rounded-2xl border border-white/10">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div className="text-center relative z-10 mt-4 animate-in fade-in slide-in-from-top-4 duration-700">
           <h2 className="text-2xl font-black leading-tight">
             {isSuper ? 'System Overview' : 'My Organizations'}
           </h2>
           <p className="mt-2 text-sm font-medium text-white/60">
             {isSuper ? 'Controlling all active entities' : 'Manage your attendance groups'}
           </p>
        </div>
      </header>

      <div className="mx-auto max-max-w-2xl px-4 py-8 flex flex-col gap-6 relative">
        <section className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-slate opacity-40">
                Dashboard
              </h2>
              <p className="text-2xl font-black text-brand-text tracking-tight uppercase italic mt-1">Directory</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button 
                variant="secondary" 
                size="lg" 
                onClick={() => navigate('/admin/discover')}
                className="flex-1 sm:flex-none border-brand-border/50 text-xs font-bold uppercase tracking-[0.1em] rounded-2xl"
              >
                Explore
              </Button>
              <Button size="lg" onClick={() => { setShowCreate(!showCreate); setEditingOrg(null); setNewName('') }} className="flex-1 sm:flex-none shadow-2xl shadow-brand-primary/30 rounded-2xl text-xs font-bold uppercase tracking-[0.1em]">
                <Plus className="h-5 w-5 mr-3" /> New
              </Button>
            </div>
          </div>
          {(showCreate || editingOrg) && (
            <div className="mb-10 rounded-[2.5rem] bg-white p-10 shadow-2xl shadow-brand-primary/5 border border-brand-border/50 animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden">
               <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl"></div>
              <form onSubmit={editingOrg ? handleUpdate : handleCreate} className="flex flex-col gap-8 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="h-16 w-16 bg-brand-primary shadow-xl shadow-brand-primary/20 rounded-3xl flex items-center justify-center text-white">
                    {editingOrg ? <Edit2 className="h-8 w-8" /> : <Plus className="h-8 w-8" />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">{editingOrg ? 'Rename' : 'Launch New'}</h3>
                    <p className="text-sm font-medium text-brand-slate opacity-40">
                      {editingOrg ? 'Update organization details' : 'Create a fresh attendance hub'}
                    </p>
                  </div>
                </div>
                <Input
                  label="Name of Organization"
                  placeholder="e.g. Metro Parish, Sports Club..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  error={error ?? undefined}
                  required
                  autoFocus
                  className="text-lg py-6"
                />
                <div className="flex gap-4 justify-end">
                  <Button variant="ghost" size="lg" type="button" onClick={() => { setShowCreate(false); setEditingOrg(null) }} className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Cancel</Button>
                  <Button size="lg" type="submit" loading={isUpdating} className="px-10 shadow-xl shadow-brand-primary/20 text-xs font-black uppercase tracking-[0.2em] rounded-2xl">
                    {editingOrg ? 'Update Hub' : 'Create Hub'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            </div>
          ) : orgs.length === 0 ? (
            <Card className="rounded-3xl bg-white p-12 text-center border-brand-border overflow-hidden relative">
              <div className="absolute -top-10 -right-10 h-40 w-40 bg-brand-primary/5 rounded-full opacity-50 blur-3xl"></div>
              <Building2 className="mx-auto mb-6 h-16 w-16 text-brand-primary/10" />
              <h3 className="text-xl font-bold text-brand-text mb-2">Welcome to Rollcally</h3>
              <p className="text-brand-slate mb-8 max-w-sm mx-auto">
                Ready to start tracking? Create your first organization to begin managing units and take attendance.
              </p>
              <Button onClick={() => setShowCreate(true)} className="px-8 shadow-xl shadow-brand-primary/20">
                Setup your first Organization
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {orgs.map(o => (
                <OrgCard 
                  key={o.id} 
                  org={o} 
                  userRole={o.userRole}
                  isSuper={isSuper}
                  onClick={() => navigate(`/admin/orgs/${o.id}`)}
                  onDelete={() => setConfirmDelete({ id: o.id, name: o.name })}
                  onRename={() => startRename(o)}
                />
              ))}
            </div>
          )}
        </section>

        <ConfirmDialog
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
          title="Delete Organization"
          description={`DANGER: Delete organization "${confirmDelete?.name}"? This will delete ALL units, members, and historical records. This action cannot be undone.`}
          confirmText="Delete Everything"
          variant="danger"
          isLoading={isUpdating}
        />

        {!isSuper && adminUnits.length > 0 && (
          <section className="mt-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate mb-4">Direct Unit Access</h2>
            <div className="grid gap-3">
              {adminUnits.map(u => (
                <button
                  key={u.id}
                  onClick={() => navigate(`/admin/units/${u.id}`)}
                  className="group w-full flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm border border-brand-border hover:border-brand-primary/30 hover:shadow-md transition-all text-left"
                >
                   <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/5 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-text">{u.name}</p>
                      <p className="text-xs text-brand-slate">{u.organization.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-brand-slate/40 group-hover:text-brand-primary transform group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
