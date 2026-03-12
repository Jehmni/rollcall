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
}

export function useAttendance(serviceId: string | null) {
  const [status, setStatus] = useState<CheckInStatus>(serviceId ? 'idle' : 'no_service')
  const [checkedInName, setCheckedInName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function checkIn(memberId: string) {
    if (!serviceId) { setStatus('no_service'); return }

    setStatus('loading')
    setCheckedInName(null)

    const { data, error } = await supabase.rpc('checkin_by_id', {
      p_member_id: memberId,
      p_service_id: serviceId,
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }

    const result = data as RpcResult

    if (result.success) {
      setCheckedInName(result.name ?? null)
      setStatus('success')
    } else {
      if (result.name) setCheckedInName(result.name)
      switch (result.error) {
        case 'not_found':          setStatus('not_found'); break
        case 'already_checked_in': setStatus('already_checked_in'); break
        case 'invalid_service':    setStatus('invalid_service'); break
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
