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
