import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert die App unter https://<user>.github.io/<repo>/ aus.
// Die GitHub Action setzt den Pfad automatisch per `--base=/<repo>/`.
export default defineConfig({
  base: '/finanzen/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Alle Dateien aus public/ und dist/ werden über globPatterns vorab gecacht
      includeManifestIcons: false,
      manifest: {
        name: 'Finanzen',
        short_name: 'Finanzen',
        description: 'Ausgaben tracken und sparen – privat und offline.',
        lang: 'de',
        dir: 'ltr',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1f6f6b',
        background_color: '#f6f6f3',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
