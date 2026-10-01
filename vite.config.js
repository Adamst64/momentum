import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.GITHUB_ACTIONS ? '/momentum/' : '/';
const shortcut = (name, action) => ({
  name, short_name: name, url: `${base}?action=${action}`,
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
});

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Momentum',
        short_name: 'Momentum',
        description: 'Daily routines & task tracker',
        theme_color: '#0F0F0F',
        background_color: '#0F0F0F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        // Long-press the app icon (Android, desktop). iOS doesn't support these yet.
        shortcuts: [
          shortcut('Add task', 'add-task'),
          shortcut('Add shopping item', 'add-item'),
          shortcut('New journal entry', 'new-note'),
          shortcut('Daily review', 'review'),
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
