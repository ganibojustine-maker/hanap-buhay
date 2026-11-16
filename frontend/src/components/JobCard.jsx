import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../auth.jsx'
import { Link } from 'react-router-dom'
import { IconCheck, IconArrow, IconBolt } from './icons.jsx'
import { getJobImage } from '../utils/jobImages.js'
import { tr } from '../lang/dash.js'

/* ─ Helpers ─────────────────────────────────────────────── */
const peso = n => '₱' + Number(n).toLocaleString()

/** "/ month", "/ day", "/ hour" or "fixed budget" — how this job's pay is counted. */
export function paySuffix(job = {}) {
  const b = job.pay_basis || 'month'
  return b === 'fixed' ? tr('fixed budget') : b === 'day' ? tr('/ day') : b === 'hour' ? tr('/ hour') : tr('/ month')
}
export const PAY_LABEL = { month: 'Monthly pay', day: 'Daily rate', hour: 'Hourly rate', fixed: 'Fixed budget' }

/** "Needed by Nov 20" / "Needed today" for a gig, or null. */
export function neededBy(job = {}) {
  if (!job.needed_by) return null
  const d = new Date(String(job.needed_by) + 'T00:00:00')
  if (isNaN(d)) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((d - today) / 864e5)
  if (days <= 0) return tr('Needed today')
  if (days === 1) return tr('Needed tomorrow')
  return tr('Needed by {date}', { date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) })
}

export function fmtSalary(min, max) {
  if (!min && !max) return tr('Salary negotiable')
  if (min && max) return `${peso(min)} – ${peso(max)}`
  return min ? tr('From {pay}', { pay: peso(min) }) : tr('Up to {pay}', { pay: peso(max) })
}

const toDate = v => {
  if (!v) return null
  const d = new Date(typeof v === 'string' ? v.replace(' ', 'T') : v)
  return isNaN(d) ? null : d
}

export function timeAgo(v) {
  const d = toDate(v)
  if (!d) return null
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 3600) return tr('Just now')
  if (s < 86400) return tr('{n}h ago', { n: Math.floor(s / 3600) })
  const days = Math.floor(s / 86400)
  if (days === 1) return tr('Yesterday')
  if (days < 7) return tr('{n} days ago', { n: days })
  if (days < 30) return tr('{n}w ago', { n: Math.floor(days / 7) })
  return tr('{n}mo ago', { n: Math.floor(days / 30) })
}

export function isNewJob(v, withinDays = 3) {
  const d = toDate(v)
  return !!d && Date.now() - d.getTime() < withinDays * 86400000
}

export function parseSkills(s) {
  if (Array.isArray(s)) return s.filter(Boolean)
  return String(s || '').split(/[,;|\n]/).map(x => x.trim()).filter(Boolean)
}

/* ─ Saved jobs: stored on the account, so they follow you to any device ─ */
const SAVED_KEY = 'hb_saved_jobs' // legacy per-browser list, imported once then cleared

