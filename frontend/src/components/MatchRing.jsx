/**
 * MatchRing — the match score as a clean circular gauge.
 *
 * An SVG arc with rounded ends (crisp at any size, unlike a CSS conic gradient), the
 * number in the middle with a smaller "%", and the word "match" under it. The colour
 * says how good the fit is, on the one scale in utils/match.js: green from 75, amber
 * from 50, red below.
 */
import { matchKey } from '../utils/match.js'

export const matchTone = matchKey

export default function MatchRing({ score = 0, size = 76, label = 'match', className = '' }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
  const stroke = size >= 70 ? 7 : 5
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className={`mring ${matchTone(pct)} ${className}`} style={{ width: size, height: size }}
      role="img" aria-label={`${pct}% ${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="mring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="mring-arc" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="mring-txt" style={{ fontSize: Math.round(size * 0.26) }}>
        <b>{pct}<small>%</small></b>
        {size >= 56 && <i style={{ fontSize: Math.max(9, Math.round(size * 0.12)) }}>{label}</i>}
      </span>
    </div>
  )
}
