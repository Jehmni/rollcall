import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Rollcally',
        short_name: 'Rollcally',
        description: 'Smart attendance tracking for any organization',
        theme_color: '#121121',
        background_color: '#121121',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Check In',
            short_name: 'Check In',
            description: 'Scan QR code to check in',
            url: '/checkin',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Admin Dashboard',
            short_name: 'Dashboard',
            description: 'Manage organizations and units',
            url: '/admin',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
    }),
  ],
})
