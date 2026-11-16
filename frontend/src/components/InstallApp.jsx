import { useEffect, useState } from 'react'
import { subscribe, promptInstall, isIOS } from '../pwa.js'
import { IconX } from './icons.jsx'
import { tr } from '../lang/dash.js'

// "Install the app" card at the top of the dashboard. Android/Chrome/Edge get the real
// install button; iPhone Safari (no install prompt) gets the Add to Home Screen steps.
const KEY = 'hb_install_dismissed_until'
const SNOOZE_DAYS = 14

function snoozed() {
  try { return Number(localStorage.getItem(KEY) || 0) > Date.now() } catch { return false }
}

export default function InstallApp() {
  const [s, setS] = useState({ canInstall: false, installed: true })
  const [dismissed, setDismissed] = useState(snoozed)
  const [iosHelp, setIosHelp] = useState(false)
  useEffect(() => subscribe(setS), [])

  const ios = isIOS()
  if (s.installed || dismissed || (!s.canInstall && !ios)) return null

  function later() {
    try { localStorage.setItem(KEY, String(Date.now() + SNOOZE_DAYS * 86400000)) } catch { /* ignore */ }
    setDismissed(true)
  }
  async function install() {
    if (ios) return setIosHelp(v => !v)
    const outcome = await promptInstall()
    if (outcome === 'dismissed') later()
  }

  return (
    <div className="pwa-install" role="region" aria-label={tr("Install the hanapbuhay app")}>
      <img src="/icons/icon-192.png" alt="" width="44" height="44" />
      <div className="pwa-install-copy">
        <b>{tr("Install the hanapbuhay app")}</b>
        <span>{tr("Opens faster from your home screen, uses less data, and works even with weak signal.")}</span>
        {iosHelp && (
          <ol className="pwa-ios-steps">
            <li>{tr("Tap the")} <b>{tr("Share")}</b> {tr("button")} <span aria-hidden="true">{tr("(square with an arrow)")}</span> {tr("at the bottom of Safari.")}</li>
            <li>{tr("Choose")} <b>{tr("Add to Home Screen")}</b>{tr(", then tap")} <b>{tr("Add")}</b>.</li>
          </ol>
        )}
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={install} aria-expanded={ios ? iosHelp : undefined}>
          {ios ? (iosHelp ? tr("Hide steps") : tr("How to install")) : tr("Install")}
        </button>
        <button type="button" className="pwa-install-x" onClick={later} aria-label={tr("Not now")}><IconX size={16} /></button>
      </div>
    </div>
  )
}
