import { useEffect, useState } from 'react'

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

const CHURCH_LAT = import.meta.env.VITE_CHURCH_LAT ? Number(import.meta.env.VITE_CHURCH_LAT) : null
const CHURCH_LNG = import.meta.env.VITE_CHURCH_LNG ? Number(import.meta.env.VITE_CHURCH_LNG) : null
const CHURCH_RADIUS = import.meta.env.VITE_CHURCH_RADIUS_M
  ? Number(import.meta.env.VITE_CHURCH_RADIUS_M)
  : 300

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>('checking')

  useEffect(() => {
    // If church coordinates not configured, skip location check
    if (!CHURCH_LAT || !CHURCH_LNG) {
      setStatus('unavailable')
      return
    }

    if (!navigator.geolocation) {
      setStatus('unavailable')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          CHURCH_LAT,
          CHURCH_LNG,
        )
        setStatus(dist <= CHURCH_RADIUS ? 'within' : 'outside')
      },
      () => setStatus('unavailable'), // permission denied or error → don't block
      { timeout: 6000, maximumAge: 60000 },
    )
  }, [])

  return { locationStatus: status, configured: !!(CHURCH_LAT && CHURCH_LNG) }
}
