import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconX, IconSend, IconAlert } from './icons.jsx'
import '../styles/quick-apply.css'
import { tr } from '../lang/dash.js'

// Quick Apply: the worker sees and can edit the message before anything is sent.
const MAX = 2000 // same limit as ApplicationController::apply
const MIN = 10

const title = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase())

/** A starting message in the worker's own words; they edit it freely before sending. */
export function defaultCoverNote(job, user, skills = []) {
  const company = job.company || job.employer_name
  const town = user?.location
  const list = skills.slice(0, 3).map(title)
  const skillLine = list.length ? ` My skills include ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]}.` : ''
  return `Good day! I'm ${user?.full_name || 'interested in this job'}${town ? ` from ${town}` : ''}. I'd like to apply for the ${job.title} position${company ? ` at ${company}` : ''}.${skillLine} I'm ready to start and happy to come in for an interview. Thank you!`
    .replace(/\.{2,}/g, '.') // "Mindoro Co." + "." → one period
}

export default function QuickApplyModal({ job, user, skills, onClose, onSubmit }) {
  const [note, setNote] = useState(() => defaultCoverNote(job, user, skills))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null) // { text, login? }
  const [gap, setGap] = useState(null)      // low match: the server's match, shown before applying anyway
  const [missing, setMissing] = useState(null) // profile fields still needed
  const area = useRef(null)
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const titleId = useId()

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
      await onSubmit(text, !!gap)
    } catch (err) {
      setBusy(false)
      if (err?.status === 401) setError({ text: tr('Your session has expired. Sign in again to apply.'), login: true })
      else if (err?.data?.code === 'low_match') setGap(err.data.match)
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
            <h2 id={titleId}>{tr("Apply for")} {job.title}</h2>
            <p>{[company, job.location].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" className="qa-x" onClick={onClose} disabled={busy} aria-label={tr("Close")}><IconX size={18} /></button>
        </header>

        <label className="qa-label" htmlFor={`${titleId}-note`}>{tr("Message to the employer")}</label>
        <textarea id={`${titleId}-note`} ref={area} value={note} maxLength={MAX} rows={7} disabled={busy}
          onChange={e => { setNote(e.target.value); if (error) setError(null) }} />
        <div className="qa-meta">
          <span>{tr("Edit it as you like. The employer also sees your profile and Skills Passport.")}</span>
          <span aria-live="polite">{note.length.toLocaleString()} / {MAX.toLocaleString()}</span>
        </div>

        {missing && (
          <div className="qa-error" role="alert" style={{ display: 'block' }}>
            <b>{tr('Complete your profile to apply:')}</b>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>{missing.map(m => <li key={m.field}><Link to={m.where}>{tr(m.label)}</Link></li>)}</ul>
          </div>
        )}
        {gap && (
          <div className="qa-gap" role="alert">
            <b>{tr('This job asks for things your profile doesn’t show yet')} ({gap.score}%, {tr(gap.level_label)})</b>
            <p>{tr('Missing')}: {(gap.gaps || []).slice(0, 4).map(g => g.name).join(', ')}</p>
            <p>{tr('Want training to fill the gap?')} <Link to="/dashboard/training">{tr('See free TESDA courses')}</Link>. {tr('Or press Apply anyway.')}</p>
          </div>
        )}
        {error && (
          <p className="qa-error" role="alert">
            <IconAlert size={15} /> <span>{error.text} {error.login && <Link to="/login">{tr("Sign in")}</Link>}</span>
          </p>
        )}

        <div className="qa-actions">
          <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>{tr("Cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? <span className="spin" /> : <><IconSend size={16} /> {gap ? tr('Apply anyway') : tr("Send application")}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
