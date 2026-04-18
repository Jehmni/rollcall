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

export interface EffectiveVenueLocation {
  /** Resolved latitude (service override → unit default → null) */
  lat: number | null
  /** Resolved longitude */
  lng: number | null
  /** Resolved check-in radius in metres */
  radiusMeters: number
  /** Human-readable venue name */
  venueName: string | null
  /** Formatted address string */
  venueAddress: string | null
}

export function useServiceInfo(serviceId: string | null) {
  const [unitName, setUnitName] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [requireLocation, setRequireLocation] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [effectiveVenue, setEffectiveVenue] = useState<EffectiveVenueLocation>({
    lat: null, lng: null, radiusMeters: 100, venueName: null, venueAddress: null,
  })

  useEffect(() => {
    if (!serviceId) return

    setLoading(true)
    supabase
      .from('services')
      .select(`
        unit_id, require_location,
        venue_name, venue_address, venue_lat, venue_lng, venue_radius_meters,
        units(name, venue_name, address, latitude, longitude, radius_meters)
      `)
      .eq('id', serviceId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const row = data as unknown as {
            unit_id: string
            require_location: boolean
            venue_name: string | null
            venue_address: string | null
            venue_lat: number | null
            venue_lng: number | null
            venue_radius_meters: number | null
            units: {
              name: string
              venue_name: string | null
              address: string | null
              latitude: number | null
              longitude: number | null
              radius_meters: number | null
            } | null
          }

          const uid = row.unit_id || null
          setUnitId(uid)
          setUnitName(row.units?.name ?? null)
          setRequireLocation(row.require_location ?? false)

          // Compute effective venue: service override takes precedence
          const hasServiceOverride = row.venue_lat != null && row.venue_lng != null
          setEffectiveVenue({
            lat: hasServiceOverride ? row.venue_lat : (row.units?.latitude ?? null),
            lng: hasServiceOverride ? row.venue_lng : (row.units?.longitude ?? null),
            radiusMeters: (hasServiceOverride
              ? row.venue_radius_meters
              : row.units?.radius_meters) ?? 100,
            venueName: (hasServiceOverride ? row.venue_name : row.units?.venue_name) ?? null,
            venueAddress: (hasServiceOverride ? row.venue_address : row.units?.address) ?? null,
          })

          // Check if SMS absence messaging is enabled for this unit.
          if (uid) {
            supabase
              .from('unit_messaging_settings')
              .select('enabled')
              .eq('unit_id', uid)
              .maybeSingle()
              .then(({ data: smsData }) => {
                setSmsEnabled((smsData as { enabled: boolean } | null)?.enabled ?? false)
              })
          }
        }
        setLoading(false)
      })
  }, [serviceId])

  return { unitName, unitId, requireLocation, smsEnabled, loading, effectiveVenue }
}


