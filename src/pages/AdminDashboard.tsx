import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useOrganizations } from '../hooks/useAdminDashboard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
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
    <div className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 group active:scale-[0.98] transition-all relative">
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-4 text-left"
      >
        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-white">
          <span className="material-symbols-outlined text-3xl">corporate_fare</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-extrabold italic dark:text-white uppercase tracking-tight truncate">{org.name}</h4>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">
            {new Date(org.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </button>
      
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-2xs font-bold rounded-full uppercase tracking-wider border ${
          userRole === 'owner' 
            ? 'bg-primary/10 text-primary border-primary/20' 
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
        }`}>
          {userRole === 'owner' ? 'Owner' : 'Admin'}
        </span>
        
        {canManage && (
          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRename(); }}
              className="size-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 active:scale-95 transition-all"
              title="Rename"
            >
              <span className="material-symbols-outlined text-xl">edit</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="size-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
              title="Delete"
            >
              <span className="material-symbols-outlined text-xl">delete</span>
            </button>
          </div>
        )}
        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:translate-x-1 transition-transform">chevron_right</span>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isSuper, adminUnits, refreshPermissions, signOut } = useAuth()
  const { orgs, loading, createOrg, updateOrg, deleteOrg, refetch: refetchOrgs } = useOrganizations()

  const [showCreate, setShowCreate] = useState(false)
  const [createdOrg, setCreatedOrg] = useState<Organization | null>(null)

  // Handle automatic open of create form from Discovery page
  useEffect(() => {
    if ((location.state as { openCreate?: boolean })?.openCreate) {
      setShowCreate(true)
      // Clear state to avoid reopening on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state])
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null)

  const [newName, setNewName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refreshPermissions()
  }, [refreshPermissions])

  // Re-fetch orgs when tab regains focus (e.g. after approving a join request in another tab)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        refetchOrgs()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refetchOrgs])

  // Unit admin with exactly one unit and no org memberships → go straight to that unit
  useEffect(() => {
    if (!loading && !isSuper && orgs.length === 0 && adminUnits.length === 1) {
      navigate(`/admin/units/${adminUnits[0].id}`, { replace: true })
    }
  }, [loading, isSuper, orgs, adminUnits, navigate])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setIsUpdating(true)
    try {
      const org = await createOrg(newName.trim())
      setNewName('')
      setShowCreate(false)
      setCreatedOrg(org)
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

  // ── Success Screen ──────────────────────────────────────────────────────
  if (createdOrg) {
    return (
      <div className="bg-background-dark font-display text-white min-h-screen flex flex-col antialiased">
        {/* Header */}
        <header className="grid grid-cols-3 items-center p-4 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-md border-b border-primary/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/admin/orgs/${createdOrg.id}`)}
              className="flex size-10 items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
            >
              <span className="material-symbols-outlined text-white">close</span>
            </button>
          </div>
          <div className="text-center">
            <span className="font-display font-bold text-white uppercase italic tracking-tighter text-sm">Organisation Live</span>
          </div>
          <div className="w-full"></div>
        </header>

        <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-12 overflow-y-auto">
          <div className="w-full max-w-sm pt-4 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-12 duration-1000">
              {/* Success icon */}
              <div className="relative flex flex-col items-center justify-center mb-8">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150"></div>
                <div className="relative bg-primary text-white rounded-[2.5rem] p-6 shadow-[0_0_60px_rgba(82,71,230,0.5)] border border-white/20">
                  <span className="material-symbols-outlined !text-7xl">check_circle</span>
                </div>
              </div>

              {/* Message */}
              <div className="text-center space-y-3 mb-12">
                <h1 className="text-white text-5xl font-display font-bold tracking-tighter uppercase italic">Connected!</h1>
                <p className="text-slate-400 text-lg font-medium tracking-tight">Organisation is live and active</p>
              </div>

              {/* Details card */}
              <div className="w-full bg-primary/5 border border-primary/20 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-sm relative">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 size-32 bg-primary/10 rounded-full blur-3xl"></div>

                <div className="p-8 text-center border-b border-primary/10">
                  <div className="inline-flex size-20 rounded-[2rem] bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-primary text-4xl">corporate_fare</span>
                  </div>
                  <h2 className="text-white text-3xl font-display font-bold uppercase italic tracking-tighter mb-1">{createdOrg.name}</h2>
                  <p className="text-primary font-black uppercase tracking-spaced text-2xs">Established Organisation</p>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                      <span className="material-symbols-outlined text-2xl">calendar_today</span>
                    </div>
                    <div>
                      <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Established</p>
                      <p className="text-white font-bold text-lg tracking-tight">
                        {new Date(createdOrg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-3 rounded-2xl text-primary border border-primary/20 shadow-lg shadow-primary/10">
                      <span className="material-symbols-outlined text-2xl">shield_person</span>
                    </div>
                    <div>
                      <p className="text-slate-500 text-2xs uppercase tracking-spread font-black mb-1">Your Role</p>
                      <p className="text-white font-display font-bold uppercase italic text-lg tracking-tight">Owner</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="w-full mt-10">
                <button
                  onClick={() => navigate(`/admin/orgs/${createdOrg.id}`)}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black py-6 rounded-3xl shadow-2xl shadow-primary/40 flex items-center justify-center gap-4 group transition-all active:scale-95 uppercase tracking-spread text-xs"
                >
                  <span>Open Organisation</span>
                  <span className="material-symbols-outlined text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </button>
                <button
                  onClick={() => setCreatedOrg(null)}
                  className="w-full text-2xs font-black uppercase tracking-spread text-slate-500 hover:text-primary transition-colors py-4 mt-2"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-background-light dark:bg-[#0F172A] min-h-screen text-slate-900 dark:text-slate-100 antialiased font-display selection:bg-primary/30">

      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden sm:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-background-dark border-r border-slate-800">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-800">
          <img src="/logo.png" alt="Rollcally" className="h-8 w-8 object-contain" />
          <h2 className="text-white text-lg font-extrabold tracking-tight">Rollcally</h2>
        </div>
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2 overflow-y-auto">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary font-bold text-sm">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            Dashboard
          </button>
          <button onClick={() => navigate('/admin/discover')} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-medium text-sm transition-colors">
            <span className="material-symbols-outlined">explore</span>
            Explore
          </button>
        </nav>
        <div className="px-4 py-4 border-t border-slate-800">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-medium text-sm transition-colors">
            <span className="material-symbols-outlined text-xl">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content area — offset on desktop for sidebar */}
      <div className="sm:ml-64">

      {/* Header/Top Bar */}
      <header className="bg-[#172554] text-white pt-12 pb-8 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="flex justify-between items-center mb-8 relative z-10 w-full max-w-5xl mx-auto">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Rollcally" className="h-8 w-8 object-contain" />
            <h2 className="text-white text-lg font-bold tracking-tight">Admin</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/help')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title="User Guide"
            >
              <span className="material-symbols-outlined text-xl">help</span>
            </button>
            <button
              onClick={signOut}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
        <div className="text-center relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <h2 className="text-2xl font-bold mb-1">
            {isSuper ? 'System Overview' : 'My Organizations'}
          </h2>
          <p className="text-slate-400 text-sm">
            {isSuper ? 'Controlling all active entities' : 'Manage your attendance groups'}
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end mb-6">
          <div>
            <p className="text-2xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-1">Dashboard</p>
            <h3 className="text-2xl font-extrabold italic dark:text-white uppercase tracking-tight">Directory</h3>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/admin/discover')}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E293B] rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              Explore
            </button>
            <button 
              onClick={() => { setShowCreate(!showCreate); setEditingOrg(null); setNewName('') }}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-white rounded-lg shadow-lg shadow-primary/20 flex items-center gap-1 hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New
            </button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {(showCreate || editingOrg) && (
          <div className="mb-10 rounded-[2.5rem] bg-white dark:bg-[#1E293B] p-6 sm:p-10 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-primary/5 rounded-full blur-3xl"></div>
            <form onSubmit={editingOrg ? handleUpdate : handleCreate} className="flex flex-col gap-8 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-primary shadow-xl shadow-primary/20 rounded-3xl flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-3xl">
                    {editingOrg ? 'edit' : 'add'}
                  </span>
                </div>
                <div>
                  <h3 className="text-2xl font-display font-bold dark:text-white uppercase tracking-tighter italic">{editingOrg ? 'Rename' : 'Launch New'}</h3>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
                    {editingOrg ? 'Update organization details' : 'Create a new organisation'}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <Input
                  label="Name of Organization"
                  placeholder="e.g. Metro Parish, Sports Club..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  error={error ?? undefined}
                  required
                  autoFocus
                  className="bg-transparent dark:bg-slate-900/50 dark:border-slate-800 rounded-xl"
                />
              </div>
              <div className="flex gap-4 justify-end">
                <Button variant="ghost" type="button" onClick={() => { setShowCreate(false); setEditingOrg(null) }} className="text-xs font-bold uppercase tracking-spaced opacity-50 dark:text-white dark:hover:bg-white/5">Cancel</Button>
                <Button type="submit" loading={isUpdating} className="px-10 shadow-xl shadow-primary/20 text-xs font-bold uppercase tracking-spaced rounded-xl">
                  {editingOrg ? 'Update Hub' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 animate-in fade-in duration-300">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                <div className="size-14 rounded-xl flex-shrink-0 animate-pulse bg-slate-200 dark:bg-white/[0.06]" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-white/[0.06]" />
                  <div className="h-3 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-white/[0.06]" />
                </div>
                <div className="h-6 w-16 rounded-full animate-pulse bg-slate-200 dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="rounded-[2.5rem] bg-white dark:bg-[#1E293B] p-10 sm:p-20 text-center border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden group">
             <div className="absolute -top-10 -right-10 h-40 w-40 bg-primary/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
             <span className="material-symbols-outlined text-8xl text-primary/10 group-hover:text-primary/20 transition-colors mb-6 block">corporate_fare</span>
             <h3 className="text-2xl font-display font-bold dark:text-white uppercase tracking-tighter italic">Welcome to Rollcally</h3>
             <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mb-10 max-w-sm mx-auto mt-3">
               Ready to start tracking? Launch your first organization to begin managing units and take attendance.
             </p>
             <Button onClick={() => setShowCreate(true)} className="px-12 py-6 shadow-2xl shadow-primary/30 rounded-2xl text-xs font-black uppercase tracking-widest">
               Setup first Organization
             </Button>
          </div>
        ) : (
          <div className="space-y-4 mb-10">
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

        {/* Units Section */}
        {adminUnits.length > 0 && (
          <>
            <div className="relative mb-6 mt-12">
              <div aria-hidden="true" className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background-light dark:bg-[#0F172A] px-4 text-2xs font-bold uppercase tracking-spaced text-slate-400 dark:text-slate-500">
                  Direct Unit Access
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {adminUnits.map(u => (
                <div 
                  key={u.id}
                  onClick={() => navigate(`/admin/units/${u.id}`)}
                  className="bg-white dark:bg-[#1E293B] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4 group active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700/50 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors group-hover:bg-primary group-hover:text-white">
                    <span className="material-symbols-outlined text-3xl">groups</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-extrabold italic dark:text-white uppercase tracking-tight truncate">{u.name}</h4>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">{u.organization.name}</p>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:translate-x-1 transition-transform">chevron_right</span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Floating Action Button — hidden on desktop (use sidebar or header button) */}
      <button 
        onClick={() => { setShowCreate(true); setEditingOrg(null); setNewName('') }}
        className="fixed right-6 bottom-24 sm:right-8 sm:bottom-8 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-20 sm:hidden"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {/* Navigation Footer — mobile only */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 backdrop-blur-md bg-white/70 dark:bg-[#1E293B]/70 border-t border-slate-200/20 dark:border-slate-800/50 px-8 py-3 pb-8 flex justify-between items-center z-10 transition-colors">
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-2xs font-bold uppercase tracking-widest text-[#5247e6]">Dash</span>
        </button>
        <button onClick={() => navigate('/admin/discover')} className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">explore</span>
          <span className="text-2xs font-bold uppercase tracking-widest">Explore</span>
        </button>
        <button onClick={signOut} className="flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined">logout</span>
          <span className="text-2xs font-bold uppercase tracking-widest">Logout</span>
        </button>
      </nav>

      <div className="h-32 sm:h-8"></div>

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
      </div> {/* End sm:ml-64 */}
    </div>
  )
}
