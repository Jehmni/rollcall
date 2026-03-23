import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface PublicMember {
  id: string
  name: string
  section: string | null
}

// Fetch members for the unit that owns a given service (public, no auth)
export function useServiceMembers(serviceId: string | null, search: string = '') {
  const [members, setMembers] = useState<PublicMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!serviceId) {
      setLoading(false)
      return
    }

    const timer = setTimeout(() => {
      setLoading(true)
      supabase
        .rpc('get_service_members', { 
          p_service_id: serviceId,
          p_search: search.trim() || null
        })
        .then(({ data, error }) => {
          if (error) setError(error.message)
          else setMembers((data ?? []) as PublicMember[])
          setLoading(false)
        })
    }, search ? 400 : 0) // Debounce only if searching

    return () => clearTimeout(timer)
  }, [serviceId, search])

  return { members, loading, error }
}

// Fetch a single member by ID (for "Welcome Back" flow)
export function useMemberById(memberId: string | null) {
  const [member, setMember] = useState<PublicMember | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!memberId) return

    setLoading(true)
    supabase
      .from('members')
      .select('id, name, section')
      .eq('id', memberId)
      .eq('status', 'active')
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setMember(data as PublicMember)
        setLoading(false)
      })
  }, [memberId])

  return { member, loading, error }
}

export function useServiceInfo(serviceId: string | null) {
  const [unitName, setUnitName] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!serviceId) return

    setLoading(true)
    supabase
      .from('services')
      .select('unit_id, units(name)')
      .eq('id', serviceId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setUnitName(((data.units as unknown) as { name: string } | null)?.name || null)
          setUnitId((data as unknown as { unit_id: string }).unit_id ?? null)
        }
        setLoading(false)
      })
  }, [serviceId])

  return { unitName, unitId, loading }
}
