import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  IconPin, IconClock, IconUsers, IconCheck, IconStar, IconShield,
  IconBriefcase, IconArrow, IconEye, IconBolt
} from './icons.jsx'
import { getJobImage } from '../utils/jobImages.js'

/* ─ Helpers ─────────────────────────────────────────────── */
const peso = n => '₱' + Number(n).toLocaleString()

export function fmtSalary(min, max) {
  if (!min && !max) return 'Salary negotiable'
  if (min && max) return `${peso(min)} – ${peso(max)}`
  return min ? `From ${peso(min)}` : `Up to ${peso(max)}`
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
  if (s < 3600) return 'Just now'
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const days = Math.floor(s / 86400)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function isNewJob(v, withinDays = 3) {
  const d = toDate(v)
  return !!d && Date.now() - d.getTime() < withinDays * 86400000
}

export function parseSkills(s) {
  if (Array.isArray(s)) return s.filter(Boolean)
  return String(s || '').split(/[,;|\n]/).map(x => x.trim()).filter(Boolean)
}

/* ─ Saved jobs (per-browser bookmark list) ──────────────── */
const SAVED_KEY = 'hb_saved_jobs'

export function useSavedJobs() {
  const [saved, setSaved] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]').map(Number)) } catch { return new Set() }
  })
  const toggle = useCallback(id => {
    const n = Number(id)
    setSaved(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])) } catch { /* private mode */ }
      return next
    })
  }, [])
  const isSaved = useCallback(id => saved.has(Number(id)), [saved])
  return { saved, toggle, isSaved }
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

/* ─ Job card ────────────────────────────────────────────── */
/**
 * props
 *  job          job row from API (or demo)
 *  variant      'list' (full width, with description) | 'grid' (compact tile)
 *  compact      hide apply button (public landing) and show only "View details"
 *  applied      boolean, user already applied
 *  busy         boolean, apply in flight
 *  onApply      (job) => void
 *  saved        boolean
 *  onToggleSave (id) => void   (omit to hide the bookmark button)
 *  detailsTo    override link target
 */
export function FeaturedJobCard({
  job, variant = 'list', compact = false,
  applied = false, busy = false, onApply,
  saved = false, onToggleSave, detailsTo, style
}) {
  const company = job.company || job.employer_name || 'Local Employer'
  const posted = timeAgo(job.created_at)
  const fresh = isNewJob(job.created_at)
  const applicants = Number(job.applicants ?? job.applicant_count ?? 0)
  const allSkills = parseSkills(job.skills_needed || job.skills)
  const skills = allSkills.slice(0, variant === 'grid' ? 3 : 5)
  const moreSkills = allSkills.length - skills.length
  const verified = job.employer_verified === undefined || job.employer_verified === null
    ? true
    : Boolean(Number(job.employer_verified))
  const logo = job.employer_picture || getJobImage(job)
  const to = detailsTo || `/jobs/${job.id}`
  const type = (job.job_type || 'full-time').replace('-', ' ')
  const featured = Number(job.is_featured ?? 1) === 1

  return (
    <article className={`jc jc-${variant}${featured ? ' jc-featured' : ''}`} style={style}>
      <div className="jc-top">
        <Link to={to} className="jc-logo" aria-label={company}>
          <span>{(company[0] || 'J').toUpperCase()}</span>
          <img src={logo} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
        </Link>

        <div className="jc-head">
          <div className="jc-badges">
            {featured && <span className="jc-badge featured"><IconStar size={10} /> Featured</span>}
            {fresh && <span className="jc-badge new">New</span>}
            {job.match_pct ? <span className="jc-badge match">{job.match_pct}% match</span> : null}
          </div>
          <Link to={to} className="jc-title">{job.title}</Link>
          <div className="jc-company">
            <span>{company}</span>
            {verified && (
              <span className="jc-verified" title="Verified employer">
                <IconShield size={11} /> Verified
              </span>
            )}
          </div>
        </div>

        {onToggleSave && (
          <button
            type="button"
            className={`jc-save${saved ? ' on' : ''}`}
            onClick={() => onToggleSave(job.id)}
            aria-pressed={saved}
            aria-label={saved ? 'Remove from saved jobs' : 'Save job'}
            title={saved ? 'Saved' : 'Save job'}
          >
            <BookmarkIcon filled={saved} />
          </button>
        )}
      </div>

      <div className="jc-salary">
        {fmtSalary(job.salary_min, job.salary_max)}
        {(job.salary_min || job.salary_max) ? <small>per month</small> : null}
      </div>

      <ul className="jc-meta">
        <li><IconPin size={13} /> {job.location || 'Oriental Mindoro'}</li>
        <li><IconBriefcase size={13} /> <span className="cap">{type}</span></li>
        {posted && <li><IconClock size={13} /> {posted}</li>}
        <li className={applicants < 5 ? 'early' : ''}>
          <IconUsers size={13} />
          {applicants === 0 ? 'Be the first applicant' : applicants < 5 ? 'Be an early applicant' : `${applicants} applicants`}
        </li>
      </ul>

      {skills.length > 0 && (
        <div className="jc-skills">
          {skills.map(s => <span key={s}>{s}</span>)}
          {moreSkills > 0 && <span className="more">+{moreSkills} more</span>}
        </div>
      )}

      {!compact && job.description && (
        <p className="jc-desc">{job.description}</p>
      )}

      <div className="jc-foot">
        {compact ? (
          <Link to={to} className="btn btn-navy btn-sm">View details <IconArrow size={14} /></Link>
        ) : applied ? (
          <>
            <span className="jc-applied"><IconCheck size={14} /> Applied</span>
            <Link to={to} className="btn btn-light btn-sm">View details</Link>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => onApply && onApply(job)}
            >
              {busy ? 'Applying…' : <><IconBolt size={14} /> Easy Apply</>}
            </button>
            <Link to={to} className="btn btn-light btn-sm">View details</Link>
          </>
        )}
        {Number(job.views) > 0 && (
          <span className="jc-views"><IconEye size={13} /> {Number(job.views).toLocaleString()} views</span>
        )}
      </div>
    </article>
  )
}

export default FeaturedJobCard
