import { supabase } from '../lib/supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  const currentPermission = isSupported ? Notification.permission : 'denied'

  async function subscribe(memberId: string, unitId: string): Promise<'granted' | 'denied' | 'error'> {
    if (!isSupported) return 'denied'

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return 'denied'

      const registration = await navigator.serviceWorker.ready

      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
      if (!vapidKey) return 'error'

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const { error } = await supabase.from('member_push_subscriptions').upsert(
        {
          member_id: memberId,
          unit_id: unitId,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        { onConflict: 'member_id,endpoint' },
      )

      return error ? 'error' : 'granted'
    } catch {
      return 'error'
    }
  }

  return { isSupported, currentPermission, subscribe }
}
