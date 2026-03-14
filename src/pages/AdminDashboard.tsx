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
    <div className="flex items-center gap-2 group">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between rounded-2xl bg-white px-4 py-4 border border-brand-border hover:border-brand-primary/30 hover:shadow-md transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/5 group-hover:bg-brand-primary transition-colors">
            <Building2 className="h-5 w-5 text-brand-primary group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-sm font-bold text-brand-text">{org.name}</p>
            <p className="text-xs text-brand-slate">
              {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-brand-slate/40 group-hover:text-brand-primary transition-colors" />
      </button>
      
      {canManage && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRename}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-slate hover:bg-brand-primary/5 hover:text-brand-primary transition-colors"
            title="Rename Organization"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete Organization"
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
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-brand-border">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-brand-secondary transition-colors"
          title="Back to Landing"
        >
          <ArrowLeft className="h-5 w-5 text-brand-slate" />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <Building2 className="h-5 w-5 text-brand-primary" />
          <span className="font-bold text-brand-text">Rollcally</span>
          {isSuper && (
            <span className="rounded-full bg-brand-primary/5 px-2 py-0.5 text-xs font-bold text-brand-primary border border-brand-primary/10">Super Admin</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} title="Sign Out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="mx-auto max-max-w-2xl px-4 py-8 flex flex-col gap-6 relative">
        <section className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate">
              {isSuper ? 'All Organizations' : 'Your Organizations'}
            </h2>
            <div className="flex gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/discover')}
              >
                Find an Organization
              </Button>
              <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingOrg(null); setNewName('') }} className="shadow-lg shadow-brand-primary/20">
                <Plus className="h-4 w-4 mr-1.5" /> New Organization
              </Button>
            </div>
          </div>
          {(showCreate || editingOrg) && (
            <form onSubmit={editingOrg ? handleUpdate : handleCreate} className="mb-6 rounded-2xl bg-white p-6 shadow-xl shadow-brand-primary/5 border border-brand-border flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-brand-primary/5 rounded-lg">
                  {editingOrg ? <Edit2 className="h-5 w-5 text-brand-primary" /> : <Building2 className="h-5 w-5 text-brand-primary" />}
                </div>
                <div>
                  <h3 className="font-semibold text-brand-text">{editingOrg ? 'Rename Organization' : 'Start a New Organization'}</h3>
                  <p className="text-xs text-brand-slate">
                    {editingOrg ? 'Update the name of your organization.' : 'Choose a name for your group, team, or organization.'}
                  </p>
                </div>
              </div>
              <Input
                label="Organization Name"
                placeholder="e.g. Community Group, Sports Team, or Church"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                error={error ?? undefined}
                required
                autoFocus
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="secondary" size="sm" type="button" onClick={() => { setShowCreate(false); setEditingOrg(null) }}>Cancel</Button>
                <Button size="sm" type="submit" loading={isUpdating}>
                  {editingOrg ? 'Update Name' : 'Create Organization'}
                </Button>
              </div>
            </form>
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
