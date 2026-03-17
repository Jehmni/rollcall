import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import type { Organization, JoinRequest, OrganizationMember } from '../types'

export function useOrganizations() {
  const { session } = useAuth()
  const user = session?.user
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchOrganizations = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('organizations')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name')
      
      if (err) throw err
      return data as Organization[]
    } catch (err: any) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const requestToJoin = useCallback(async (orgId: string) => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('join_requests')
        .insert({
          organization_id: orgId,
          admin_id: user.id,
          status: 'pending'
        })
      if (err) throw err
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [user])

  const getMyJoinRequests = useCallback(async () => {
    if (!user) return []
    try {
      const { data, error: err } = await supabase
        .from('join_requests')
        .select('*, organization:organizations(*)')
        .eq('admin_id', user.id)
      
      if (err) throw err
      return data as JoinRequest[]
    } catch (err) {
      toast('Failed to load join requests.', 'error')
      return []
    }
  }, [user, toast])

  const getOrgJoinRequests = useCallback(async (orgId: string) => {
    try {
      // Use the RPC for secure server-side join to auth.users
      const { data, error: err } = await supabase
        .rpc('get_org_join_requests', { p_org_id: orgId })
      
      if (err) {
        // Fallback to basic fetch if RPC doesn't exist yet (prevents crash)
        if (err.code === 'PGRST103') {
           const { data: fallback } = await supabase
            .from('join_requests')
            .select('*')
            .eq('organization_id', orgId)
            .eq('status', 'pending')
           return fallback || []
        }
        throw err
      }
      return data
    } catch (err) {
      toast('Failed to load pending requests.', 'error')
      return []
    }
  }, [toast])

  const respondToJoinRequest = useCallback(async (requestId: string, status: 'approved' | 'rejected') => {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('join_requests')
        .update({ status })
        .eq('id', requestId)
      
      if (err) throw err
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const getOrgMembers = useCallback(async (orgId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', orgId)
      
      if (err) throw err
      return data as OrganizationMember[]
    } catch (err) {
      toast('Failed to load organisation members.', 'error')
      return []
    }
  }, [toast])

  return {
    loading,
    error,
    searchOrganizations,
    requestToJoin,
    getMyJoinRequests,
    getOrgJoinRequests,
    respondToJoinRequest,
    getOrgMembers
  }
}
