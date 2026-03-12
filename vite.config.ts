import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache the member list RPC so check-in works in low-signal venues.
        // NetworkFirst: tries network (3 s timeout), falls back to cache.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/rest/v1/rpc/get_service_members'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'member-list-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 30,          // cache up to 30 different services
                maxAgeSeconds: 60 * 60 * 24 * 7, // keep for 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Choir Rollcall',
        short_name: 'Rollcall',
        description: 'QR-based attendance for choir members',
        theme_color: '#1d4ed8',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/checkin',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
