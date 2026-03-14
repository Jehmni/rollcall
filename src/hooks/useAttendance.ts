import { useState } from 'react'
import { supabase } from '../lib/supabase'

export type CheckInStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'already_checked_in'
  | 'not_found'
  | 'invalid_service'
  | 'no_service'
  | 'error'

interface RpcResult {
  success: boolean
  error?: string
  name?: string
  distance?: number
}

export function useAttendance(serviceId: string | null) {
  const [status, setStatus] = useState<CheckInStatus>(serviceId ? 'idle' : 'no_service')
  const [checkedInName, setCheckedInName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function checkIn(memberId: string) {
    if (!serviceId) { setStatus('no_service'); return }

    setStatus('loading')
    setCheckedInName(null)

    // Capture geolocation if available
    let lat: number | null = null
    let lng: number | null = null
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      )
      lat = pos.coords.latitude
      lng = pos.coords.longitude
    } catch (e) {
      console.warn('Geolocation failed or denied', e)
    }

    // Capture or generate device ID
    let deviceId = localStorage.getItem('rollcally_device_id')
    if (!deviceId) {
      deviceId = self.crypto.randomUUID()
      localStorage.setItem('rollcally_device_id', deviceId)
    }

    const { data, error } = await supabase.rpc('checkin_by_id', {
      p_member_id: memberId,
      p_service_id: serviceId,
      p_device_id: deviceId,
      p_lat: lat,
      p_lng: lng
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    const result = data as RpcResult

    if (result.success) {
      setCheckedInName(result.name ?? null)
      localStorage.setItem('rollcally_member_id', memberId)
      setStatus('success')
    } else {
      if (result.name) setCheckedInName(result.name)
      switch (result.error) {
        case 'not_found':          setStatus('not_found'); break
        case 'already_checked_in': setStatus('already_checked_in'); break
        case 'invalid_service':    setStatus('invalid_service'); break
        case 'location_required':  setStatus('error'); setErrorMessage('Location access is required to check in.'); break
        case 'too_far':            setStatus('error'); setErrorMessage(`You are too far from the venue (${result.distance}m).`); break
        case 'device_locked':      setStatus('error'); setErrorMessage('This device is already linked to another member for this event.'); break
        default:
          setStatus('error')
          setErrorMessage(result.error ?? 'Something went wrong')
      }
    }
  }

  function reset() {
    setStatus(serviceId ? 'idle' : 'no_service')
    setCheckedInName(null)
    setErrorMessage(null)
  }

  return { status, checkedInName, errorMessage, checkIn, reset }
}
