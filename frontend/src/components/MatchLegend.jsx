/**
 * MatchLegend: what the match colours mean, shown once above a list of scored posts.
 *   ● Strong 75%+   ● Good 50–74%   ● Low under 50%   How is it counted?
 */
import { Link } from 'react-router-dom'
import { MATCH_LEVELS } from '../utils/match.js'
import { tr } from '../lang/dash.js'

const RANGE = { strong: '75%+', good: '50–74%', low: 'under 50%' }

export default function MatchLegend({ className = '' }) {
  return (
    <div className={`mlg ${className}`} role="note" aria-label={tr('What the match colours mean')}>
      <span className="mlg-t">{tr('Match')}</span>
      {MATCH_LEVELS.map(l => (
        <span key={l.key} className={`mlg-i ${l.key}`} title={tr(l.hint)}>
          <i aria-hidden="true" /> <b>{tr(l.label.replace(' match', ''))}</b> {RANGE[l.key]}
        </span>
      ))}
      <Link to="/faq#matching" className="mlg-how">{tr('How is it counted?')}</Link>
    </div>
  )
}
