import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
      <header className="bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm flex items-center gap-3 sticky top-0 z-20 border-b border-brand-border">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center justify-center rounded-xl p-2 hover:bg-brand-secondary transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5 text-brand-slate" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-brand-text truncate">Find an Organization</h1>
          <p className="text-xs text-brand-primary font-bold uppercase tracking-wider">Search for your group to request access</p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 flex flex-col gap-8">

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by organization name (e.g. St Peter's)"
            className="flex-1 px-4 py-3 rounded-xl border border-brand-border bg-white focus:border-brand-primary/50 focus:ring-4 focus:ring-brand-primary/5 transition-all outline-none placeholder:text-brand-slate/40 text-brand-text"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-brand-primary/20"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
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
               <div key={org.id} className="p-6 bg-white rounded-2xl border border-brand-border shadow-sm flex justify-between items-center group hover:border-brand-primary/30 transition-all">
                <div>
                  <h3 className="text-xl font-bold text-brand-text group-hover:text-brand-primary transition-colors">
                    {org.name}
                  </h3>
                  <p className="text-brand-slate text-sm mt-1">
                    System ID: {org.id.split('-')[0]}...
                  </p>
                </div>
                
                <div>
                  {status === 'pending' ? (
                    <span className="px-4 py-2 bg-brand-gold/5 text-brand-gold rounded-full text-xs font-bold uppercase tracking-wider border border-brand-gold/20">
                      Pending Approval
                    </span>
                  ) : status === 'approved' ? (
                    <span className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider border border-green-100">
                      Member
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoin(org.id)}
                      disabled={isRequested || loading}
                      className="px-6 py-2 bg-brand-primary text-white rounded-lg font-bold uppercase tracking-wider hover:bg-brand-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-brand-primary/20"
                    >
                      {isRequested ? 'Request Sent' : 'Request to Join'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : query && !loading ? (
          <div className="text-center py-12 text-gray-500">
            No organizations found matching "{query}"
          </div>
        ) : !query && (
          <div className="text-center py-12 text-gray-400 italic">
            Search to find your church or organization
          </div>
        )}
      </div>

       {myRequests.length > 0 && (
        <div className="mt-16">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-slate mb-6">Your Recent Requests</h2>
          <div className="bg-white rounded-2xl p-6 border border-brand-border shadow-sm">
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div key={req.id} className="flex justify-between items-center text-sm">
                  <span className="font-bold text-brand-text">
                    {req.organization?.name || 'Loading organization...'}
                  </span>
                  <span className={`capitalize px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' :
                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-brand-primary/5 text-brand-primary'
                  }`}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
