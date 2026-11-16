/* hanapbuhay service worker. Built into dist/sw.js by vite.config.js, which fills in
 * __VERSION__, __SHELL__ (files cached on install) and __ASSETS__ (every built file).
 *
 *   Pages (navigations) → the cached app shell (index.html), so the app opens instantly
 *                         and offline; falls back to the network, then offline.html.
 *   /assets/*           → cache first: file names contain a content hash, so they never change.
 *   /images, /icons     → stale-while-revalidate: shown from cache, refreshed in the background.
 *   API, Firebase, CDNs → never touched (other origins pass straight through).
 */
const VERSION = __VERSION__
const SHELL = __SHELL__
const ASSETS = new Set(__ASSETS__)

const SHELL_CACHE = `hb-shell-${VERSION}`
const ASSET_CACHE = 'hb-assets'
const IMAGE_CACHE = 'hb-images'
const MAX_IMAGES = 80

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)))
  // the first install activates right away; updates wait until the person taps "Update now"
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('hb-shell-') && key !== SHELL_CACHE) await caches.delete(key)
    }
    // drop hashed files from older versions
    const assets = await caches.open(ASSET_CACHE)
    for (const req of await assets.keys()) {
      if (!ASSETS.has(new URL(req.url).pathname)) await assets.delete(req)
    }
    await self.clients.claim()
  })())
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(IMAGE_CACHE)
  const hit = await cache.match(request)
  const refresh = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone()).then(() => trim(IMAGE_CACHE, MAX_IMAGES))
    return res
  }).catch(() => hit)
  if (hit) { event.waitUntil(refresh); return hit }
  return refresh
}

async function appShell(request) {
  const cache = await caches.open(SHELL_CACHE)
  const shell = await cache.match('/index.html')
  if (shell) return shell
  try {
    return await fetch(request)
  } catch {
    return (await cache.match('/offline.html')) || Response.error()
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return            // API, Firebase, TESDA, CDNs
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    // files that are real pages of their own, not the React app
    if (url.pathname === '/offline.html') return
    event.respondWith(appShell(request))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }
  if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icons/') || /\.(png|jpe?g|webp|svg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