export function useSavedJobs() {
  const { user, call } = useAuth()
  const [saved, setSaved] = useState(() => new Set())

  useEffect(() => {
    if (!user?.id) { setSaved(new Set()); return }
    let alive = true
    ;(async () => {
      try {
        const r = await call('/saved-jobs')
        const ids = new Set((r?.job_ids || []).map(Number))
        // one-time import of bookmarks made in this browser before they moved to the account
        const legacy = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]').map(Number).filter(Boolean)
        const missing = legacy.filter(id => !ids.has(id))
        if (missing.length) {
          await call('/saved-jobs/sync', { method: 'POST', body: { job_ids: missing.slice(0, 100) } })
          missing.forEach(id => ids.add(id))
        }
        localStorage.removeItem(SAVED_KEY)
        if (alive) setSaved(ids)
      } catch {
        if (alive) setSaved(new Set())
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const toggle = useCallback(async (id) => {
    const n = Number(id)
    if (!user) { window.location.href = '/login'; return }
    const wasSaved = saved.has(n)
    const flip = (on) => setSaved(prev => {
      const next = new Set(prev)
      on ? next.add(n) : next.delete(n)
      return next
    })
    flip(!wasSaved)
    try {
      if (wasSaved) await call(`/saved-jobs/${n}`, { method: 'DELETE' })
      else await call('/saved-jobs', { method: 'POST', body: { job_id: n } })
    } catch {
      flip(wasSaved) // roll back if the server refused
    }
  }, [call, user, saved])

  const isSaved = useCallback(id => saved.has(Number(id)), [saved])
  return { saved, toggle, isSaved }
}
function BookmarkIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function VerifiedIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 1.5l2.6 2.1 3.3-.4 1.1 3.2 2.9 1.6-1 3.2 1 3.2-2.9 1.6-1.1 3.2-3.3-.4L12 22.5l-2.6-2.1-3.3.4-1.1-3.2-2.9-1.6 1-3.2-1-3.2 2.9-1.6 1.1-3.2 3.3.4L12 1.5zm-1.2 13.9l5.3-5.3-1.4-1.4-3.9 3.9-1.8-1.8-1.4 1.4 3.2 3.2z" />
    </svg>
  )
}

/* ─ Job card — the one card every job list in the app uses ─────────
   Dashboard, Find Jobs (For you, Search), Saved jobs and Similar jobs all draw a
   job with this, so a job looks the same wherever someone meets it:
     photo  (with Featured / match % on it, bookmark in the corner)
     logo + title + company
     pay, then town · type · posted
     New / applicants
     anything the page adds (children): skills you have, saved date, status…
     Easy Apply + View details
   The full description, skills and match analysis live on the job's own page.
*/
/**
 * props
 *  job          job row from the API
 *  compact      no apply button (signed out, employers): "View details" only
 *  applied      already applied (job.applied counts too)
 *  busy         apply in flight
 *  onApply      (job) => void
 *  saved        boolean
 *  onToggleSave (id) => void   (omit to hide the bookmark)
 *  detailsTo    link target (default /jobs/:id)
 *  closed       job no longer takes applications
 *  children     extra lines shown above the buttons
 */
export function FeaturedJobCard({
  job, compact = false,
  applied = false, busy = false, onApply,
  saved = false, onToggleSave, detailsTo, style, closed = false, children, coverUrl,
}) {
  const company = job.company || job.employer_name || tr('Local Employer')
  const posted = timeAgo(job.created_at)
  const fresh = isNewJob(job.created_at)
  const applicants = Number(job.applicants ?? job.applicant_count ?? 0)
  const verified = Boolean(Number(job.employer_verified ?? 0))
  const featured = Number(job.is_featured) === 1
  const score = job.match_pct ?? job.match?.score ?? job.match_score ?? null
  const to = detailsTo || `/jobs/${job.id}`
  const type = (job.job_type || 'full-time')
  const hasPay = Boolean(job.salary_min || job.salary_max)
  const isApplied = applied || Boolean(job.applied)

  const applicantNote = applicants === 0
    ? tr('Be the first applicant')
    : applicants < 5 ? tr('Be an early applicant') : tr('{n} applicants', { n: applicants })

  return (
    <article className={`jc${closed ? ' is-closed' : ''}`} style={style}>
      <Link to={to} className="jc-cover" tabIndex={-1} aria-hidden="true">
        <img src={coverUrl || getJobImage(job)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
        <span className="jc-flags">
          {Number(job.is_urgent) === 1 && <span className="jc-flag urgent">{tr('Urgent')}</span>}
          {featured && <span className="jc-flag feat">{tr('Featured')}</span>}
          {score != null && score > 0 && (
            <span className={`jc-flag score ${score >= 75 ? 'strong' : score >= 50 ? 'good' : ''}`}>{score}{tr('% match')}</span>
          )}
        </span>
      </Link>

      {onToggleSave && (
        <button
          type="button"
          className={`jc-save${saved ? ' on' : ''}`}
          onClick={() => onToggleSave(job.id)}
          aria-pressed={saved}
          aria-label={saved ? tr('Remove from saved jobs') : tr('Save job')}
          title={saved ? tr('Saved') : tr('Save job')}
        >
          <BookmarkIcon filled={saved} />
        </button>
      )}

      <div className="jc-row">
        <Link to={to} className="jc-logo" aria-hidden="true" tabIndex={-1}>
          <span>{(company[0] || 'J').toUpperCase()}</span>
          {job.employer_picture && <img src={job.employer_picture} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
        </Link>
        <div className="jc-head">
          <Link to={to} className="jc-title" title={job.title}>{job.title}</Link>
          <div className="jc-company" title={company}>
            <span>{company}</span>
            {verified && <i className="jc-vchk" title={tr('Verified employer')}><VerifiedIcon /></i>}
          </div>
        </div>
      </div>

      <div className="jc-salary">
        {!hasPay && ['gig', 'freelance'].includes(job.job_type) ? tr('Price to discuss') : fmtSalary(job.salary_min, job.salary_max)}
        {hasPay && <small>{paySuffix(job)}</small>}
      </div>

      <div className="jc-line">
        {job.post_type === 'gig' && <><span className="pf-type gig">{tr('Gig')}</span><i /></>}
        <span>{[job.barangay, job.location].filter(Boolean).join(', ') || tr('Oriental Mindoro')}</span>
        <i />
        <span className="cap">{tr(type)}</span>
        {posted && <><i /><span>{posted}</span></>}
      </div>
      {(neededBy(job) || job.duration || Number(job.openings) > 1) && (
        <div className="jc-line jc-extra-line">
          {neededBy(job) && <span className="jc-need">{neededBy(job)}</span>}
          {job.duration && <><i /><span>{job.duration}</span></>}
          {Number(job.openings) > 1 && <><i /><span>{tr('{n} openings', { n: job.openings })}</span></>}
        </div>
      )}

      {/* match level and the main gap, right on the card (not only in View details) */}
      {score != null && job.match && (
        <p className={`jc-fit ${score >= 75 ? 'strong' : score >= 50 ? 'good' : 'low'}`}>
          <b>{tr(job.match.level_label || (score >= 75 ? 'Strong match' : score >= 50 ? 'Good match' : 'Low match'))}</b>
          {(job.match.gaps || []).length > 0
            ? <span> · {tr('Missing')}: {job.match.gaps.slice(0, 2).map(g => g.name).join(', ')}{job.match.gaps.length > 2 ? ` +${job.match.gaps.length - 2}` : ''}</span>
            : <span> · {tr('You meet every requirement')}</span>}
        </p>
      )}

      {!closed && (
        <div className="jc-tags">
          {fresh && <span className="jc-pill new">{tr('New')}</span>}
          <span className={`jc-note${applicants < 5 ? ' early' : ''}`}>{applicantNote}</span>
        </div>
      )}

      {children && <div className="jc-extra">{children}</div>}

      <div className="jc-foot">
        {compact || closed ? (
          <Link to={to} className="btn btn-navy btn-sm jc-wide">{tr('View details')} <IconArrow size={14} /></Link>
        ) : isApplied ? (
          <>
            <span className="jc-applied"><IconCheck size={14} /> {tr('Applied')}</span>
            <Link to={to} className="btn btn-light btn-sm">{tr('View details')}</Link>
          </>
        ) : job.post_type === 'gig' ? (
          <>
            <Link to={to} className="btn btn-primary btn-sm">{tr('Send proposal')}</Link>
            <Link to={to} className="btn btn-light btn-sm">{tr('View details')}</Link>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => onApply && onApply(job)}>
              {busy ? tr('Applying…') : <><IconBolt size={14} /> {tr('Easy Apply')}</>}
            </button>
            <Link to={to} className="btn btn-light btn-sm">{tr('View details')}</Link>
          </>
        )}
      </div>
    </article>
  )
}

export default FeaturedJobCard
