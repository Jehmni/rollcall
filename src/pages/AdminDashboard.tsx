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
        className="flex-1 flex items-center justify-between rounded-2xl bg-white px-4 py-4 ring-1 ring-gray-100 hover:ring-blue-200 hover:shadow-sm transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 group-hover:bg-blue-600 transition-colors">
            <Building2 className="h-5 w-5 text-blue-700 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{org.name}</p>
            <p className="text-xs text-gray-400">
              {new Date(org.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </button>
      
      {canManage && (
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRename}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
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
    <div className="min-h-screen bg-gray-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-gray-50 to-gray-50">
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-gray-100">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-gray-100 transition-colors"
          title="Back to Landing"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-700" />
          <span className="font-semibold text-gray-900">Rollcally</span>
          {isSuper && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Super Admin</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} title="Sign Out">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-6 relative">
        {/* Animated Background Blobs (subtle) */}
        <div className="absolute top-20 -left-20 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 -right-20 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

        <section className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
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
              <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingOrg(null); setNewName('') }} className="shadow-lg shadow-blue-200/50">
                <Plus className="h-4 w-4 mr-1.5" /> New Organization
              </Button>
            </div>
          </div>
激
          {(showCreate || editingOrg) && (
            <form onSubmit={editingOrg ? handleUpdate : handleCreate} className="mb-6 rounded-2xl bg-white p-6 shadow-xl shadow-gray-200/50 border border-gray-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-50 rounded-lg">
                  {editingOrg ? <Edit2 className="h-5 w-5 text-blue-700" /> : <Building2 className="h-5 w-5 text-blue-700" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{editingOrg ? 'Rename Organization' : 'Start a New Organization'}</h3>
                  <p className="text-xs text-gray-500">
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
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
            </div>
          ) : orgs.length === 0 ? (
            <Card className="rounded-3xl bg-white p-12 text-center shadow-xl shadow-gray-200/50 border border-gray-50 overflow-hidden relative">
              <div className="absolute -top-10 -right-10 h-40 w-40 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>
              <Building2 className="mx-auto mb-6 h-16 w-16 text-blue-100" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome to Rollcally</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Ready to start tracking? Create your first organization to begin managing units and take attendance.
              </p>
              <Button onClick={() => setShowCreate(true)} className="px-8 shadow-xl shadow-blue-100">
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Direct Unit Access</h2>
            <div className="grid gap-3">
              {adminUnits.map(u => (
                <button
                  key={u.id}
                  onClick={() => navigate(`/admin/units/${u.id}`)}
                  className="group w-full flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-colors">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.organization.name}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
