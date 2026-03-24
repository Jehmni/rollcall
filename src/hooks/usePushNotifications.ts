import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const isSupported =
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  const currentPermission = isSupported ? Notification.permission : 'denied'

  async function subscribe(memberId: string, unitId: string): Promise<'granted' | 'denied' | 'error'> {
    if (!isSupported) return 'denied'

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return 'denied'

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      await supabase.from('member_push_subscriptions').upsert(
        { member_id: memberId, unit_id: unitId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'member_id,endpoint' }
      )

      return 'granted'
    } catch {
      return 'error'
    }
  }

  return { isSupported, currentPermission, subscribe }
}
