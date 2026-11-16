import { useEffect, useState } from 'react'
import { subscribe, applyUpdate } from '../pwa.js'

// App-wide notices: a new version is ready, or the phone went offline.
export default function AppUpdate() {
  const [s, setS] = useState({ updateReady: false, online: true })
  const [hidden, setHidden] = useState(false)
  useEffect(() => subscribe(setS), [])

  if (!s.online) {
    return (
      <div className="pwa-toast offline" role="status" aria-live="polite">
        <span><b>You're offline.</b> Pages you opened before still work. New info loads when you're back online.</span>
      </div>
    )
  }
  if (s.updateReady && !hidden) {
    return (
      <div className="pwa-toast" role="status" aria-live="polite">
        <span><b>A new version of hanapbuhay is ready.</b></span>
        <div className="pwa-toast-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>Update now</button>
          <button type="button" className="pwa-toast-x" onClick={() => setHidden(true)} aria-label="Later">Later</button>
        </div>
      </div>
    )
  }
  return null
}
