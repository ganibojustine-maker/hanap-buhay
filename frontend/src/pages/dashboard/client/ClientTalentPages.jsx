/**
 * Find Talent — the client's copy of Find Workers (team rule: each role has its own pages).
 * Same API (/api/talent), worded for gigs and proposals.
 *
 *   /dashboard/talent          search: skill or name, town, work type, verified only,
 *                              or "best for one of my jobs" (ranked by the same matcher
 *                              workers see on their job matches)
 *   /dashboard/talent/saved    the saved workers ("talent pool"), with private notes
 *   /dashboard/talent/:id      one worker's passport: skills, certificates, work photos,
 *                              experience, reviews — plus contact, invite to apply, save
 *
 * Phone and email are never shown in a list. They open with one contact unlock from the
 * plan (once per worker; free on unlimited plans), or straight away when the worker has
 * already applied to one of your jobs.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import UserAvatar from '../../../components/Avatar.jsx'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import WorkPhotos from '../../../components/WorkPhotos.jsx'
import MatchRing from '../../../components/MatchRing.jsx'
import {
  IconSearch, IconPin, IconShield, IconBookmark, IconPhone, IconMail, IconLock, IconCheck,
  IconMsgCircle, IconSend, IconStar, IconBriefcase, IconArrow, IconBook, IconUsers,
} from '../../../components/icons.jsx'
import { TOWNS } from '../../../components/art.jsx'
import '../../../styles/talent.css'

const TYPES = [['', 'Any work type'], ['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contractual', 'Contractual'], ['freelance', 'Freelance'], ['gig', 'Gig / Raket']]
const TYPE_LABEL = Object.fromEntries(TYPES)
const UNIT = { day: '/day', month: '/month', hour: '/hour', project: '/project' }

function Stars({ value = 0 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map(i => <IconStar key={i} size={13} style={{ color: i <= Math.round(value) ? '#F5A623' : '#E2E8F0', fill: i <= Math.round(value) ? '#F5A623' : 'none' }} />)}
    </span>
  )
}

function Credits({ credits }) {
  if (!credits) return null
  return (
    <div className="tl-credits">
      <IconLock size={15} />
      <span>{credits.unlimited
        ? <><b>Unlimited</b> contact unlocks on your plan</>
        : <><b>{credits.left}</b> contact unlock{credits.left === 1 ? '' : 's'} left</>}</span>
      <small>Workers who send proposals for your gigs are always free to contact.</small>
      {!credits.unlimited && <Link to="/dashboard/subscription" className="btn btn-light btn-sm">Get more</Link>}
    </div>
  )
}

/** One worker in a list. */
function WorkerCard({ w, onToggleSave }) {
  const a = w.availability
  return (
    <article className="tl-card">
      <div className="tl-card-top">
        <UserAvatar user={w} size={52} />
        <div className="tl-card-id">
          <Link to={`/dashboard/talent/${w.id}`} className="tl-name">
            {w.full_name}
            {w.is_verified && <i className="tl-vchk" title="Verified by hanapbuhay"><IconCheck size={10} /></i>}
          </Link>
          <span className="tl-sub"><IconPin size={12} /> {w.location || 'Oriental Mindoro'}</span>
          {w.rating?.count > 0 && <span className="tl-rate"><Stars value={w.rating.average} /> {w.rating.average} <small>({w.rating.count})</small></span>}
        </div>
        {w.match ? <MatchRing score={w.match.score} size={56} /> : (
          <button type="button" className={`tl-save${w.saved ? ' on' : ''}`} onClick={() => onToggleSave(w)}
            aria-pressed={w.saved} aria-label={w.saved ? 'Remove from saved workers' : 'Save worker'} title={w.saved ? 'Saved' : 'Save worker'}>
            <IconBookmark size={15} />
          </button>
        )}
      </div>

      {a && (
        <p className="tl-avail">
          <span className={`tl-dot${a.open_to_work ? ' on' : ''}`} /> {a.open_to_work ? 'Open to work' : 'Not looking'}
          {a.work_types?.length > 0 && <> · {a.work_types.map(t => TYPE_LABEL[t] || t).join(', ')}</>}
          {a.expected_rate ? <> · ₱{Number(a.expected_rate).toLocaleString('en-PH')}{UNIT[a.rate_unit] || ''}</> : null}
        </p>
      )}

      <div className="tl-skills">
        {w.skills.length === 0 && <span className="tl-none">No skills listed yet</span>}
        {w.skills.map(s => (
          <span key={s.name} className={`tl-skill${s.verified ? ' v' : ''}`}>{s.verified && <IconShield size={11} />}{s.name}</span>
        ))}
        {w.skills_count > w.skills.length && <span className="tl-more">+{w.skills_count - w.skills.length}</span>}
      </div>
      {w.match?.missing?.length > 0 && <p className="tl-missing">Missing for this gig: {w.match.missing.slice(0, 3).join(', ')}</p>}

      <div className="tl-card-foot">
        <span className="tl-flags">
          {w.verified_count > 0 && <span className="chip green"><IconShield size={11} /> {w.verified_count} verified</span>}
          {w.applied && <span className="chip navy">Sent you a proposal</span>}
          {!w.applied && w.unlocked && <span className="chip gold">Contact unlocked</span>}
        </span>
        <Link to={`/dashboard/talent/${w.id}`} className="btn btn-navy btn-sm">View profile <IconArrow size={13} /></Link>
      </div>
    </article>
  )
}

