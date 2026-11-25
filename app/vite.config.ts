import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Hosted at a sub-path on GitHub Pages (https://<user>.github.io/throne/): build with VITE_BASE=/throne/.
// Other hosts (Cloudflare Pages, Netlify, Vercel) serve from the root, so the default is '/'.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Throne: Unofficial D&D Campaign Manager',
        short_name: 'Throne',
        description: 'Unofficial D&D Campaign Manager. Notes, characters, dice and DM tools. Not affiliated with Wizards of the Coast.',
        theme_color: '#1b1b1b',
        background_color: '#14100e',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { navigateFallback: 'index.html', maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
    }),
  ],
  server: { port: 5173 },
})
