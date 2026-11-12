/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Dois destinos, um código: `npm run build` gera o PWA (dist/, com service worker); `npm run build:android` (VITE_ANDROID=1) gera o
// pacote que vai DENTRO do APK (dist-android/, sem service worker nem manifest: o app já está em disco).
const android = process.env.VITE_ANDROID === '1'

/** No APK a WebView recua pelas barras do sistema (plugin SystemBars): sem `viewport-fit=cover`. As fontes .woff (para navegadores
 *  antigos) ficam de fora: a WebView do Android usa a .woff2, que vem primeiro na lista do @font-face. */
const androidHtml = (): Plugin => ({
  name: 'android-html',
  transformIndexHtml: (html) => html.replace(', viewport-fit=cover', ''),
  generateBundle(_, bundle) { for (const nome of Object.keys(bundle)) if (nome.endsWith('.woff')) delete bundle[nome] },
})

export default defineConfig({
  base: './',
  build: { outDir: android ? 'dist-android' : 'dist', chunkSizeWarningLimit: 1800 },
  resolve: android ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/services/pwa-vazio.ts', import.meta.url)) } } : {},
  plugins: [
    react(),
    ...(android ? [androidHtml()] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // q/: ~400 PNG de questões (33 MB). pages/p<letra>*: páginas inteiras das provas dos outros bancos (Caixa, Amazônia, BNB, Banese, TI; ~20 MB).
        // As páginas das provas antigas do BB (pages/p2010-…) seguem no precache. O resto carrega na primeira vez que a questão aparece (e o APK leva tudo).
        globIgnores: ['q/**', 'pages/p[a-z]*'],
        // Abrir a imagem numa aba ("toque para ampliar") é uma navegação: sem isto o service worker responderia com o index.html do app.
        navigateFallbackDenylist: [/\/q\/[^/]+\.png$/, /\/pages\/[^/]+\.jpg$/],
        maximumFileSizeToCacheInBytes: 3_000_000,
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.includes('/q/') && url.pathname.endsWith('.png'), handler: 'CacheFirst', options: { cacheName: 'questoes-img', expiration: { maxEntries: 500 } } },
          { urlPattern: ({ url }) => /\/pages\/p[a-z][^/]*\.jpg$/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'paginas-img', expiration: { maxEntries: 300 } } },
        ],
      },
      manifest: {
        name: 'Logos', short_name: 'Logos', lang: 'pt-BR', display: 'standalone',
        start_url: './', scope: './', background_color: '#000000', theme_color: '#000000',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    })]),
  ],
  test: { environment: 'jsdom', globals: true },
})
