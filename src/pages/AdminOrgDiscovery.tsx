import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrganizations } from '../hooks/useOrganizations'
import type { Organization, JoinRequest } from '../types'

export default function AdminOrgDiscovery() {
  const navigate = useNavigate()
  const { 
    loading, 
    error, 
    searchOrganizations, 
    requestToJoin, 
    getMyJoinRequests 
  } = useOrganizations()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Organization[]>([])
  const [myRequests, setMyRequests] = useState<JoinRequest[]>([])
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchMyRequests = async () => {
      const requests = await getMyJoinRequests()
      setMyRequests(requests)
      setRequestedIds(new Set(requests.map(r => r.organization_id)))
    }
    fetchMyRequests()
  }, [getMyJoinRequests])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const data = await searchOrganizations(query)
    setResults(data)
  }

  const handleJoin = async (orgId: string) => {
    try {
      await requestToJoin(orgId)
      setRequestedIds(prev => new Set([...prev, orgId]))
      // Refresh requests to show status
      const requests = await getMyJoinRequests()
      setMyRequests(requests)
    } catch (err) {
      console.error('Failed to request join:', err)
    }
  }

  const getStatus = (orgId: string) => {
    const req = myRequests.find(r => r.organization_id === orgId)
    return req?.status || null
  }

  return (
    <div className="bg-background-dark text-slate-100 min-h-screen font-display antialiased selection:bg-primary/30">
      {/* Header Section */}
      <header className="bg-[#172554] pt-12 pb-16 px-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto w-full">
          <button
            onClick={() => navigate('/admin')}
            className="absolute left-0 top-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined text-xl leading-none">arrow_back</span>
          </button>
          <button
            onClick={() => navigate('/help')}
            className="absolute right-0 top-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="User Guide"
          >
            <span className="material-symbols-outlined text-xl leading-none">help</span>
          </button>
          <div className="text-center animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="text-3xl font-extrabold tracking-tighter text-white mb-2 uppercase italic">Find your organization</h1>
            <p className="text-sm text-white/60 font-medium">Search for your team or company to join them</p>
          </div>
        </div>
      </header>

      <main className="px-6 -mt-8 relative z-20 max-w-2xl mx-auto w-full">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="bg-surface-low p-2 rounded-2xl shadow-xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
          <div className="flex-1 flex items-center px-4">
            <span className="material-symbols-outlined text-slate-400 mr-2 text-xl">search</span>
            <input
              className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 py-3 font-medium"
              placeholder="Organization name..." 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 text-xs tracking-widest shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? '...' : 'SEARCH'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 text-xs font-bold uppercase tracking-widest text-center animate-in shake">
            {error}
          </div>
        )}

        {/* Search Results */}
        <div className="mt-10 grid gap-4">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-surface-low p-6 rounded-3xl flex items-center gap-4">
                <div className="size-16 rounded-2xl flex-shrink-0 animate-pulse bg-white/[0.06]" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-5 w-40 animate-pulse rounded-lg bg-white/[0.06]" />
                  <div className="h-3 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
                </div>
                <div className="h-10 w-28 rounded-xl animate-pulse bg-white/[0.06] hidden sm:block" />
              </div>
            ))
          ) : results.length > 0 ? (
            results.map((org) => {
              const status = getStatus(org.id)
              const isRequested = requestedIds.has(org.id)

              return (
                <div key={org.id} className="bg-surface-low p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group hover:bg-surface-highest transition-all animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-3xl">corporate_fare</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white uppercase italic tracking-tighter">{org.name}</h3>
                      <p className="text-2xs font-bold text-slate-500 tracking-spaced mt-1 uppercase">Node · {org.id.split('-')[0]}</p>
                    </div>
                  </div>
                  
                  <div className="w-full sm:w-auto">
                    {status === 'pending' ? (
                      <div className="px-6 py-3 bg-brand-gold/10 text-brand-gold rounded-xl text-2xs font-bold uppercase tracking-widest border border-brand-gold/20 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-base">hourglass_empty</span>
                        Pending
                      </div>
                    ) : status === 'approved' ? (
                      <div className="px-6 py-3 bg-green-500/10 text-green-400 rounded-xl text-2xs font-bold uppercase tracking-widest border border-green-500/20 flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-base">verified</span>
                        Verified
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleJoin(org.id)}
                        disabled={isRequested || loading}
                        className="w-full sm:w-auto px-8 py-3 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-2xs font-bold uppercase tracking-widest border border-primary/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isRequested ? 'Sync Sent' : 'Request Access'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          ) : query && (
            <div className="bg-surface-low p-12 rounded-3xl border border-dashed border-white/10 text-center animate-in zoom-in-95">
              <span className="material-symbols-outlined text-6xl text-primary/10 mb-4 block">search_off</span>
              <h3 className="text-lg font-bold text-white mb-1 uppercase italic">No Match Found</h3>
              <p className="text-sm text-slate-500">The registry reflections no match for "{query}"</p>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mt-16 mb-8">
          <span className="text-2xs font-bold text-slate-500 tracking-widest uppercase">OR</span>
        </div>

        {/* Create Path */}
        <div className="space-y-6">
          <div className="bg-surface-low border border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center text-center group transition-all hover:border-primary/30">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
              <span className="material-symbols-outlined text-3xl text-primary">add</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 uppercase italic">Create New Organization</h3>
            <p className="text-sm text-slate-500 mb-8 max-w-[280px]">
              Create a new space for your team and start managing everything in one place.
            </p>
            <button
              onClick={() => navigate('/admin', { state: { openCreate: true } })}
              className="w-full bg-surface-highest hover:bg-primary hover:text-white text-slate-300 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
            >
              Get Started
              <span className="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>

          <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-2xl mb-12">
            <span className="material-symbols-outlined text-primary text-xl">info</span>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Can't find your organization? It might not be registered yet. You can create a new one in less than a minute.
            </p>
          </div>

          {/* Operational Log (Requests) */}
          {myRequests.length > 0 && (
            <div className="mt-12 pb-20">
              <h2 className="text-2xs font-bold uppercase tracking-super text-slate-500 mb-8">Operational Log</h2>
              
              <div className="bg-surface-low rounded-3xl p-6 shadow-[0_20px_40px_rgba(7,13,31,0.4)] flex flex-col gap-1">
                {myRequests.map((req) => (
                  <div key={req.id} className="flex justify-between items-center py-4 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-surface-high flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">history</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white uppercase italic tracking-tighter">
                          {req.organization?.name || 'Authorized Hub'}
                        </span>
                        <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                          Deployment {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-lg text-2xs font-bold uppercase tracking-widest border shadow-sm ${
                      req.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                      req.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-primary/5 text-primary border-primary/10'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-surface-high rounded-full"></div>
    </div>
  )
}
