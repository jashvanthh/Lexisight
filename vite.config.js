import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // FIX: disable SW in dev -- it intercepts /room/:code routes and serves
      // stale cache, causing chrome-error://chromewebdata/ crashes
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'LexiSight -- ISL Translator',
        short_name: 'LexiSight',
        description: '63 million Indians cannot be heard. LexiSight changes that.',
        theme_color: '#020408',
        background_color: '#020408',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // FIX: ensure SPA navigation fallback so /room/:code always gets index.html
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /\/model\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['@tensorflow/tfjs']
  },
  server: {
    host: true,
    port: 5174,
    watch: {
      // ml/ contains ~87,000 training files that exhaust the Linux inotify
      // file-watcher limit on GitHub Actions runners, crashing Vite on startup.
      // Exclude all large data directories that are not source files.
      ignored: [
        '**/ml/**',
        '**/Datasets/**',
        '**/Datasets_local/**',
        '**/node_modules/**',
        '**/.git/**'
      ]
    }
  }
})
