import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useOrganizations } from '../hooks/useOrganizations'
import type { Organization, JoinRequest } from '../types'

export default function AdminOrgDiscovery() {
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Discover Organizations</h1>
        <Link to="/admin" className="text-indigo-600 hover:text-indigo-800 font-medium">
          &larr; Back to Dashboard
        </Link>
      </div>

      <form onSubmit={handleSearch} className="mb-10">
        <div className="flex gap-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by organization name (e.g. St Peter's)"
            className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-all outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50"
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
              <div key={org.id} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:border-indigo-100 transition-all">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {org.name}
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    System ID: {org.id.split('-')[0]}...
                  </p>
                </div>
                
                <div>
                  {status === 'pending' ? (
                    <span className="px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-100">
                      Pending Approval
                    </span>
                  ) : status === 'approved' ? (
                    <span className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                      Member
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoin(org.id)}
                      disabled={isRequested || loading}
                      className="px-6 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 border border-indigo-100"
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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Recent Requests</h2>
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div key={req.id} className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-gray-700">
                    {req.organization?.name || 'Loading organization...'}
                  </span>
                  <span className={`capitalize px-3 py-1 rounded-full text-xs font-bold ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' :
                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
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
  )
}
