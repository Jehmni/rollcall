/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope

// ── Precaching ─────────────────────────────────────────────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Runtime: member list RPC (NetworkFirst, offline fallback) ──────────────
registerRoute(
  ({ url }) => url.pathname.includes('/rest/v1/rpc/get_service_members'),
  new NetworkFirst({
    cacheName: 'member-list-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
  'POST',
)

// ── Runtime: Google Fonts ─────────────────────────────────────────────────
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\//,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\//,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// ── Push: show notification when session goes live ────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as {
    title: string
    body: string
    url: string
    icon?: string
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon ?? '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url },
    }),
  )
})

// ── Notification click: open check-in page ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return

  const url = (event.notification.data as { url: string }).url
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url === url && 'focus' in client) return client.focus()
        }
        return self.clients.openWindow(url)
      }),
  )
})
