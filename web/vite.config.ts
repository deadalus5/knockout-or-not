import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.KO_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'KnockoutOrNot',
        short_name: 'KO?',
        description:
          'Is the fight worth watching? Find out without ever learning who won.',
        theme_color: '#0c0e12',
        background_color: '#0c0e12',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + fonts are precached. Data is NOT precached (the events
        // directory alone is ~780 files) — it is runtime-cached below.
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        globIgnores: ['data/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /data\/v1\/(index|search-index)\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ko-data-indexes',
              expiration: { maxEntries: 4 },
            },
          },
          {
            urlPattern: /data\/v1\/events\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ko-data-events',
              expiration: { maxEntries: 300 },
            },
          },
        ],
      },
    }),
  ],
})
