/**
 * ServiceCard: one worker's service listing ("Aircon cleaning, from ₱800"), the way clients
 * browse them: cover photo, the worker, rating, jobs done, towns and the starting price.
 * Used in Find Talent → Services, on a worker's profile and under "More from this worker".
 */
import { Link } from 'react-router-dom'
import UserAvatar from './Avatar.jsx'
import { IconCheck, IconPin, IconClock, IconStar } from './icons.jsx'
import { getJobImage } from '../utils/jobImages.js'
import { apiUrl } from '../utils/photos.js'
import { peso } from '../utils/format.js'
import { CATEGORIES } from '../utils/categories.js'

export const UNIT = { job: 'per job', hour: 'per hour', day: 'per day' }
export const serviceCover = s => apiUrl(s.cover || s.photos?.[0]?.url) || getJobImage({ title: s.title, category: s.category, id: s.id })

export default function ServiceCard({ s, to, actions, showWorker = true }) {
  const w = s.worker || {}
  const pk = s.packages || []
  const rating = w.rating?.count ? w.rating : null
  return (
    <article className="svc">
      <Link to={to} className="svc-cover" tabIndex={-1} aria-hidden="true">
        <img src={serviceCover(s)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
        {(s.photos?.length || 0) > 1 && <span className="svc-n">{s.photos.length} photos</span>}
        {s.status === 'paused' && <span className="svc-paused">Paused</span>}
      </Link>
      <div className="svc-body">
        {showWorker && (
          <div className="svc-who">
            <UserAvatar user={{ id: s.worker_id, full_name: s.worker_name || w.full_name, picture: s.worker_picture || w.picture, avatar_color: s.avatar_color || w.avatar_color }} size={28} />
            <span className="svc-name">{s.worker_name || w.full_name}</span>
            {Number(s.worker_verified ?? w.is_verified) === 1 && <span className="pf-vbadge" title="Identity checked by our team"><IconCheck size={10} /> Verified</span>}
          </div>
        )}
        <h3><Link to={to}>{s.title}</Link></h3>
        <p className="svc-meta">
          {rating ? <span className="svc-rate"><IconStar size={12} /> <b>{rating.average}</b> ({rating.count})</span> : <span className="svc-new">New</span>}
          {Number(w.completed_gigs) > 0 && <span>{w.completed_gigs} job{Number(w.completed_gigs) === 1 ? '' : 's'} done</span>}
          {s.category && CATEGORIES[s.category] && <span>{CATEGORIES[s.category]}</span>}
        </p>
        <p className="svc-meta"><span><IconPin size={11} /> {s.service_area || s.worker_location || 'Oriental Mindoro'}</span><span><IconClock size={11} /> {s.delivery_days} day{Number(s.delivery_days) === 1 ? '' : 's'}</span></p>
        <div className="svc-foot">
          <span className="svc-price"><small>{pk.length > 1 ? 'From' : 'Price'}</small> {peso(s.price, { cents: false })} <small>{UNIT[s.price_unit] || ''}</small></span>
          {actions}
        </div>
      </div>
    </article>
  )
}