/* ── Search ───────────────────────────────────────────────── */
export function ClientFindWorkers({ call }) {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [town, setTown] = useState(params.get('town') || '')
  const [type, setType] = useState(params.get('type') || '')
  const [verified, setVerified] = useState(params.get('verified') === '1')
  const [forJob, setForJob] = useState(params.get('for_job') || '')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => { call('/gigs/mine').then(r => setJobs((r.gigs || []).filter(j => j.status === 'active'))).catch(() => {}) }, [call])

  const load = useCallback(async (pg = 1) => {
    setBusy(true); setError('')
    const qs = new URLSearchParams({ page: String(pg) })
    if (q.trim()) qs.set('q', q.trim())
    if (town) qs.set('town', town)
    if (type) qs.set('type', type)
    if (verified) qs.set('verified', '1')
    if (forJob) qs.set('for_job', forJob)
    try {
      setData(await call(`/talent?${qs}`))
      setPage(pg)
      const keep = Object.fromEntries([...qs].filter(([k]) => k !== 'page'))
      setParams(keep, { replace: true })
    } catch (e) {
      setError(e?.message || 'Could not search workers.')
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, q, town, type, verified, forJob])

  // filters apply at once; typing waits a moment
  useEffect(() => { const t = setTimeout(() => load(1), 300); return () => clearTimeout(t) }, [load])

  async function toggleSave(w) {
    try {
      await call(`/talent/${w.id}/save`, { method: w.saved ? 'DELETE' : 'POST', body: w.saved ? undefined : {} })
      setData(d => ({ ...d, workers: d.workers.map(x => x.id === w.id ? { ...x, saved: !w.saved } : x) }))
    } catch (e) { setError(e?.message || 'Could not save this worker.') }
  }

  const list = data?.workers || []
  return (
    <div className="page-inner tl">
      <form className="tl-search" onSubmit={e => { e.preventDefault(); load(1) }}>
        <label className="tl-q"><IconSearch size={17} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Skill or name, e.g. welding, electrician, cook" aria-label="Skill or name" />
        </label>
        <label className="tl-sel"><IconPin size={16} />
          <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town">
            <option value="">All of Oriental Mindoro</option>
            {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      <div className="tl-filters">
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Work type">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" className={`tl-toggle${verified ? ' on' : ''}`} aria-pressed={verified} onClick={() => setVerified(v => !v)}>
          <IconShield size={14} /> Verified certificates only
        </button>
        {jobs.length > 0 && (
          <select value={forJob} onChange={e => setForJob(e.target.value)} aria-label="Rank for a gig" className="tl-forjob">
            <option value="">Rank by: profile strength</option>
            {jobs.map(j => <option key={j.id} value={j.id}>Best match for: {j.title}</option>)}
          </select>
        )}
      </div>

      <Credits credits={data?.credits} />

      {error && <p className="tl-error" role="alert">{error}</p>}
      {data?.enabled === false && <p className="tl-note">Contact unlocks, saved workers and invitations switch on after the next site update. You can already search.</p>}

      {!data ? <BrandLoader compact label="Finding workers…" />
        : (
          <>
            <p className="tl-count">
              <b>{data.total}</b> worker{data.total === 1 ? '' : 's'} open to work{town ? ` in or near ${town}` : ''}
              {data.job ? <>, best match for <b>{data.job.title}</b> first</> : null}
            </p>
            {list.length === 0 ? (
              <div className="panel tl-empty">
                <IconUsers size={36} />
                <h3>No workers match these filters</h3>
                <p>Try a broader skill, another town, or turn off “Verified certificates only”.</p>
              </div>
            ) : (
              <div className={`tl-grid${busy ? ' is-busy' : ''}`}>
                {list.map(w => <WorkerCard key={w.id} w={w} onToggleSave={toggleSave} />)}
              </div>
            )}
            {data.pages > 1 && (
              <nav className="tl-pager" aria-label="Pages">
                <button type="button" className="btn btn-light btn-sm" disabled={page <= 1 || busy} onClick={() => load(page - 1)}>← Prev</button>
                <span>Page {page} of {data.pages}</span>
                <button type="button" className="btn btn-light btn-sm" disabled={page >= data.pages || busy} onClick={() => load(page + 1)}>Next →</button>
              </nav>
            )}
          </>
        )}
    </div>
  )
}

/* ── Saved workers ────────────────────────────────────────── */
export function ClientSavedWorkers({ call }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    call('/talent/saved').then(setData).catch(e => setError(e?.message || 'Could not load saved workers.'))
  }, [call])
  useEffect(() => { load() }, [load])

  async function unsave(w) {
    try {
      await call(`/talent/${w.id}/save`, { method: 'DELETE' })
      setData(d => ({ ...d, workers: d.workers.filter(x => x.id !== w.id) }))
    } catch (e) { setError(e?.message || 'Could not remove this worker.') }
  }

  return (
    <div className="page-inner tl">
      <Credits credits={data?.credits} />
      {error && <p className="tl-error" role="alert">{error}</p>}
      {!data ? <BrandLoader compact label="Loading saved workers…" />
        : data.workers.length === 0 ? (
          <div className="panel tl-empty">
            <IconBookmark size={36} />
            <h3>No saved workers yet</h3>
            <p>Tap the bookmark on any worker in Find Workers to keep them here, with your own notes.</p>
            <Link to="/dashboard/talent" className="btn btn-navy">Find workers <IconArrow size={14} /></Link>
          </div>
        ) : (
          <div className="tl-grid">
            {data.workers.map(w => (
              <div key={w.id} className="tl-saved">
                <WorkerCard w={w} onToggleSave={unsave} />
                {w.note && <p className="tl-note-card"><b>Your note:</b> {w.note}</p>}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

/* ── One worker ───────────────────────────────────────────── */
export function ClientTalentProfile({ call }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [jobId, setJobId] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  const load = useCallback(() => {
    setError('')
    call(`/talent/${id}`).then(r => {
      setData(r)
      const open = (r.jobs || []).find(j => !j.invited)
      setJobId(open ? String(open.id) : '')
    }).catch(e => setError(e?.message || 'Could not load this worker.'))
  }, [call, id])
  useEffect(() => { load() }, [load])

  const close = () => setDialog(null)
  const fail = (title, err) => setDialog({ tone: 'error', title, body: <p>{err?.message || 'Please try again.'}</p>, actions: [{ label: 'OK', primary: true, onClick: close }] })

  async function doUnlock() {
    setBusy(true)
    try {
      const r = await call(`/talent/${id}/unlock`, { method: 'POST' })
      setData(d => ({ ...d, credits: r.credits, worker: { ...d.worker, unlocked: true, contact: r.contact } }))
      setDialog(null)
    } catch (e) {
      if (e?.data?.code === 'no_credits') {
        setDialog({ tone: 'warn', title: 'No contact unlocks left', body: (
          <p>Your plan has no contact unlocks left. Upgrade to see this worker’s phone and email, or invite them to apply. Workers who send proposals for your gigs are always free to contact.</p>
        ), actions: [{ label: 'See plans', primary: true, onClick: () => { window.location.href = '/dashboard/subscription' } }, { label: 'Close', onClick: close }] })
      } else fail('Could not unlock', e)
    } finally { setBusy(false) }
  }

  function askUnlock() {
    const c = data.credits
    if (c.unlimited) { doUnlock(); return }
    setDialog({ tone: 'info', title: 'Unlock contact details?', body: (
      <p>This uses <b>1</b> of your <b>{c.left}</b> contact unlocks to show {data.worker.full_name}’s phone number and email. You only pay once per worker.</p>
    ), actions: [{ label: 'Unlock', primary: true, onClick: doUnlock }, { label: 'Cancel', onClick: close }] })
  }

  async function invite(e) {
    e.preventDefault()
    if (!jobId) return
    setBusy(true)
    try {
      await call(`/talent/${id}/invite`, { method: 'POST', body: { job_id: Number(jobId), message } })
      const title = data.jobs.find(j => String(j.id) === jobId)?.title
      setData(d => ({ ...d, jobs: d.jobs.map(j => String(j.id) === jobId ? { ...j, invited: true } : j) }))
      setMessage('')
      setDialog({ tone: 'success', title: 'Invitation sent', body: <p>{data.worker.full_name} was told about <b>{title}</b> in the app and by email. You will see them in Applicants when they apply.</p>,
        actions: [{ label: 'Done', primary: true, onClick: close }] })
    } catch (err) { fail('Invitation not sent', err) } finally { setBusy(false) }
  }

  async function toggleSave() {
    try {
      const saved = data.worker.saved
      await call(`/talent/${id}/save`, { method: saved ? 'DELETE' : 'POST', body: saved ? undefined : { note } })
      setData(d => ({ ...d, worker: { ...d.worker, saved: !saved } }))
      setNoteOpen(false)
    } catch (e) { fail('Could not save', e) }
  }

  if (error) return <div className="page-inner"><div className="panel tl-empty"><h3>{error}</h3><Link to="/dashboard/talent" className="btn btn-navy">Back to Find Workers</Link></div></div>
  if (!data) return <div className="page-inner"><BrandLoader label="Loading the worker’s passport…" /></div>

  const w = data.worker
  const a = w.availability
  const proven = w.skills.filter(s => s.verified)
  const listed = w.skills.filter(s => !s.verified)
  const openJobs = data.jobs.filter(j => !j.invited)

  return (
    <div className="page-inner tl tp">
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={close} busy={busy}>{dialog.body}</Dialog>}
      <Link to="/dashboard/talent" className="tp-back">← Find Workers</Link>

      <div className="tp-grid">
        <div className="tp-main">
          <section className="panel tp-head">
            <UserAvatar user={w} size={84} />
            <div className="tp-id">
              <h1>{w.full_name} {w.is_verified && <span className="chip green"><IconShield size={12} /> Verified</span>}</h1>
              <p className="tp-sub"><IconPin size={14} /> {w.location || 'Oriental Mindoro'}
                {w.member_since && <> · on hanapbuhay since {new Date(String(w.member_since).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</>}</p>
              <div className="tp-stats">
                <span>{w.rating?.count ? <><Stars value={w.rating.average} /> <b>{w.rating.average}</b> ({w.rating.count})</> : 'No ratings yet'}</span>
                <span><b>{w.hired_count}</b> hired through hanapbuhay</span>
                <span><b>{w.verified_count}</b> verified skill{w.verified_count === 1 ? '' : 's'}</span>
              </div>
              {a && (
                <p className="tl-avail" style={{ margin: '8px 0 0' }}>
                  <span className={`tl-dot${a.open_to_work ? ' on' : ''}`} /> {a.open_to_work ? 'Open to work' : 'Not looking right now'}
                  {a.work_types?.length > 0 && <> · {a.work_types.map(t => TYPE_LABEL[t] || t).join(', ')}</>}
                  {a.expected_rate ? <> · expects ₱{Number(a.expected_rate).toLocaleString('en-PH')}{UNIT[a.rate_unit] || ''}</> : null}
                  {a.preferred_towns?.length > 0 && <> · works in {a.preferred_towns.join(', ')}</>}
                </p>
              )}
            </div>
          </section>

          {w.bio && <section className="panel"><h2 className="tp-h">About</h2><p className="tp-text">{w.bio}</p></section>}

          <section className="panel">
            <h2 className="tp-h">Skills <span>{w.skills.length}</span></h2>
            {w.skills.length === 0 ? <p className="tp-muted">No skills listed yet.</p> : (
              <>
                {proven.length > 0 && <div className="tl-skills big">{proven.map(s => <span key={s.name} className="tl-skill v"><IconShield size={12} />{s.name}</span>)}</div>}
                {listed.length > 0 && <div className="tl-skills big">{listed.map(s => <span key={s.name} className="tl-skill">{s.name}</span>)}</div>}
                <p className="tp-muted" style={{ marginTop: 8 }}><IconShield size={12} /> = backed by a certificate hanapbuhay checked.</p>
              </>
            )}
          </section>

          {w.certificates.length > 0 && (
            <section className="panel">
              <h2 className="tp-h">Certificates <span>{w.certificates.length}</span></h2>
              <ul className="tp-list">
                {w.certificates.map((c, i) => (
                  <li key={i}>
                    <span className="tp-ic"><IconBook size={16} /></span>
                    <div><b>{c.title}</b><small>{[c.issuer, c.valid_until && `valid until ${c.valid_until}`].filter(Boolean).join(' · ')}</small></div>
                    <span className={`chip ${c.status === 'verified' ? 'green' : 'gold'}`}>{c.status === 'verified' ? 'Verified' : 'Being checked'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <WorkPhotos items={w.work} title="Work photos" note="Photos the worker took of their own work. hanapbuhay does not check them." />

          {(w.experience?.length > 0 || w.education?.length > 0) && (
            <section className="panel">
              <h2 className="tp-h">Experience & education</h2>
              <ul className="tp-list">
                {(w.experience || []).filter(e => e.position || e.employer).map((e, i) => (
                  <li key={`e${i}`}><span className="tp-ic"><IconBriefcase size={16} /></span>
                    <div><b>{e.position}{e.employer ? ` · ${e.employer}` : ''}</b><small>{[e.place, [e.start, e.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</small>{e.details && <p>{e.details}</p>}</div></li>
                ))}
                {(w.education || []).filter(e => e.school).map((e, i) => (
                  <li key={`d${i}`}><span className="tp-ic"><IconBook size={16} /></span>
                    <div><b>{e.school}</b><small>{[e.level, e.year].filter(Boolean).join(' · ')}</small></div></li>
                ))}
              </ul>
              {w.languages && <p className="tp-muted">Languages: {w.languages}</p>}
            </section>
          )}

          {w.reviews.length > 0 && (
            <section className="panel">
              <h2 className="tp-h">What employers and clients said <span>{w.reviews.length}</span></h2>
              <ul className="tp-reviews">
                {w.reviews.map((r, i) => (
                  <li key={i}><Stars value={r.rating} /> <b>{r.employer_name}</b>{r.comment && <p>“{r.comment}”</p>}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="tp-side">
          <section className="panel tp-box">
            <h3>Contact</h3>
            {w.contact ? (
              <>
                <ul className="tp-contact">
                  {w.contact.phone && <li><IconPhone size={15} /> <a href={`tel:${w.contact.phone}`}>{w.contact.phone}</a></li>}
                  {w.contact.email && <li><IconMail size={15} /> <a href={`mailto:${w.contact.email}`}>{w.contact.email}</a></li>}
                  {!w.contact.phone && !w.contact.email && <li className="tp-muted">No phone or email on file. Use Message instead.</li>}
                </ul>
                <p className="tp-muted">{w.applied ? 'Free: they sent a proposal for one of your gigs.' : 'Unlocked. It stays open for you.'}</p>
              </>
            ) : (
              <>
                <p className="tp-locked"><IconLock size={15} /> Phone and email are hidden</p>
                <button type="button" className="btn btn-primary tp-wide" onClick={askUnlock} disabled={busy || data.enabled === false}>
                  Unlock contact {data.credits.unlimited ? '' : `(1 of ${data.credits.left})`}
                </button>
                {!data.credits.unlimited && data.credits.left === 0 && <Link to="/dashboard/subscription" className="tp-link">Get more contact unlocks</Link>}
              </>
            )}
            <Link to={`/dashboard/client/messages?to=${w.id}`} className="btn btn-light tp-wide"><IconMsgCircle size={15} /> Message on hanapbuhay</Link>
          </section>

          <section className="panel tp-box">
            <h3>Invite to apply</h3>
            {data.jobs.length === 0 ? (
              <>
                <p className="tp-muted">You have no open gigs to invite them to.</p>
                <Link to="/dashboard/gigs/new" className="btn btn-light tp-wide">Post a gig</Link>
              </>
            ) : openJobs.length === 0 ? (
              <p className="tp-muted"><IconCheck size={13} /> Already invited to all your open posts.</p>
            ) : (
              <form onSubmit={invite} className="tp-invite">
                <select value={jobId} onChange={e => setJobId(e.target.value)} aria-label="Gig to invite them to">
                  {openJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
                <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={500} rows={3}
                  placeholder="A short note (optional), e.g. “We need a welder in Calapan for 3 months.”" />
                <button type="submit" className="btn btn-navy tp-wide" disabled={busy || !jobId || data.enabled === false}><IconSend size={14} /> Send invitation</button>
              </form>
            )}
            {data.jobs.some(j => j.invited) && <p className="tp-muted">Invited to: {data.jobs.filter(j => j.invited).map(j => j.title).join(', ')}</p>}
          </section>

          <section className="panel tp-box">
            <h3>Talent pool</h3>
            {w.saved ? (
              <>
                <p className="tp-muted"><IconBookmark size={13} /> Saved to your workers.</p>
                <button type="button" className="btn btn-light tp-wide" onClick={toggleSave}>Remove from saved</button>
              </>
            ) : noteOpen ? (
              <>
                <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Private note, e.g. “Good for the June project”" className="tp-note" />
                <button type="button" className="btn btn-navy tp-wide" onClick={toggleSave}><IconBookmark size={14} /> Save worker</button>
              </>
            ) : (
              <button type="button" className="btn btn-light tp-wide" onClick={() => setNoteOpen(true)} disabled={data.enabled === false}><IconBookmark size={14} /> Save worker</button>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
