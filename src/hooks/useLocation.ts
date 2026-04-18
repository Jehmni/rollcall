import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Distinct location states:
 *  checking          – geolocation request is in flight
 *  within            – device is inside the venue radius
 *  outside           – device is outside the venue radius
 *  permission_denied – the user explicitly denied location access
 *  unavailable       – geolocation timed out, errored, or the venue has no coordinates
 */
export type LocationStatus =
  | 'checking'
  | 'within'
  | 'outside'
  | 'permission_denied'
  | 'unavailable'

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

interface VenueOverride {
  lat: number
  lng: number
  radiusMeters: number
}

/**
 * Resolves whether the device is within the venue radius.
 *
 * Pass `venueOverride` when you already have the effective lat/lng/radius
 * (e.g. from useServiceInfo's effectiveVenue), so the hook doesn't need to
 * fetch it from the unit table again.
 *
 * Returns `{ locationStatus, configured }`:
 *   - configured  true when the venue has coordinates set
 *   - locationStatus  see LocationStatus above
 */
export function useLocation(
  unitId: string | null,
  venueOverride?: VenueOverride | null,
) {
  const [status, setStatus] = useState<LocationStatus>('checking')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      let venueLat: number | null = null
      let venueLng: number | null = null
      let venueRadius = 100

      if (venueOverride) {
        venueLat   = venueOverride.lat
        venueLng   = venueOverride.lng
        venueRadius = venueOverride.radiusMeters
      } else if (unitId) {
        const { data } = await supabase
          .from('units')
          .select('latitude, longitude, radius_meters')
          .eq('id', unitId)
          .single()

        if (cancelled) return
        venueLat   = (data?.latitude  as number | null) ?? null
        venueLng   = (data?.longitude as number | null) ?? null
        venueRadius = (data?.radius_meters as number | null) ?? 100
      }

      if (cancelled) return

      if (venueLat == null || venueLng == null) {
        setConfigured(false)
        setStatus('unavailable')
        return
      }

      setConfigured(true)

      if (!navigator.geolocation) {
        setStatus('unavailable')
        return
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          const dist = haversineDistance(
            pos.coords.latitude, pos.coords.longitude,
            venueLat!, venueLng!,
          )
          setStatus(dist <= venueRadius ? 'within' : 'outside')
        },
        (err) => {
          if (cancelled) return
          if (err.code === err.PERMISSION_DENIED) {
            setStatus('permission_denied')
          } else {
            setStatus('unavailable')
          }
        },
        { timeout: 8000, maximumAge: 60000 },
      )
    }

    setStatus('checking')
    run()
    return () => { cancelled = true }
  }, [unitId, venueOverride])

  return { locationStatus: status, configured }
}


