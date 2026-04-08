import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type LocationStatus = 'checking' | 'within' | 'outside' | 'unavailable'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check whether the device is within the venue radius for a given unit.
 * Coordinates are fetched from `units.latitude/longitude/radius_meters`.
 * Returns `unavailable` if the unit has no coordinates or geolocation is denied.
 */
export function useLocation(unitId: string | null) {
  const [status, setStatus] = useState<LocationStatus>('checking')
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    if (!unitId) {
      setStatus('unavailable')
      return
    }

    let cancelled = false

    async function run() {
      const { data } = await supabase
        .from('units')
        .select('latitude, longitude, radius_meters')
        .eq('id', unitId!)
        .single()

      if (cancelled) return

      const lat = data?.latitude as number | null
      const lng = data?.longitude as number | null
      const radius = (data?.radius_meters as number | null) ?? 100

      if (!lat || !lng) {
        setStatus('unavailable')
        setConfigured(false)
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
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, lat, lng)
          setStatus(dist <= radius ? 'within' : 'outside')
        },
        () => { if (!cancelled) setStatus('unavailable') },
        { timeout: 6000, maximumAge: 60000 },
      )
    }

    run()
    return () => { cancelled = true }
  }, [unitId])

  return { locationStatus: status, configured }
}
