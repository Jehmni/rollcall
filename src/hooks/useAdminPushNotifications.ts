import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function useAdminPushNotifications(unitId: string) {
  const { session } = useAuth()
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'denied'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkSubscription() {
      if (!isSupported || permission !== 'granted' || !session?.user.id) {
        setIsSubscribed(false)
        return
      }

      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (!existing) {
          if (!cancelled) setIsSubscribed(false)
          return
        }

        const { count } = await supabase
          .from('admin_push_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id)
          .eq('unit_id', unitId)
          .eq('endpoint', existing.endpoint)

        if (!cancelled) setIsSubscribed((count ?? 0) > 0)
      } catch {
        if (!cancelled) setIsSubscribed(false)
      }
    }

    checkSubscription()
    return () => {
      cancelled = true
    }
  }, [isSupported, permission, session?.user.id, unitId])

  async function subscribe(): Promise<'granted' | 'denied' | 'error'> {
    if (!isSupported || !VAPID_PUBLIC_KEY || !session?.user.id) return 'denied'

    setLoading(true)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== 'granted') return 'denied'

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string
        keys?: { p256dh?: string; auth?: string }
      }

      if (!keys?.p256dh || !keys.auth) return 'error'

      const { error } = await supabase.from('admin_push_subscriptions').upsert(
        {
          user_id: session.user.id,
          unit_id: unitId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,unit_id,endpoint' }
      )

      if (error) return 'error'
      setIsSubscribed(true)
      return 'granted'
    } catch {
      return 'error'
    } finally {
      setLoading(false)
    }
  }

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
  }
}
