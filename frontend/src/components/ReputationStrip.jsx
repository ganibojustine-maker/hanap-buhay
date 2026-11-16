/**
 * ReputationStrip — what other people see about this account, shown on your own profile.
 *
 * Editing your profile is where you decide what to say about yourself; this strip is the
 * other half of the page: the star rating real employers (or real workers) gave you, how
 * many people follow you, and a link straight to the public page they land on. Without it
 * the ratings and the network live somewhere else entirely and nobody finds them.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconStar, IconUsers, IconArrow, IconShield, IconMsgCircle } from './icons.jsx'
import { tr } from '../lang/dash.js'
import '../styles/social.css'

function Stars({ value = 0, size = 15 }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={i <= Math.round(value) ? '#F5A623' : '#e5e7eb'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}

export default function ReputationStrip({ call, user }) {
  const [p, setP] = useState(null)
  const [missing, setMissing] = useState(false)

  const load = useCallback(() => {
    if (!user?.id) return
    call(`/social/profile/${user.id}`)
      .then(r => setP(r.profile))
      .catch(() => setMissing(true))
  }, [call, user?.id])
  useEffect(() => { load() }, [load])

  if (missing || !p) return null
  const isWorker = p.account_type === 'worker'
  const rated = p.rating?.count > 0

  return (
    <section className="rep">
      <div className="rep-main">
        <p className="eyebrow">{tr('How others see you')}</p>
        <div className="rep-stats">
          <div className="rep-stat">
            {rated
              ? <b><Stars value={p.rating.average} /> {p.rating.average}</b>
              : <b className="rep-none">{tr('No ratings yet')}</b>}
            <span>
              {rated
                ? `${p.rating.count} ${p.rating.count === 1 ? tr('rating') : tr('ratings')}`
                : tr('after your first hire')}
            </span>
          </div>
          <div className="rep-stat"><b>{p.counts?.connections ?? 0}</b><span>{tr('connections')}</span></div>
          <div className="rep-stat"><b>{p.counts?.followers ?? 0}</b><span>{tr('followers')}</span></div>
          <div className="rep-stat">
            <b>{isWorker ? (p.hired_count ?? 0) : (p.hires_count ?? 0)}</b>
            <span>{isWorker ? tr('jobs hired for') : tr('people hired')}</span>
          </div>
          {p.is_verified && (
            <div className="rep-stat verified"><b><IconShield size={15} /> {tr('Verified')}</b><span>{tr('checked by hanapbuhay')}</span></div>
          )}
        </div>
      </div>
      <div className="rep-links">
        <Link to={`/dashboard/people/${user.id}`} className="btn btn-light btn-sm">{tr('View public profile')} <IconArrow size={13} /></Link>
        <Link to="/dashboard/network" className="btn btn-light btn-sm"><IconUsers size={14} /> {tr('My network')}</Link>
        <Link to="/dashboard/reviews" className="btn btn-light btn-sm"><IconStar size={14} /> {tr('Ratings')}</Link>
        <Link to="/dashboard/messages" className="btn btn-light btn-sm"><IconMsgCircle size={14} /> {tr('Messages')}</Link>
      </div>
    </section>
  )
}
