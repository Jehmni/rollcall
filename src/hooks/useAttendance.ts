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
  | 'error'

interface RpcResult {
  success: boolean
  error?: string
  name?: string
  distance?: number
}

export function useAttendance(serviceId: string | null, requireLocation = false) {
  const [status, setStatus] = useState<CheckInStatus>(serviceId ? 'idle' : 'no_service')
  const [checkedInName, setCheckedInName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function checkIn(memberId: string) {
    if (!serviceId) {
      setStatus('no_service')
      throw new Error('no_service')
    }

    setStatus('loading')
    setCheckedInName(null)

    // Only capture geolocation when the event requires it
    let lat: number | null = null
    let lng: number | null = null
    if (requireLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (e) {
        logger.warn('Geolocation failed or denied', { memberId, serviceId, error: String(e) })
      }
    }

    // Capture or generate device ID
    let deviceId = localStorage.getItem('rollcally_device_id')
    if (!deviceId) {
      deviceId = self.crypto.randomUUID()
      localStorage.setItem('rollcally_device_id', deviceId)
    }

    let data: RpcResult | null = null
    let rpcError: unknown = null

    try {
      const result = await withRetry(
        () => supabase.rpc('checkin_by_id', {
          p_member_id: memberId,
          p_service_id: serviceId,
          p_device_id: deviceId,
          p_lat: lat,
          p_lng: lng,
        }),
        {
          maxAttempts: 3,
          baseDelayMs: 600,
          // Only retry on network-level failures — not RPC logic errors
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
      let msg: string | null = null
      switch (result.error) {
        case 'not_found':          setStatus('not_found'); break
        case 'already_checked_in': setStatus('already_checked_in'); break
        case 'invalid_service':    setStatus('invalid_service'); break
        case 'location_required':
          msg = 'Location access is required to check in.'
          setStatus('error'); setErrorMessage(msg); break
        case 'too_far':
          msg = `You are too far from the venue (${result.distance}m).`
          setStatus('error'); setErrorMessage(msg); break
        case 'device_locked':
          setStatus('device_locked'); break
        default:
          msg = result.error ?? 'Something went wrong'
          setStatus('error'); setErrorMessage(msg)
      }
      logger.warn('Check-in rejected', { memberId, serviceId, reason: result.error })
      throw new Error(result.error ?? 'check_in_failed')
    }
  }

  function reset() {
    setStatus(serviceId ? 'idle' : 'no_service')
    setCheckedInName(null)
    setErrorMessage(null)
  }

  return { status, checkedInName, errorMessage, checkIn, reset }
}
