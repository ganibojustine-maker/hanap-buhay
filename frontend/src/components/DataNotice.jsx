/**
 * A one-time note about what the site stores in the browser. hanapbuhay uses no advertising
 * or tracking cookies, so this informs rather than asks; dismissing it is remembered on
 * this device only.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'hb_cookie_notice'
const seen = () => { try { return localStorage.getItem(KEY) === '1' } catch { return true } }

export default function DataNotice() {
  const [show, setShow] = useState(() => !seen())
  if (!show) return null
  const ok = () => { try { localStorage.setItem(KEY, '1') } catch { /* blocked */ } setShow(false) }
  return (
    <div className="pf-cookie" role="region" aria-label="About your data">
      <span>We only keep what the site needs on your device, like your sign-in. No ads or tracking. <Link to="/privacy">Privacy Policy</Link></span>
      <button type="button" className="btn btn-primary btn-sm" onClick={ok}>OK</button>
    </div>
  )
}
