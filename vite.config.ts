import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Vercel exposes the commit; fall back to a timestamp for local builds. Surfaced in the app's
// scan diagnostics so a stale cached bundle can be identified from the phone in one look.
const BUILD_ID = [
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
  new Date().toISOString().slice(0, 16).replace('T', ' '),
].join(' · ')

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Grocery Spend',
        short_name: 'Spend',
        description: 'Track your household grocery spending',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })
  ],
  // Expose both VITE_* and SUPABASE_* prefixes so the Vercel-Supabase
  // integration's env vars (SUPABASE_URL, SUPABASE_ANON_KEY) work without
  // needing to manually rename them in the Vercel dashboard.
  envPrefix: ['VITE_', 'SUPABASE_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
