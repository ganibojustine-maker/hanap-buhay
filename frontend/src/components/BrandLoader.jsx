/**
 * BrandLoader — the one loading state for content in hanapbuhay.
 *
 * hanapbuhay's own animation (BrandMark: the search lens finding jobs along a road),
 * with a short line saying what is loading.
 * If it is still going after 8 seconds, a second line says so — on a slow phone
 * connection a spinner that never explains itself looks like a frozen app.
 *
 *   compact  for a section of a page (220px tall) instead of the whole page
 *
 * Network activity in general is shown by <TopProgress/> (the thin gold bar at the top).
 */
import { useEffect, useState } from 'react'
import { tr } from '../lang/dash.js'
import BrandMark from './BrandMark.jsx'

export default function BrandLoader({ label = 'Loading…', compact = false }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`brand-loader${compact ? ' compact' : ''}`} role="status" aria-live="polite">
      <BrandMark size={compact ? 108 : 132} />
      <span className="bl-label">{tr(label).replace(/[….\s]+$/, '')}<span className="bl-dots" aria-hidden="true"><i /><i /><i /></span></span>
      {slow && <small className="bl-slow">{tr('Still working… this can take a moment on a slow connection.')}</small>}
    </div>
  )
}
