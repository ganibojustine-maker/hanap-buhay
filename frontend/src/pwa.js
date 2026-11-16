// Installable app (PWA): service worker registration, "new version" detection and the
// install prompt. Imported once by main.jsx so the browser's one-time install event
// is never missed; AppUpdate and InstallApp read the shared state with subscribe().
// The service worker itself (dist/sw.js) is generated at build time (vite.config.js).

const state = {
  updateReady: false,  // a new version finished downloading and waits to be applied
  canInstall: false,   // the browser offered an install prompt (Android Chrome, Edge, desktop)
  installed: isStandalone(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
}
const listeners = new Set()
let installEvent = null
let waitingWorker = null
let reloadOnChange = false

function isStandalone() {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true }
  catch { return false }
}
function emit() { const snap = { ...state }; listeners.forEach(fn => fn(snap)) }

export function subscribe(fn) {
  listeners.add(fn)
  fn({ ...state })
  return () => listeners.delete(fn)
}

/** iPhone/iPad Safari has no install prompt: people add it with Share → Add to Home Screen. */
export function isIOS() {
  const ua = navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/** Shows the browser's install dialog. Resolves 'accepted', 'dismissed' or 'unavailable'. */
export async function promptInstall() {
  if (!installEvent) return 'unavailable'
  const e = installEvent
  installEvent = null
  state.canInstall = false
  emit()
  e.prompt()
  try { return (await e.userChoice)?.outcome || 'dismissed' } catch { return 'dismissed' }
}

/** Switches to the downloaded version; the page reloads once the new worker takes over. */
export function applyUpdate() {
  if (!waitingWorker) return window.location.reload()
  reloadOnChange = true
  waitingWorker.postMessage({ type: 'SKIP_WAITING' })
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault() // we show our own button instead of the browser's mini bar
    installEvent = e
    state.canInstall = true
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    Object.assign(state, { canInstall: false, installed: true })
    emit()
  })
  window.addEventListener('online', () => { state.online = true; emit() })
  window.addEventListener('offline', () => { state.online = false; emit() })
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // only reload when the person pressed "Update"; never on the very first install
    if (reloadOnChange) { reloadOnChange = false; window.location.reload() }
  })

  const markWaiting = worker => {
    waitingWorker = worker
    state.updateReady = true
    emit()
  }

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      if (reg.waiting && navigator.serviceWorker.controller) markWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) markWaiting(w)
        })
      })
      // Installed apps can stay open for days: look for a new version when they come back to the front
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    } catch (err) {
      console.warn('[pwa] service worker not registered:', err?.message || err)
    }
  })
}
