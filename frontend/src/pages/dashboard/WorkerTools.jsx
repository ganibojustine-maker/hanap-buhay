// Worker tools: Saved Jobs page, availability, sharing the Skills Passport (link + QR),
// next steps after "not selected", and rating an employer after being hired.
import { useEffect, useState, useCallback } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import { Link } from 'react-router-dom'
import { IconCheck, IconSearch, IconArrow, IconStar, IconBookmark, IconQr, IconLink, IconPrinter, IconDownload } from '../../components/icons.jsx'
import { TOWNS } from '../../components/art.jsx'
import EnrollLink from '../../components/EnrollLink.jsx'
import QuickApplyModal from '../../components/QuickApplyModal.jsx'
import { FeaturedJobCard } from '../../components/JobCard.jsx'
import { coursesForSkill } from '../../utils/tesdaCourses.js'
import { tr } from '../../lang/dash.js'
import '../../styles/worker-tools.css'

/* ─ Saved Jobs: bookmarks from job cards, with whether each still takes applications ─ */
export const APP_STATUS = {
  pending: 'Pending Review', reviewed: 'Under Review', shortlisted: 'Shortlisted',
  for_interview: 'For Interview', hired: 'Hired', rejected: 'Not Selected',
}


function savedWhen(v) {
  const d = v ? new Date(String(v).replace(' ', 'T')) : null
  if (!d || isNaN(d)) return ''
  const n = Math.floor((Date.now() - d.getTime()) / 86400000)
  return n <= 0 ? tr('today') : n === 1 ? tr('yesterday') : tr('{n} days ago', { n })
}

