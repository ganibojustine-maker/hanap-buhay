import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

/**
 * Builds dist/sw.js (the offline-capable service worker) from src/sw-template.js.
 * It runs after Vite has named every file, so the worker knows exactly which files
 * make up the app shell (cached on install) and which hashed files belong to this
 * version (older ones are deleted when the new version takes over).
 */
function serviceWorker() {
  return {
    name: 'hanapbuhay-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(c => c.type === 'chunk' && c.isEntry)
      // app shell: the page, the entry script with everything it imports up front, and its CSS
      const shell = new Set(['/index.html', '/offline.html', '/manifest.webmanifest', '/favicon.png', '/images/logo-light.png', '/icons/icon-192.png'])
      const add = name => {
        const c = bundle[name]
        if (!c || shell.has('/' + name)) return
        shell.add('/' + name)
        if (c.type === 'chunk') {
          c.imports.forEach(add)
          c.viteMetadata?.importedCss?.forEach(css => shell.add('/' + css))
        }
      }
      if (entry) add(entry.fileName)

      const assets = Object.keys(bundle).filter(f => f.startsWith('assets/')).map(f => '/' + f).sort()
      const html = bundle['index.html']?.source ?? ''
      const version = createHash('sha256').update(assets.join('\n') + html).digest('hex').slice(0, 12)

      const source = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8')
        .replace('const VERSION = __VERSION__', `const VERSION = ${JSON.stringify(version)}`)
        .replace('const SHELL = __SHELL__', `const SHELL = ${JSON.stringify([...shell])}`)
        .replace('const ASSETS = new Set(__ASSETS__)', `const ASSETS = new Set(${JSON.stringify(assets)})`)
      if (/= __(VERSION|SHELL|ASSETS)__|\(__ASSETS__\)/.test(source)) this.error('sw-template.js placeholders were not filled in')
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// Port is pinned on purpose: Google OAuth only accepts origins you registered,
// so if 5173 is busy we must FAIL instead of silently moving to 5174/5175
// (that is what caused "Error 400: origin_mismatch").
export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        // React + router change rarely: keep them in their own file so returning visitors
        // reuse the cached copy after each deploy instead of downloading it again.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|cookie|set-cookie-parser)[\\/]/.test(id)) return 'vendor-react'
        },
      },
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy /api/* calls to the PHP backend so CORS is never an issue in dev
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { host: 'localhost', port: 5173, strictPort: true },
})
