import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconX, IconSend, IconAlert, IconCheck, IconBook, IconPlus } from './icons.jsx'
import EnrollLink from './EnrollLink.jsx'
import { coursesForSkill } from '../utils/tesdaCourses.js'
import { matchLevel } from '../utils/match.js'
import '../styles/quick-apply.css'
import { tr } from '../lang/dash.js'

/**
 * Apply dialog, used everywhere a worker applies for a job (cards, For you, the job page).
 *
 * Before anything is sent it shows the fit check, on the shared scale (utils/match.js):
 *   Strong  a short green line: you have what the employer asked for
 *   Good    amber: what is missing, and a tip to mention related experience
 *   Low     red: what is missing, with "Add a skill you have" and free training for each
 *           gap. The worker can still apply: the button says "Apply anyway".
 * The worker sees and edits the message to the employer before it is sent.
 */
const MAX = 2000 // same limit as ApplicationController::apply
const MIN = 10

const title = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase())

/** A starting message in the worker's own words; they edit it freely before sending. */
function defaultCoverNote(job, user, skills = []) {
  const company = job.company || job.employer_name
  const town = user?.location
  const list = skills.slice(0, 3).map(title)
  const skillLine = list.length ? ` My skills include ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]}.` : ''
  return `Good day! I'm ${user?.full_name || 'interested in this job'}${town ? ` from ${town}` : ''}. I'd like to apply for the ${job.title} position${company ? ` at ${company}` : ''}.${skillLine} I'm ready to start and happy to come in for an interview. Thank you!`
    .replace(/\.{2,}/g, '.') // "Mindoro Co." + "." → one period
}

/** The fit check: what the worker should know before applying. */
function FitCheck({ match }) {
  const level = matchLevel(match.score)
  const gaps = match.gaps || []
  if (level.key === 'strong' && !gaps.length) {
    return (
      <div className="qa-fit strong" role="status">
        <IconCheck size={16} />
        <span><b>{tr('Strong match')} · {match.score}%</b></span>
      </div>
    )
  }
  const skillGaps = gaps.filter(g => g.kind === 'skill' || g.kind === 'certificate')
  const otherGaps = gaps.filter(g => g.kind === 'experience' || g.kind === 'education')
  return (
    <div className={`qa-fit ${level.key}`} role={level.key === 'low' ? 'alert' : 'status'}>
      <div className="qa-fit-hd">
        {level.key === 'low' ? <IconAlert size={16} /> : <IconCheck size={16} />}
        <span>
          <b>{tr(level.label)} · {match.score}%</b>{' '}
          {level.key === 'low' ? tr('You’re missing key requirements. You can still apply.') : tr('A few requirements are missing.')}
        </span>
      </div>
      {gaps.length > 0 && (
        <ul className="qa-fit-list">
          {skillGaps.slice(0, 4).map(g => {
            const course = coursesForSkill(g.name, 1)[0]
            return (
              <li key={g.name}>
                <span className="qa-fit-name">{g.name}{g.pending ? <small> · {tr('certificate being checked')}</small> : null}</span>
                {course && <EnrollLink course={course} className="qa-fit-link"><IconBook size={12} /> {tr('Free training')}</EnrollLink>}
              </li>
            )
          })}
          {otherGaps.slice(0, 2).map(g => (
            <li key={g.name}>
              <span className="qa-fit-name">{g.name}</span>
              <Link to="/dashboard/profile" className="qa-fit-link">{tr('Update profile')}</Link>
            </li>
          ))}
        </ul>
      )}
      {skillGaps.length > 0 && (
        <p className="qa-fit-foot"><Link to="/dashboard/passport"><IconPlus size={12} /> {tr('I have this skill: add it to my passport')}</Link></p>
      )}
    </div>
  )
}

export default function QuickApplyModal({ job, user, skills, onClose, onSubmit }) {
  const [note, setNote] = useState(() => defaultCoverNote(job, user, skills))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)      // { text, login? }
  // the card's match (or just its score, from Saved jobs); the server's, if it asks first
  const [match, setMatch] = useState(job.match || (job.match_score != null ? { score: Number(job.match_score), gaps: [] } : null))
  const [missing, setMissing] = useState(null)  // profile fields still needed
  const area = useRef(null)
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const titleId = useId()
  const low = match && matchLevel(match.score).key === 'low'

  useEffect(() => {
    area.current?.focus()
    area.current?.setSelectionRange(area.current.value.length, area.current.value.length)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      opener.current?.focus?.() // back to the button that opened it
    }
  }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function send(e) {
    e.preventDefault()
    const text = note.trim()
    if (text.length < MIN) { setError({ text: tr('Write a short message to the employer (at least a sentence).') }); return }
    setBusy(true); setError(null)
    try {
      // the worker has seen the fit check, so a low match is sent as "applied knowing the gaps"
      await onSubmit(text, !!low)
    } catch (err) {
      setBusy(false)
      if (err?.status === 401) setError({ text: tr('Your session has expired. Sign in again to apply.'), login: true })
      else if (err?.data?.code === 'low_match') setMatch(err.data.match)
      else if (err?.data?.code === 'profile_incomplete') setMissing(err.data.missing || [])
      else setError({ text: tr(err?.message || 'Could not send your application. Please try again.') })
    }
  }

  const company = job.company || job.employer_name
  return (
    <div className="qa-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <form className="qa-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={send}>
        <header className="qa-head">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId}>{tr('Apply for')} {job.title}</h2>
            <p>{[company, job.location].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className="qa-x" onClick={onClose} disabled={busy} aria-label={tr('Close')}><IconX size={18} /></button>
        </header>

        {match && <FitCheck match={match} />}

        <label className="qa-label" htmlFor={`${titleId}-note`}>{tr('Message to the employer')}</label>
        <textarea id={`${titleId}-note`} ref={area} value={note} maxLength={MAX} rows={6} disabled={busy}
          onChange={e => { setNote(e.target.value); if (error) setError(null) }} />
        <div className="qa-meta">
          <span>{tr('The employer also sees your Skills Passport.')}</span>
          <span aria-live="polite">{note.length.toLocaleString()} / {MAX.toLocaleString()}</span>
        </div>

        {missing && (
          <div className="qa-error" role="alert" style={{ display: 'block' }}>
            <b>{tr('Complete your profile to apply:')}</b>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>{missing.map(m => <li key={m.field}><Link to={m.where}>{tr(m.label)}</Link></li>)}</ul>
          </div>
        )}
        {error && (
          <p className="qa-error" role="alert">
            <IconAlert size={15} /> <span>{error.text} {error.login && <Link to="/login">{tr('Sign in')}</Link>}</span>
          </p>
        )}

        <div className="qa-actions">
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>{tr('Cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <><span className="spin" /> {tr('Sending…')}</> : <><IconSend size={16} /> {low ? tr('Apply anyway') : tr('Send application')}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