export function SavedJobs({ call, user }) {
  const [jobs, setJobs] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('open')
  const [busy, setBusy] = useState(null)
  const [applyJob, setApplyJob] = useState(null)
  const [justApplied, setJustApplied] = useState({})
  const [setupNeeded, setSetupNeeded] = useState(false) // server's saved_jobs table isn't there yet (migration 014)

  const load = useCallback(() => {
    setError('')
    call('/saved-jobs?full=1')
      .then(r => { setSetupNeeded(!!r.setup_needed); setJobs(r.jobs || []) })
      // a server error has no useful text for a worker ("Something went wrong."): say what failed
      .catch(e => setError(e?.status >= 500 || !e?.data?.error ? tr('Could not load your saved jobs. Please try again in a minute.') : tr(e.message)))
  }, [call])
  useEffect(() => { load() }, [load])

  async function remove(ids) {
    setBusy(ids.length === 1 ? ids[0] : 'all'); setError('')
    const res = await Promise.allSettled(ids.map(id => call(`/saved-jobs/${id}`, { method: 'DELETE' })))
    const gone = new Set(ids.filter((_, i) => res[i].status === 'fulfilled'))
    setJobs(list => list.filter(j => !gone.has(j.id)))
    if (gone.size < ids.length) setError(tr('Some jobs could not be removed. Please try again.'))
    setBusy(null)
  }

  async function submitApply(note, ack = false) {
    const job = applyJob
    setBusy(job.id)
    try {
      await call('/applications', { method: 'POST', body: { job_id: job.id, cover_note: note, acknowledge_gap: ack } })
      setJustApplied(p => ({ ...p, [job.id]: true }))
      setApplyJob(null)
    } finally {
      setBusy(null)
    }
  }

  const all = jobs || []
  const open = all.filter(j => j.is_open)
  const closed = all.filter(j => !j.is_open)
  const list = filter === 'open' ? open : filter === 'closed' ? closed : all

  return (
    <div className="page-inner">
      {applyJob && <QuickApplyModal job={applyJob} user={user} onClose={() => setApplyJob(null)} onSubmit={submitApply} />}

      {error && (
        <div className="panel" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, color: 'var(--red)' }}>
          <span>{error}</span>
          {!jobs && <button type="button" className="btn btn-light btn-sm" onClick={load}>{tr("Retry")}</button>}
        </div>
      )}

      {!jobs && !error && <BrandLoader compact label="Loading saved jobs…" />}

      {jobs && setupNeeded && (
        <div className="panel sv-empty" role="status">
          <IconBookmark size={36} />
          <h2>{tr("Saved Jobs is almost ready")}</h2>
          <p>{tr("The hanapbuhay team is finishing an update. Please check back in a little while. Until then, you can still browse and apply for jobs.")}</p>
          <Link to="/dashboard/browse" className="btn btn-navy">{tr("Browse Jobs")} <IconArrow /></Link>
        </div>
      )}

      {jobs && !setupNeeded && all.length === 0 && (
        <div className="panel sv-empty">
          <IconBookmark size={36} />
          <h2>{tr("No saved jobs yet")}</h2>
          <p>{tr("Tap the bookmark on any job to keep it here, then come back when you are ready to apply.")}</p>
          <Link to="/dashboard/browse" className="btn btn-navy">{tr("Browse Jobs")} <IconArrow /></Link>
        </div>
      )}

      {jobs && all.length > 0 && (
        <>
          <div className="match-filters" role="group" aria-label={tr('Filter saved jobs')}>
            {[['open', tr('Still open ({n})', { n: open.length })], ['closed', tr('Closed ({n})', { n: closed.length })], ['all', tr('All ({n})', { n: all.length })]].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>

          {filter === 'closed' && closed.length > 0 && (
            <p className="sv-closed-note">
              {tr("These jobs no longer take applications.")}{' '}
              <button type="button" className="ja-link" onClick={() => remove(closed.map(j => j.id))} disabled={busy === 'all'}>
                {busy === 'all' ? tr('Removing…') : tr('Remove all closed jobs')}
              </button>
            </p>
          )}

          {list.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--muted)' }}>
              {filter === 'open' ? tr('None of your saved jobs are open right now.') : tr('No jobs in this list.')}
            </div>
          ) : (
            <div className="jc-grid">
              {list.map(j => {
                const applied = j.application_status || (justApplied[j.id] ? 'pending' : null)
                return (
                  <FeaturedJobCard key={j.id} job={{ ...j, match_pct: j.match_score ?? j.match_pct }}
                    detailsTo={`/dashboard/browse/${j.id}`}
                    closed={!j.is_open}
                    saved onToggleSave={id => remove([id])}
                    applied={!!applied} busy={busy === j.id} onApply={setApplyJob}>
                    {!j.is_open
                      ? <span className="chip gray">{tr('No longer accepting applications')}</span>
                      : applied && <span className="chip green"><IconCheck size={11} /> {tr(APP_STATUS[applied] || applied)}</span>}
                    <span className="sv-when">{tr('Saved {when}', { when: savedWhen(j.saved_at) })}</span>
                  </FeaturedJobCard>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ─ Availability (profile): shown to employers, preferred towns count in the match score ─ */
const WORK_TYPES = [['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contractual', 'Contractual'], ['freelance', 'Freelance'], ['gig', 'Arawan / Raket']]
const RATE_UNITS = [['day', 'per day'], ['month', 'per month'], ['hour', 'per hour'], ['project', 'per project (pakyaw)']]

export function AvailabilityPanel({ user, call, updateUser }) {
  const a = user.availability
  const [open, setOpen] = useState(a.open_to_work)
  const [types, setTypes] = useState(a.work_types || [])
  const [rate, setRate] = useState(a.expected_rate ? String(a.expected_rate) : '')
  const [unit, setUnit] = useState(a.rate_unit || 'day')
  const [towns, setTowns] = useState(a.preferred_towns || [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: { availability: {
        open_to_work: open, work_types: types, expected_rate: Number(rate) || 0, rate_unit: Number(rate) ? unit : null, preferred_towns: towns,
      } } })
      if (res?.user) updateUser?.(res.user)
      setMsg({ ok: true, text: tr('Availability saved.') })
    } catch (err) {
      setMsg({ ok: false, text: tr(err?.message || 'Could not save your availability.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel av" onSubmit={save} aria-labelledby="av-title">
      <div className="av-hd">
        <div>
          <h2 id="av-title">{tr("Availability")}</h2>
          <p>{tr("Employers see this when you apply. The towns you pick also count in your job match score.")}</p>
          <p className="av-find">{open
            ? tr('While you are open to work, employers can find your Skills Passport in Find Workers and invite you to apply. Your phone and email stay hidden until an employer unlocks them or you apply to their job.')
            : tr('Employers cannot find you in Find Workers while you are not looking. Your applications still show your passport.')}</p>
        </div>
        <label className={`av-switch${open ? ' on' : ''}`}>
          <input type="checkbox" role="switch" checked={open} onChange={e => setOpen(e.target.checked)} />
          <span aria-hidden="true" className="av-knob" />
          <b>{open ? tr('Open to work') : tr('Not looking right now')}</b>
        </label>
      </div>

      <fieldset className="ja-set">
        <legend>{tr("Kind of work")} <span>{types.length ? tr('{n} selected', { n: types.length }) : tr('Any')}</span></legend>
        <div className="ja-chips">
          {WORK_TYPES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={types.includes(id)} onClick={() => toggle(types, setTypes, id)}>{tr(label)}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="ja-set">
        <legend>{tr("Expected pay")} <span>{tr("Optional")}</span></legend>
        <div className="av-pay">
          <div className="in no-icon av-amount"><span className="av-peso" aria-hidden="true">₱</span>
            <input type="number" inputMode="numeric" min="0" step="50" value={rate} onChange={e => setRate(e.target.value)} placeholder={tr("e.g. 600")} aria-label={tr('Expected pay in pesos')} />
          </div>
          <div className="in no-icon">
            <select value={unit} onChange={e => setUnit(e.target.value)} aria-label={tr('Pay period')}>
              {RATE_UNITS.map(([id, label]) => <option key={id} value={id}>{tr(label)}</option>)}
            </select>
          </div>
        </div>
        <p className="av-hint">{tr("Only employers you apply to see your expected pay. It is not shown on your shared passport.")}</p>
      </fieldset>

      <fieldset className="ja-set">
        <legend>{tr("Towns where you can work")} <span>{towns.length ? tr('{n} selected', { n: towns.length }) : tr('Only {town}', { town: user.location || tr('your town') })}</span></legend>
        <div className="ja-towns">
          {TOWNS.map(t => (
            <label key={t} className="ja-check"><input type="checkbox" checked={towns.includes(t)} onChange={() => toggle(towns, setTowns, t)} /> {t}</label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button type="button" className="ja-link" onClick={() => setTowns([...TOWNS])}>{tr("Select all")}</button>
          <button type="button" className="ja-link" onClick={() => setTowns([])}>{tr("Clear")}</button>
        </div>
      </fieldset>

      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`av-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 170 }}>{busy ? <span className="spin" /> : tr('Save Availability')}</button>
    </form>
  )
}

/* ─ Share the Skills Passport: public link + QR code (no phone, email or address) ─ */
export function SharePassport({ user, call, updateUser }) {
  const token = user.share_token
  const url = token ? `${window.location.origin}/p/${token}` : ''
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [qr, setQr] = useState(null) // { svg, gif }
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!url) { setQr(null); return }
    let alive = true
    import('qrcode-generator').then(({ default: qrcode }) => {
      const q = qrcode(0, 'M')
      q.addData(url)
      q.make()
      if (alive) setQr({ svg: q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }), gif: q.createDataURL(8, 4) })
    }).catch(() => {})
    return () => { alive = false }
  }, [url])

  async function set(enabled, rotate = false) {
    if (rotate && !window.confirm(tr('Make a new link? The old link and any printed QR codes will stop working.'))) return
    if (!enabled && !window.confirm(tr('Turn off sharing? The link and QR code will stop working.'))) return
    setBusy(rotate ? 'rotate' : enabled ? 'on' : 'off'); setMsg(null)
    try {
      const res = await call('/auth/share', { method: 'POST', body: { enabled, rotate } })
      if (res?.user) updateUser?.(res.user)
      setMsg({ ok: true, text: !enabled ? tr('Sharing is off. The old link no longer works.') : rotate ? tr('New link ready. The old one no longer works.') : tr('Your link is ready.') })
    } catch (err) {
      setMsg({ ok: false, text: tr(err?.message || 'Could not update sharing.') })
    } finally {
      setBusy(null)
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url) } catch {
      const i = document.getElementById('share-url'); i?.select(); document.execCommand?.('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const share = () => navigator.share({ title: tr('My Skills Passport'), text: tr('My skills and certificates on hanapbuhay'), url }).catch(() => {})

  return (
    <section className="panel shp rise" aria-labelledby="shp-title">
      <div className="shp-hd">
        <span className="shp-ic"><IconQr size={20} /></span>
        <div>
          <h2 id="shp-title">{tr("Share your Skills Passport")}</h2>
          <p>{tr("A link and QR code employers can open without an account. It shows your skills, verified certificates, and work history, never your phone number, email, or address.")}</p>
        </div>
      </div>

      {!token ? (
        <button type="button" className="btn btn-navy" onClick={() => set(true)} disabled={!!busy}>
          {busy ? <span className="spin" /> : <><IconLink size={16} /> {tr('Create my link')}</>}
        </button>
      ) : (
        <div className="shp-body">
          <div className="shp-qr">
            {qr
              ? <span role="img" aria-label={tr('QR code of your Skills Passport link')} dangerouslySetInnerHTML={{ __html: qr.svg }} />
              : <span className="skel" style={{ display: 'block', width: '100%', height: '100%' }} />}
          </div>
          <div className="shp-main">
            <div className="shp-url">
              <input id="share-url" readOnly value={url} onFocus={e => e.target.select()} aria-label={tr('Your Skills Passport link')} />
              <button type="button" className="btn btn-navy btn-sm" onClick={copy}>{copied ? <><IconCheck size={14} /> {tr('Copied')}</> : tr('Copy')}</button>
            </div>
            <div className="shp-actions">
              {canShare && <button type="button" className="btn btn-light btn-sm" onClick={share}><IconLink size={14} /> {tr("Share")}</button>}
              <a className="btn btn-light btn-sm" href={url} target="_blank" rel="noopener noreferrer"><IconArrow size={14} /> {tr("Open")}</a>
              <a className="btn btn-light btn-sm" href={`${url}?print=1`} target="_blank" rel="noopener noreferrer"><IconPrinter size={14} /> {tr("Print / PDF")}</a>
              {qr && <a className="btn btn-light btn-sm" href={qr.gif} download="hanapbuhay-passport-qr.gif"><IconDownload size={14} /> {tr("Download QR")}</a>}
            </div>
            <p className="shp-tip">{tr("Tip: print it for job fairs and PESO, or put the QR code on your printed resume.")}</p>
            <div className="shp-foot">
              <button type="button" className="ja-link" onClick={() => set(true, true)} disabled={!!busy}>{busy === 'rotate' ? tr('Making a new link…') : tr('Make a new link')}</button>
              <button type="button" className="ja-link" style={{ color: 'var(--red)' }} onClick={() => set(false)} disabled={!!busy}>{busy === 'off' ? tr('Turning off…') : tr('Turn off sharing')}</button>
            </div>
          </div>
        </div>
      )}
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`av-msg ${msg.ok ? 'ok' : 'err'}`} style={{ marginTop: 12 }}>{msg.text}</p>}
    </section>
  )
}

/* ─ "Not selected": similar open jobs and the skills that job asked for ─ */
export function NextSteps({ step }) {
  if (!step) return null
  const similar = step.similar || []
  const gaps = (step.gaps || []).slice(0, 4)
  return (
    <div className="ns">
      <h4>{tr("What to do next")}</h4>
      {similar.length > 0 && (
        <>
          <p className="ns-sub">{tr("Open jobs like this one")}</p>
          <ul className="ns-jobs">
            {similar.map(j => (
              <li key={j.id}>
                <Link to={`/dashboard/browse/${j.id}`}>
                  <b>{j.title}</b>
                  <span>{[j.company, j.location].filter(Boolean).join(' · ')}</span>
                </Link>
                <span className={`chip ${j.score >= 70 ? 'green' : j.score >= 50 ? 'gold' : 'navy'}`}>{tr('{n}% match', { n: j.score })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {gaps.length > 0 && (
        <>
          <p className="ns-sub">{tr("Skills this employer asked for that you don't have yet")}</p>
          <ul className="ns-gaps">
            {gaps.map(g => {
              const [course] = coursesForSkill(g, 1)
              return (
                <li key={g}>
                  <span>{g}</span>
                  {course
                    ? <EnrollLink course={course} className="ns-learn">{tr('Learn with TESDA')} <IconArrow size={12} /></EnrollLink>
                    : <Link to="/dashboard/passport" className="ns-learn">{tr('Have it? Add it')}</Link>}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {!similar.length && !gaps.length && <p className="ns-sub">{tr("Keep your Skills Passport up to date: new jobs are matched to it every day.")}</p>}
      <Link to="/dashboard/matches" className="ns-all">{tr("See all your job matches")} <IconArrow size={13} /></Link>
    </div>
  )
}

/* ─ Hired: rate the employer (shown publicly with first name + last initial) ─ */
const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

export function Stars({ n, size = 16 }) {
  return (
    <span className="rv-stars" role="img" aria-label={tr('{n} out of 5 stars', { n })}>
      {[1, 2, 3, 4, 5].map(i => <IconStar key={i} size={size} className={i <= Math.round(n) ? 'on' : ''} />)}
    </span>
  )
}

export function RateEmployer({ app, call, onSaved }) {
  const r = app.my_review
  const company = app.company || app.employer_name || tr('the employer')
  const [editing, setEditing] = useState(!r)
  const [rating, setRating] = useState(r?.rating || 0)
  const [comment, setComment] = useState(r?.comment || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!rating) return setErr(tr('Choose from 1 to 5 stars.'))
    setBusy(true); setErr('')
    try {
      const res = await call('/reviews', { method: 'POST', body: { application_id: app.id, rating, comment } })
      onSaved(res.review)
      setEditing(false)
    } catch (e2) {
      setErr(tr(e2?.message || 'Could not save your review.'))
    } finally {
      setBusy(false)
    }
  }

  if (!editing && r) {
    return (
      <div className="rv-done">
        <Stars n={r.rating} />
        <span>{tr('You rated {company}', { company })}</span>
        {r.comment && <q>{r.comment}</q>}
        <button type="button" className="ja-link" onClick={() => setEditing(true)}>{tr("Edit")}</button>
      </div>
    )
  }

  return (
    <form className="rv-form" onSubmit={submit}>
      <fieldset>
        <legend>{tr('How was working for {company}?', { company })}</legend>
        <div className="rv-pick">
          {[1, 2, 3, 4, 5].map(i => (
            <label key={i} className={i <= rating ? 'on' : ''}>
              <input type="radio" name={`rate-${app.id}`} value={i} checked={rating === i} onChange={() => setRating(i)} />
              <IconStar size={26} />
              <span className="sr-only">{i === 1 ? tr('1 star') : tr('{n} stars', { n: i })}</span>
            </label>
          ))}
          <b className="rv-word">{rating ? tr(STAR_WORDS[rating]) : ''}</b>
        </div>
      </fieldset>
      <div className="in no-icon">
        <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={1000} rows={3}
          placeholder={tr("Optional: paid on time? safe workplace? fair treatment?")} aria-label={tr('Your review (optional)')} />
      </div>
      <p className="rv-note">{tr("Other workers see your rating with your first name and last initial. It helps them find good employers.")}</p>
      {err && <p role="alert" className="av-msg err">{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? <span className="spin" /> : tr('Submit rating')}</button>
        {r && <button type="button" className="btn btn-light btn-sm" onClick={() => setEditing(false)}>{tr("Cancel")}</button>}
      </div>
    </form>
  )
}
