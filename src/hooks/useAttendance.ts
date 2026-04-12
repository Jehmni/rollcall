import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/retry'
import { logger } from '../lib/logger'

export type CheckInStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'already_checked_in'
  | 'not_found'
  | 'invalid_service'
  | 'no_service'
  | 'device_locked'
  | 'permission_denied'    // User explicitly denied browser location access
  | 'location_unavailable' // Geolocation timed out or device cannot determine position
  | 'outside_radius'       // Location obtained but member is outside the venue radius
  | 'error'

interface RpcResult {
  success: boolean
  error?: string
  name?: string
  distance?: number
  radius?: number
  venue_name?: string
}

export function useAttendance(serviceId: string | null, requireLocation = false) {
  const [status, setStatus] = useState<CheckInStatus>(serviceId ? 'idle' : 'no_service')
  const [checkedInName, setCheckedInName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorVenueName, setErrorVenueName] = useState<string | null>(null)
  const [errorDistance, setErrorDistance] = useState<number | null>(null)

  async function checkIn(memberId: string) {
    if (!serviceId) {
      setStatus('no_service')
      throw new Error('no_service')
    }

    setStatus('loading')
    setCheckedInName(null)
    setErrorMessage(null)
    setErrorVenueName(null)
    setErrorDistance(null)

    // Capture device geolocation when the event requires it.
    // We distinguish three failure modes before even calling the backend:
    //   1. PERMISSION_DENIED  – browser denied access → show permission error
    //   2. POSITION_UNAVAILABLE / TIMEOUT – technical failure → show unavailable error
    //   3. Success → proceed with lat/lng
    let lat: number | null = null
    let lng: number | null = null

    if (requireLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (e) {
        const geoErr = e as GeolocationPositionError | null
        if (geoErr && 'code' in geoErr && geoErr.code === geoErr.PERMISSION_DENIED) {
          logger.warn('Geolocation permission denied', { memberId, serviceId })
          setStatus('permission_denied')
          throw new Error('permission_denied')
        } else {
          logger.warn('Geolocation unavailable', { memberId, serviceId, error: String(e) })
          setStatus('location_unavailable')
          throw new Error('location_unavailable')
        }
      }
    }

    // Capture or generate a persistent device ID
    let deviceId = localStorage.getItem('rollcally_device_id')
    if (!deviceId) {
      deviceId = self.crypto.randomUUID()
      localStorage.setItem('rollcally_device_id', deviceId)
    }

    let data: RpcResult | null = null
    let rpcError: unknown = null

    try {
      const result = await withRetry(
        async () => await supabase.rpc('checkin_by_id', {
          p_member_id: memberId,
          p_service_id: serviceId,
          p_device_id: deviceId,
          p_lat: lat,
          p_lng: lng,
        }),
        {
          maxAttempts: 3,
          baseDelayMs: 600,
          // Only retry on transient network failures, not RPC logic errors
          isRetryable: (err) => {
            const e = err as { message?: string; code?: string }
            if (!e?.message) return false
            const msg = e.message.toLowerCase()
            return msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')
          },
        },
      )
      if (result.error) {
        rpcError = result.error
      } else {
        data = result.data as RpcResult
      }
    } catch (err) {
      rpcError = err
    }

    if (rpcError) {
      const errObj = rpcError as { message?: string }
      logger.error('check-in RPC failed', rpcError instanceof Error ? rpcError : undefined, {
        memberId, serviceId, error: errObj?.message ?? String(rpcError),
      })
      setStatus('error')
      setErrorMessage(errObj?.message ?? 'Something went wrong')
      throw rpcError
    }

    const result = data as RpcResult

    if (result.success) {
      logger.info('Check-in succeeded', { memberId, serviceId, name: result.name })
      setCheckedInName(result.name ?? null)
      localStorage.setItem('rollcally_member_id', memberId)
      setStatus('success')
    } else {
      if (result.name) setCheckedInName(result.name)
      if (result.venue_name) setErrorVenueName(result.venue_name)

      switch (result.error) {
        case 'not_found':
          setStatus('not_found')
          break
        case 'already_checked_in':
          setStatus('already_checked_in')
          break
        case 'invalid_service':
          setStatus('invalid_service')
          break
        case 'location_required':
          // Backend got null lat/lng — should not happen now (we bail before calling
          // the backend if permission is denied), but handle it defensively.
          setStatus('permission_denied')
          break
        case 'too_far':
          setErrorDistance(result.distance ?? null)
          setStatus('outside_radius')
          break
        case 'device_locked':
          setStatus('device_locked')
          break
        default:
          setErrorMessage(result.error ?? 'Something went wrong')
          setStatus('error')
      }
      logger.warn('Check-in rejected', { memberId, serviceId, reason: result.error })
      throw new Error(result.error ?? 'check_in_failed')
    }
  }

  function reset() {
    setStatus(serviceId ? 'idle' : 'no_service')
    setCheckedInName(null)
    setErrorMessage(null)
    setErrorVenueName(null)
    setErrorDistance(null)
  }

  return {
    status,
    checkedInName,
    errorMessage,
    errorVenueName,
    errorDistance,
    checkIn,
    reset,
  }
}
