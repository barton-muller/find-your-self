import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { BRAND } from './src/brand';

const build = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

// Content Security Policy as a meta tag (GitHub Pages cannot set headers). Scripts only from this site, connections only to the
// services the app uses. A script injected through plan data can then neither load code nor send a token elsewhere.
// Styles allow 'unsafe-inline' because React and Leaflet set style attributes. The relay comes from the same setting the app uses.
const csp = (): Plugin => {
  const relay = loadEnv('production', process.cwd(), 'VITE_').VITE_GH_RELAY || BRAND.auth.relay;
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    `connect-src 'self' https://api.github.com ${new URL(relay).origin} https://api.open-meteo.com https://geocoding-api.open-meteo.com https://router.project-osrm.org https://tile.openstreetmap.org`,
    "font-src 'self' data:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => html.replace('</title>', `</title>\n<meta http-equiv="Content-Security-Policy" content="${policy}" />`) },
  };
};

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    csp(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: `${BRAND.name}: trip planner`,
        short_name: BRAND.short,
        description: BRAND.tagline,
        theme_color: '#0f766e',
        background_color: '#f6f5f1',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
    }),
  ],
});
