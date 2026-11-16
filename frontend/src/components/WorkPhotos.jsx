/**
 * WorkPhotos — a worker's work photos as other people see them (read-only).
 *
 * Shown wherever someone looks at a worker:
 *   • an employer opening an application          (ApplicantProfile)
 *   • anyone signed in opening the worker's profile (PublicProfile)
 *   • anyone with the worker's Skills Passport link (PublicPassport)
 * The worker manages the photos in Skills Passport → Work photos (WorkGallery).
 */
import { useState } from 'react'
import { fileUrl } from '../api.js'
import { IconX } from './icons.jsx'
import '../styles/social.css'

/** variant: 'panel' (dashboard pages) · 'ap' (employer's applicant view) · 'pp' (public passport) */
export default function WorkPhotos({ items = [], title = 'Work photos', note, limit, variant = 'panel' }) {
  const [open, setOpen] = useState(null)
  if (!items.length) return null
  const shown = limit ? items.slice(0, limit) : items
  const src = w => fileUrl(`/portfolio/${w.id}/file`)

  return (
    <section className={variant === 'ap' ? 'ap-card wp' : variant === 'pp' ? 'pp-sec wp' : 'panel wp'}>
      {variant === 'ap' ? (
        <h3>{title} <span className="ap-count">{items.length}</span></h3>
      ) : variant === 'pp' ? (
        <h2>{title}</h2>
      ) : (
        <div className="panel-hd">
          <div>
            <h2>{title}</h2>
            {note && <p className="wp-note">{note}</p>}
          </div>
          <span className="chip navy">{items.length}</span>
        </div>
      )}
      {variant !== 'panel' && note && <p className="wp-note" style={{ marginBottom: 10 }}>{note}</p>}
      <ul className="pf-grid">
        {shown.map(w => (
          <li key={w.id}>
            <button type="button" onClick={() => setOpen(w)} aria-label={`Open photo: ${w.title}`}>
              <img src={src(w)} alt={w.title} loading="lazy" />
            </button>
            <b>{w.title}</b>
            {w.skill_name && <span className="chip navy" style={{ fontSize: 10 }}>{w.skill_name}</span>}
            {w.description && <p>{w.description}</p>}
          </li>
        ))}
      </ul>

      {open && (
        <div className="pf-lightbox" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={open.title}>
          <figure onClick={e => e.stopPropagation()}>
            <img src={src(open)} alt={open.title} />
            <figcaption>
              <b>{open.title}</b>
              {open.skill_name && <span className="chip navy" style={{ fontSize: 10, marginBottom: 6 }}>{open.skill_name}</span>}
              {open.description && <p>{open.description}</p>}
              <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(null)}><IconX size={14} /> Close</button>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  )
}
