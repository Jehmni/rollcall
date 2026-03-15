import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, RefreshCw } from 'lucide-react'
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
          <div className="flex flex-col items-center flex-1">
             <h1 className="text-3xl font-black tracking-tighter italic">Discovery</h1>
             <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mt-1">Expansion Node</p>
          </div>
          <div className="w-12"></div> {/* Spacer for balance */}
        </div>

        <div className="text-center relative z-10 mt-4 animate-in fade-in slide-in-from-top-4 duration-700">
           <h2 className="text-2xl font-black leading-tight uppercase tracking-tight">Find Organization</h2>
           <p className="mt-2 text-sm font-medium text-white/60">
             Search the Rollcally network to join groups
           </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 sm:px-8 py-8 flex flex-col gap-8">

      <form onSubmit={handleSearch} className="mb-12 pt-8">
        <div className="group relative">
          <div className="absolute inset-0 bg-brand-primary/10 rounded-[2rem] blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
            <div className="relative flex gap-1 bg-white p-1.5 sm:p-2 rounded-[2rem] border border-brand-border/50 shadow-sm focus-within:shadow-2xl transition-all">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Organization Name..."
              className="flex-1 px-8 py-5 rounded-[1.5rem] bg-transparent focus:outline-none placeholder:text-brand-slate/40 text-lg font-bold tracking-tight text-brand-text"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-5 bg-brand-primary text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-all disabled:opacity-50 shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-4 mb-6 bg-red-50 text-red-700 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {results.length > 0 ? (
          results.map((org) => {
            const status = getStatus(org.id)
            const isRequested = requestedIds.has(org.id)

             return (
                <div key={org.id} className="p-6 sm:p-10 bg-white rounded-[3rem] border border-brand-border/50 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 group hover:border-brand-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all animate-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
                   <div className="absolute top-0 right-0 -mt-10 -mr-10 h-32 w-32 bg-brand-primary/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                  
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="h-20 w-20 bg-brand-primary/5 rounded-3xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white group-hover:-rotate-3 transition-all duration-500 shadow-inner">
                       <Building2 className="h-10 w-10" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-brand-text uppercase italic tracking-tighter">
                        {org.name}
                      </h3>
                      <p className="text-brand-slate text-[10px] font-black uppercase tracking-[0.3em] mt-1 opacity-40">
                        Node · {org.id.split('-')[0]}
                      </p>
                    </div>
                  </div>
                  
                  <div className="w-full sm:w-auto relative z-10">
                    {status === 'pending' ? (
                      <span className="block text-center px-10 py-5 bg-brand-gold/5 text-brand-gold rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-brand-gold/10 shadow-lg shadow-brand-gold/5">
                        Transmission Pending
                      </span>
                    ) : status === 'approved' ? (
                      <span className="block text-center px-10 py-5 bg-green-50 text-green-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-green-100 shadow-lg shadow-green-500/5">
                        Verified Access
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoin(org.id)}
                        disabled={isRequested || loading}
                        className="w-full sm:w-auto px-12 py-5 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-primary/95 transition-all disabled:opacity-50 shadow-2xl shadow-brand-primary/30 hover:scale-[1.05] active:scale-[0.95]"
                      >
                        {isRequested ? 'Sync Sent' : 'Request Uplink'}
                      </button>
                    )}
                  </div>
                </div>
              )
          })
        ) : query && !loading ? (
          <div className="rounded-[2.5rem] bg-white p-20 text-center border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02]">
             <Building2 className="h-20 w-20 text-brand-primary/10 mx-auto mb-6" />
             <h3 className="text-2xl font-black text-brand-text uppercase tracking-tighter italic">No Node Found</h3>
             <p className="text-sm font-medium text-brand-slate opacity-40 mt-3">
               The directory reflects no match for "{query}"
             </p>
          </div>
        ) : !query && (
          <div className="rounded-[2.5rem] bg-white p-20 text-center border border-dashed border-brand-border/50 shadow-inner">
             <h3 className="text-lg font-black text-brand-slate opacity-20 uppercase tracking-[0.3em] italic">Search Registry</h3>
          </div>
        )}
      </div>

        <div className="mt-20">
          <div className="flex items-center gap-4 mb-10 px-4">
             <div className="h-px flex-1 bg-brand-border/50"></div>
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-slate opacity-40">Operational Log</h2>
             <div className="h-px flex-1 bg-brand-border/50"></div>
          </div>
          
          <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-brand-border/50 shadow-2xl shadow-brand-primary/[0.02] animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-10">
              {myRequests.map((req) => (
                <div key={req.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 group">
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 rounded-2xl border border-brand-border/50 flex items-center justify-center text-brand-slate opacity-20 group-hover:opacity-100 group-hover:text-brand-primary transition-all">
                       <RefreshCw className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xl font-bold text-brand-text uppercase italic tracking-tighter group-hover:text-brand-primary transition-colors">
                        {req.organization?.name || 'Authorized Hub'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-slate opacity-40 mt-1">
                        Deployment {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <span className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] border shadow-lg ${
                    req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100 shadow-green-500/5' :
                    req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100 shadow-red-500/5' :
                    'bg-brand-primary/5 text-brand-primary border-brand-primary/10 shadow-brand-primary/5'
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
