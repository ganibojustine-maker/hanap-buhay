// Dashboard employer pages (split out of Dashboard.jsx so each role downloads only its own code).
import { useEffect, useRef, useState, useCallback } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { barangaysOf } from '../../data/barangays.js'
import { CATEGORIES, EDUCATION } from '../../utils/categories.js'
import { IconBriefcase, IconUsers, IconPin, IconMail, IconCheck, IconMsgCircle, IconPlus, IconTrend, IconX, IconClock, IconArrow, IconCalendar, IconBuilding, IconEdit, IconTrash, IconStar, IconPhone, IconAlert, IconEye } from '../../components/icons.jsx'
import { TOWNS } from '../../components/art.jsx'
import ImageCropModal from '../../components/ImageCropModal.jsx'
import { fmt, days, greet, ApplicationTracker } from './shared.jsx'
import { nextSteps } from '../../utils/hiringStatus.js'
import '../../styles/platform.css'
import ApplicantProfile from '../../components/ApplicantProfile.jsx'
import Dialog from '../../components/Dialog.jsx'
import { FeaturedJobCard, fmtSalary, paySuffix, neededBy } from '../../components/JobCard.jsx'
import { getJobImage } from '../../utils/jobImages.js'
import { useAuth } from '../../auth.jsx'
import '../../styles/overview.css'
import ReputationStrip from '../../components/ReputationStrip.jsx'
import BusinessVerification from '../../components/BusinessVerification.jsx'
import UserAvatar, { avatarDataUrl } from '../../components/Avatar.jsx'

// shown for applications the worker withdrew (not selectable by the employer)
const WITHDRAWN_STATUS = { id: 'withdrawn', label: 'Withdrawn by applicant', color: '#64748b', bg: '#f1f5f9', border: '#e2e8f0' }

/* ─ Employer Overview ─────────────────────────────────────
   An employer opens this to answer one question: who is waiting on me?
   It used to open with a banner, then repeat the entire My Job Posts table —
   the page right below it in the sidebar. Applicants come first now, the job
   posts are a short summary, and every number is a link.
*/
export function EmployerOverview({ user, call }) {
  const [stats, setStats] = useState({ jobs: 0, applicants: 0, hired: 0, views: 0, fresh: 0 })
  const [jobs, setJobs]   = useState([])
  const [apps, setApps]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [usage, setUsage]     = useState(null)
  const [talent, setTalent]   = useState(null)   // { workers, job }

  const isHirer = user.account_type === 'hirer'
  const words = isHirer
    ? { posts: 'service requests', post: 'service request', people: 'Worker quotes', newPost: 'Post a request' }
    : { posts: 'job posts', post: 'job post', people: 'Applicants', newPost: 'Post a job' }

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([
      call('/jobs/my').catch(() => ({ jobs: [] })),
      call('/applications/employer').catch(() => ({ applications: [] })),
    ]).then(([jobsRes, appsRes]) => {
      const arr = jobsRes.jobs || []
      const list = (appsRes.applications || []).filter(a => a.status !== 'withdrawn')
      setJobs(arr)
      setApps(list)
      setUsage(jobsRes.usage || null)
      // workers worth a look: ranked for the newest open post, or by profile strength
      const open = arr.find(j => j.status === 'active')
      call(`/talent?${open ? `for_job=${open.id}` : ''}`)
        .then(r => setTalent({ workers: (r.workers || []).slice(0, 4), job: r.job }))
        .catch(() => setTalent({ workers: [], job: null }))
      setStats({
        jobs: arr.filter(j => j.status === 'active').length,
        applicants: list.length,
        hired: list.filter(a => a.status === 'hired').length,
        views: arr.reduce((a, j) => a + (j.views || 0), 0),
        fresh: list.filter(a => a.status === 'pending').length,
      })
    }).catch(e => setError(e.message || 'Could not load your dashboard.'))
      .finally(() => setLoading(false))
  }, [call])

  /* Who is waiting on this employer, most time-critical first. */
  const todo = []
  if (stats.fresh) {
    todo.push({
      tone: 'go', icon: IconUsers,
      text: stats.fresh === 1 ? `1 new application nobody has opened yet.` : `${stats.fresh} new applications nobody has opened yet.`,
      to: '/dashboard/applicants', cta: 'Review',
    })
  }
  const soon = apps
    .filter(a => a.status === 'for_interview' && a.interview_date && new Date(String(a.interview_date).replace(' ', 'T')) > new Date())
    .sort((a, b) => String(a.interview_date).localeCompare(String(b.interview_date)))[0]
  if (soon) {
    todo.push({
      tone: 'ok', icon: IconCalendar,
      text: `Interview with ${soon.applicant_name || 'an applicant'} on ${new Date(String(soon.interview_date).replace(' ', 'T')).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`,
      to: '/dashboard/applicants', cta: 'Open',
    })
  }
  const unrated = apps.filter(a => a.status === 'hired' && !a.my_rating).length
  if (unrated) {
    todo.push({
      tone: 'ok', icon: IconStar,
      text: unrated === 1 ? 'You hired someone and have not rated them yet.' : `${unrated} workers you hired are still unrated.`,
      to: '/dashboard/reviews', cta: 'Rate',
    })
  }
  if (!loading && stats.jobs === 0) {
    todo.push({ tone: 'warn', icon: IconBriefcase, text: `You have no open ${words.posts}. Nobody can find you until you post one.`, to: '/dashboard/jobs/new', cta: words.newPost })
  }

  const first = user.full_name?.split(' ')[0] || 'there'
  const latest = apps.slice(0, 5)

  const STATS = [
    { icon: IconBriefcase, tone: 'navy', val: stats.jobs, label: `Open ${words.posts}`, sub: 'visible to jobseekers', to: '/dashboard/jobs' },
    { icon: IconUsers, tone: 'blue', val: stats.applicants, label: words.people, sub: `${stats.fresh} not yet reviewed`, to: '/dashboard/applicants' },
    { icon: IconCheck, tone: 'green', val: stats.hired, label: 'Hired', sub: 'through hanapbuhay', to: '/dashboard/applicants' },
    { icon: IconTrend, tone: 'gold', val: stats.views, label: 'Post views', sub: 'all time', to: '/dashboard/jobs' },
  ]

  return (
    <div className="page-inner ov">
      <section className="ov-hero">
        <div className="ov-hero-copy">
          <h1>{greet()}, {first}</h1>
          <p style={{ marginBottom: 0 }}>{stats.fresh > 0 ? `${stats.fresh} ${stats.fresh === 1 ? 'person is' : 'people are'} waiting to hear from you.` : 'Nobody is waiting on you right now.'}</p>
        </div>
      </section>

      <div className="ov-stats">
        {STATS.map(({ icon: Ic, tone, val, label, sub, to }) => (
          <Link key={label} to={to} className={`ov-stat ${tone}`}>
            <span className="ov-stat-ic"><Ic size={19} /></span>
            <b>{loading ? <i className="skel" /> : val}</b>
            <span className="ov-stat-l">{label}</span>
            <small>{sub}</small>
          </Link>
        ))}
      </div>

      <PlanUsage usage={usage} words={{ posts: words.posts }} />

      {error && <div className="panel" role="alert" style={{ marginBottom: 18, color: 'var(--red)' }}>{error}</div>}

      {todo.length > 0 && (
        <section className="panel ov-todo">
          <div className="panel-hd"><h2>Needs your attention</h2><span className="chip gold">{todo.length}</span></div>
          <ul>
            {todo.slice(0, 4).map((t, i) => {
              const Ic = t.icon
              return (
                <li key={i} className={t.tone}>
                  <span className="ov-todo-ic"><Ic size={15} /></span>
                  <p>{t.text}</p>
                  <Link to={t.to} className="btn btn-light btn-sm">{t.cta}</Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="ov-grid">
        <div className="ov-col">
          <section className="panel">
            <div className="panel-hd">
              <h2>Latest {words.people.toLowerCase()}</h2>
              <Link to="/dashboard/applicants" className="btn btn-light btn-sm">See all</Link>
            </div>
            {loading
              ? <BrandLoader compact label="Loading applications…" />
              : latest.length === 0
                ? <p className="ov-empty">No applications yet. They appear here the moment someone applies.</p>
                : <ul className="ov-apps">
                    {latest.map(a => (
                      <li key={a.id}>
                        <UserAvatar id={a.worker_id} name={a.applicant_name} picture={a.applicant_picture} size={34} />
                        <span>
                          <b>{a.applicant_name || 'Applicant'}</b>
                          <small>{[a.job_title, a.applicant_location, days(a.created_at)].filter(Boolean).join(' · ')}</small>
                        </span>
                        {a.match_score ? <span className="chip green" style={{ fontSize: 11 }}>{a.match_score}%</span> : null}
                        <span className={`app-status ${a.status}`}>{a.status.replace('_', ' ')}</span>
                      </li>
                    ))}
                  </ul>}
          </section>

          <section className="panel">
            <div className="panel-hd">
              <div>
                <h2>Workers for you</h2>
                <p className="ov-empty" style={{ fontSize: 12.5 }}>{talent?.job ? `Best match for “${talent.job.title}”` : 'Strong Skills Passports near you'}</p>
              </div>
              <Link to={talent?.job ? `/dashboard/talent?for_job=${talent.job.id}` : '/dashboard/talent'} className="btn btn-light btn-sm">Find workers</Link>
            </div>
            {!talent ? <BrandLoader compact label="Finding workers…" />
              : talent.workers.length === 0
                ? <p className="ov-empty">No workers to suggest yet. <Link to="/dashboard/talent">Search all workers</Link>.</p>
                : <ul className="ov-apps">
                    {talent.workers.map(w => (
                      <li key={w.id}>
                        <UserAvatar user={w} size={34} />
                        <span>
                          <Link to={`/dashboard/talent/${w.id}`} style={{ textDecoration: 'none' }}><b>{w.full_name}</b></Link>
                          <small>{[w.location, w.skills.slice(0, 2).map(x => x.name).join(', ')].filter(Boolean).join(' · ')}</small>
                        </span>
                        {w.match ? <span className="chip green" style={{ fontSize: 11 }}>{w.match.score}%</span>
                          : w.verified_count > 0 ? <span className="chip green" style={{ fontSize: 11 }}>{w.verified_count} verified</span> : null}
                      </li>
                    ))}
                  </ul>}
          </section>
        </div>

        <div className="ov-col">
          <section className="panel">
            <div className="panel-hd">
              <h2>My {words.posts}</h2>
              <Link to="/dashboard/jobs" className="btn btn-light btn-sm">Manage</Link>
            </div>
            {loading
              ? <BrandLoader compact label="Loading your jobs…" />
              : jobs.length === 0
                ? <p className="ov-empty">
                    No {words.posts} yet. <Link to="/dashboard/jobs/new">Post your first one</Link>.
                  </p>
                : <ul className="ov-posts">
                    {jobs.slice(0, 5).map(j => {
                      const n = j.applicants ?? apps.filter(a => Number(a.job_id) === Number(j.id)).length
                      return (
                        <li key={j.id}>
                          <Link to={`/dashboard/applicants/${j.id}`}>
                            <b>{j.title}</b>
                            <small>{[j.location, `${j.views || 0} views`].filter(Boolean).join(' · ')}</small>
                          </Link>
                          <span className={`status-badge ${j.status}`}>{j.status}</span>
                          <em>{n === 1 ? '1 applicant' : `${n} applicants`}</em>
                        </li>
                      )
                    })}
                  </ul>}
          </section>

        </div>
      </div>
    </div>
  )
}

/* ─ My Job Posts (Employer) ────────────────────────────── */
/* ─ Plan usage, shown wherever an employer spends from the plan ─ */
export function PlanUsage({ usage, words }) {
  if (!usage) return null
  const limited = usage.limit >= 0
  const pct = limited ? Math.min(100, Math.round((usage.active / Math.max(1, usage.limit)) * 100)) : 0
  const full = limited && usage.active >= usage.limit
  return (
    <section className={`eu${full ? ' full' : ''}`}>
      <div className="eu-plan">
        <small>Your plan</small>
        <b>{usage.plan}</b>
        <span>{usage.expires_at ? `Until ${new Date(String(usage.expires_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Free, no end date'}</span>
      </div>
      <div className="eu-meter">
        <small>Active {words.posts}</small>
        <b>{usage.active}{limited ? <> <i>of {usage.limit}</i></> : <> <i>· unlimited</i></>}</b>
        {limited && <span className="eu-bar"><em style={{ width: `${pct}%` }} /></span>}
      </div>
      <div className="eu-meter">
        <small>Featured left</small>
        <b>{usage.featured_left}</b>
        <span>{usage.feature_days} days each</span>
      </div>
      <div className="eu-meter">
        <small>Contact unlocks</small>
        <b>{usage.contact_unlimited ? 'Unlimited' : usage.contact_left}</b>
        <span>for Find Workers</span>
      </div>
      <Link to="/dashboard/subscription" className={`btn btn-sm ${full ? 'btn-primary' : 'btn-light'}`}>{full ? 'Get more room' : 'Plans'}</Link>
    </section>
  )
}

export function EmployerJobs({ call, user }) {
  const navigate = useNavigate()
  const isHirer = user?.account_type === 'hirer'
  const words = isHirer
    ? { posts: 'requests', post: 'request', newPost: 'Post a request', people: 'workers' }
    : { posts: 'job posts', post: 'job post', newPost: 'Post a job', people: 'applicants' }
  const [jobs, setJobs] = useState(null)
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')
  const [busyId, setBusyId] = useState(null)
  const [dialog, setDialog] = useState(null)
  const location = useLocation()
  const [flash, setFlash] = useState(location.state?.flash || '')

  const load = useCallback(() => {
    setError('')
    call('/jobs/my')
      .then(r => { setJobs(r.jobs || []); setUsage(r.usage || null) })
      .catch(e => { setError(e.message || 'Could not load your posts.'); setJobs([]) })
  }, [call])
  useEffect(() => { load() }, [load])

  const close = () => setDialog(null)
  const planError = (title, e) => setDialog({
    tone: e?.status === 402 ? 'warn' : 'error', title,
    body: <p>{e?.message || 'Please try again.'}</p>,
    actions: e?.status === 402
      ? [{ label: 'See plans', primary: true, onClick: () => navigate('/dashboard/subscription') }, { label: 'Close', onClick: close }]
      : [{ label: 'OK', primary: true, onClick: close }],
  })

  async function setStatus(j, status) {
    setBusyId(j.id)
    try {
      await call(`/jobs/${j.id}`, { method: 'PUT', body: { status } })
      load()
    } catch (e) { planError(status === 'active' ? 'Could not reopen' : 'Could not close', e) } finally { setBusyId(null) }
  }

  function askFeature(j) {
    setDialog({ tone: 'info', title: `Feature “${j.title}”?`, body: (
      <p>It shows first in job search and on workers’ home pages for <b>{usage?.feature_days || 30} days</b>. This uses 1 of your <b>{usage?.featured_left ?? 0}</b> featured credits.</p>
    ), actions: [{ label: 'Feature it', primary: true, onClick: async () => {
      setBusyId(j.id)
      try { await call(`/jobs/${j.id}/feature`, { method: 'POST' }); setDialog(null); load() }
      catch (e) { planError('Could not feature', e) } finally { setBusyId(null) }
    } }, { label: 'Cancel', onClick: close }] })
  }

  function askRenew(j) {
    setDialog({ tone: 'info', title: `Renew “${j.title}”?`, body: <p>Put it back up so workers can apply again. Choose how long it stays up.</p>,
      actions: [15, 30, 60, 90].map((d, i) => ({ label: `${d} days`, primary: i === 2, onClick: async () => {
        setBusyId(j.id)
        try { const r = await call(`/jobs/${j.id}/renew`, { method: 'POST', body: { days: d } }); setDialog(null); setFlash(r.message); load() }
        catch (e) { planError('Could not renew', e) } finally { setBusyId(null) }
      } })).concat([{ label: 'Cancel', onClick: close }]) })
  }

  function askDelete(j) {
    setDialog({ tone: 'danger', title: `Delete “${j.title}”?`, body: (
      <p>The post disappears from search and from your list. Its applicants stay in Applicants. If you may hire for it again, <b>Close</b> it instead.</p>
    ), actions: [{ label: 'Delete', primary: true, onClick: async () => {
      setBusyId(j.id)
      try { await call(`/jobs/${j.id}`, { method: 'DELETE' }); setDialog(null); load() }
      catch (e) { planError('Could not delete', e) } finally { setBusyId(null) }
    } }, { label: 'Cancel', onClick: close }] })
  }

  const all = jobs || []
  const waiting = j => j.moderation_status === 'pending' || j.moderation_status === 'rejected'
  const active = all.filter(j => j.status === 'active' || waiting(j))
  const closed = all.filter(j => j.status !== 'active' && !waiting(j))
  const ended = j => j.status !== 'active' && j.moderation_status === 'approved' && j.expires_at && new Date(String(j.expires_at).replace(' ', 'T')) < new Date()
  const list = tab === 'active' ? active : tab === 'closed' ? closed : all
  const until = j => j.featured_until && new Date(String(j.featured_until).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

  return (
    <div className="page-inner ej">
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={close} busy={busyId !== null}>{dialog.body}</Dialog>}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      <PlanUsage usage={usage} words={words} />
      {error && <p className="ej-error" role="alert">{error}</p>}

      {!jobs ? <BrandLoader compact label={`Loading your ${words.posts}…`} />
        : all.length === 0 ? (
          <div className="panel ej-empty">
            <IconBriefcase size={40} />
            <h2>No {words.posts} yet</h2>
            <p>Post your first {words.post}, or search the Skills Passports of workers near you.</p>
            <div className="ej-empty-actions">
              <Link to="/dashboard/jobs/new" className="btn btn-primary"><IconPlus size={15} /> {words.newPost}</Link>
              <Link to="/dashboard/talent" className="btn btn-light">Find workers</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mc-chips" role="group" aria-label={`Filter ${words.posts}`}>
              {[['active', 'Active', active.length], ['closed', 'Closed', closed.length], ['all', 'All', all.length]].map(([id, label, n]) => (
                <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label} <span>{n}</span></button>
              ))}
            </div>
            {list.length === 0 ? <div className="panel ej-empty"><p>No {words.posts} here.</p></div> : (
              <div className="ej-list">
                {list.map(j => (
                  <article key={j.id} className={`ej-card${j.status !== 'active' ? ' closed' : ''}`}>
                    <Link to={`/dashboard/jobs/${j.id}/edit`} className="ej-thumb" title={Number(j.image_v) > 0 ? 'Change photo' : 'Add your own photo'}>
                      <img src={getJobImage(j)} alt="" loading="lazy" />
                      {!(Number(j.image_v) > 0) && <span>Add photo</span>}
                    </Link>
                    <div className="ej-main">
                      <div className="ej-title">
                        <Link to={`/dashboard/applicants/${j.id}`}>{j.title}</Link>
                        {Number(j.is_featured) === 1 && <span className="chip gold">★ Featured{until(j) ? ` until ${until(j)}` : ''}</span>}
                        {Number(j.is_urgent) === 1 && <span className="chip red">Urgent</span>}
                        {j.moderation_status === 'pending' && <span className="chip gold">Waiting for review</span>}
                        {j.moderation_status === 'rejected' && <span className="chip red">Needs changes</span>}
                        {j.status !== 'active' && !waiting(j) && <span className="chip">{ended(j) ? 'Ended' : 'Closed'}</span>}
                      </div>
                      {j.moderation_status === 'pending' && <p className="pf-small" style={{ margin: '4px 0 0' }}>Our team checks posts from unverified accounts, usually within one working day. <Link to="/dashboard/verification">Verify your business</Link> to post instantly.</p>}
                      {j.moderation_status === 'rejected' && <p className="pf-small" style={{ margin: '4px 0 0', color: 'var(--red)' }}>Reason: {j.moderation_note || 'See your notifications.'} Edit the post to fix it and it will be checked again.</p>}
                      {j.status === 'active' && j.expires_at && <p className="pf-small" style={{ margin: '4px 0 0' }}>Open until {new Date(String(j.expires_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                      <p className="ej-meta">{[j.company, j.location, String(j.job_type || '').replace('-', ' '),
                        (j.salary_min || j.salary_max) ? `${fmtSalary(j.salary_min, j.salary_max)} ${paySuffix(j)}` : null, neededBy(j)].filter(Boolean).join(' · ')}</p>
                      <div className="ej-stats">
                        <Link to={`/dashboard/applicants/${j.id}`}><b>{j.applicants}</b> {words.people}</Link>
                        {j.new_applicants > 0 && <span className="ej-new">{j.new_applicants} new</span>}
                        <span><b>{j.hired}</b> hired</span>
                        <span><b>{j.views}</b> views</span>
                        <span>Posted {days(j.created_at)}</span>
                      </div>
                    </div>
                    <div className="ej-actions">
                      <Link to={`/dashboard/applicants/${j.id}`} className="btn btn-navy btn-sm"><IconUsers size={14} /> {words.people[0].toUpperCase() + words.people.slice(1)}</Link>
                      {j.status === 'active' && <Link to={`/dashboard/talent?for_job=${j.id}`} className="btn btn-light btn-sm">Find workers for it</Link>}
                      <div className="ej-more">
                        <Link to={`/dashboard/jobs/${j.id}/edit`} className="ej-act"><IconEdit size={13} /> Edit</Link>
                        {j.status === 'active' && Number(j.is_featured) !== 1 && (
                          <button type="button" className="ej-act" disabled={busyId === j.id || !usage?.featured_left} onClick={() => askFeature(j)}
                            title={usage?.featured_left ? 'Show it first for 30 days' : 'No featured credits left on your plan'}>★ Feature</button>
                        )}
                        {j.status === 'active'
                          ? <button type="button" className="ej-act" disabled={busyId === j.id} onClick={() => setStatus(j, 'closed')}>Close</button>
                          : ended(j) ? <button type="button" className="ej-act" disabled={busyId === j.id} onClick={() => askRenew(j)}>Renew</button>
                          : !waiting(j) && <button type="button" className="ej-act" disabled={busyId === j.id} onClick={() => setStatus(j, 'active')}>Reopen</button>}
                        <Link to={`/dashboard/jobs/new?from=${j.id}`} className="ej-act">Duplicate</Link>
                        <Link to={`/dashboard/browse/${j.id}`} className="ej-act"><IconEye size={13} /> As workers see it</Link>
                        <button type="button" className="ej-act danger" disabled={busyId === j.id} onClick={() => askDelete(j)}><IconTrash size={13} /> Delete</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  )
}

/* ─ Post / Edit Job ─────────────────────────────────────── */
/* ─ Post / Edit Job ─────────────────────────────────────────
   Two different forms, because they are two different things:
     employer (company, long-term) — a vacancy: openings, monthly or daily pay, schedule,
                                     experience, benefits (SSS, PhilHealth, 13th month…)
     client   (hirer, short-term)  — a gig: what needs doing, when, how long, a fixed or
                                     daily budget, urgent or not
   Both can add a photo, and the right side shows the card exactly as workers will see it.
*/
const POST_TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const BENEFITS = ['SSS', 'PhilHealth', 'Pag-IBIG', '13th month pay', 'Free meals', 'Free accommodation',
  'Transportation allowance', 'Overtime pay', 'Paid leave', 'Health card (HMO)', 'Performance bonus', 'Uniform provided']
const DURATIONS = ['A few hours', '1 day', '2–3 days', '1 week', '2–4 weeks', '1–3 months', 'Ongoing']

/** Shrink a photo to JPEG (max 1600px) before upload: small, and still sharp on a phone. */
async function shrinkPhoto(file, maxSide = 1600) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This image could not be opened. Try a JPG or PNG photo.')); i.src = url })
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84))
    if (!blob) throw new Error('This image could not be processed.')
    return new File([blob], 'job-photo.jpg', { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}

export function PostJob({ call, editId = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isGig = user?.account_type === 'hirer'
  const [params] = useSearchParams()
  const fromId = !editId ? params.get('from') : null
  const [usage, setUsage] = useState(null)
  useEffect(() => { call('/jobs/my').then(r => setUsage(r.usage || null)).catch(() => {}) }, [call])

  const blank = {
    title: '', company: '', job_type: isGig ? 'gig' : 'full-time', location: user?.location || '', address: '',
    salary_min: '', salary_max: '', pay_basis: isGig ? 'fixed' : 'month',
    description: '', requirements: '', skills_needed: '', is_featured: false,
    openings: isGig ? '' : '1', schedule: '', experience: '', benefits: [],
    needed_by: '', is_urgent: false, duration: '',
    category: '', education_level: '', barangay: '', expires_in_days: 60,
  }
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)
  const [loaded, setLoaded] = useState(!editId && !fromId)
  const [photo, setPhoto] = useState(null)        // { file, url } — a new photo picked here
  const [oldPhoto, setOldPhoto] = useState(null)  // the post's current photo (when editing)
  const [dropPhoto, setDropPhoto] = useState(false)
  const photoInput = useRef(null)

  useEffect(() => {
    const source = editId || fromId
    if (!source) return
    call(`/jobs/${source}`).then(r => {
      const j = r.job || {}
      setForm({
        ...blank,
        title: j.title || '', company: j.company || '', job_type: j.job_type || blank.job_type,
        location: j.location || '', address: j.address || '',
        salary_min: j.salary_min ?? '', salary_max: j.salary_max ?? '', pay_basis: j.pay_basis || blank.pay_basis,
        description: j.description || '', requirements: j.requirements || '', skills_needed: j.skills_needed || '',
        openings: j.openings ?? '', schedule: j.schedule || '', experience: j.experience || '',
        benefits: String(j.benefits || '').split(',').map(x => x.trim()).filter(Boolean),
        needed_by: fromId ? '' : (j.needed_by || ''), is_urgent: Number(j.is_urgent) === 1, duration: j.duration || '',
        category: j.category || '', education_level: j.education_level || '', barangay: j.barangay || '', expires_in_days: editId ? '' : 60,
      })
      if (editId && Number(j.image_v) > 0) setOldPhoto(getJobImage(j))
      setLoaded(true)
    }).catch(e => { setErr(e.message); setLoaded(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, fromId, call])
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url) }, [photo])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'location' ? { barangay: '' } : {}) }))
  const toggleBenefit = b => setForm(f => ({ ...f, benefits: f.benefits.includes(b) ? f.benefits.filter(x => x !== b) : [...f.benefits, b] }))

  async function pickPhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setErr('Only photos (JPG, PNG, WEBP) can be added. Videos and documents are not accepted.'); return }
    try {
      const small = await shrinkPhoto(file)
      if (small.size > 3 * 1024 * 1024) { setErr('That photo is too large even after resizing. Try another one.'); return }
      setPhoto({ file: small, url: URL.createObjectURL(small) }); setDropPhoto(false); setErr(null)
    } catch (e2) { setErr(e2.message) }
  }

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    if (!form.location) { setErr('Choose the town where the work is.'); return }
    setSaving(true)
    try {
      const body = {
        ...form,
        salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
        openings: form.openings !== '' ? Number(form.openings) : null,
      }
      if (editId) delete body.is_featured
      if (!body.expires_in_days) delete body.expires_in_days
      const res = editId
        ? await call(`/jobs/${editId}`, { method: 'PUT', body })
        : await call('/jobs', { method: 'POST', body })
      const jobId = editId || res?.job?.id
      // the photo goes up after the post exists; a failed photo never loses the post
      if (jobId && photo?.file) {
        const fd = new FormData(); fd.append('image', photo.file)
        try { await call(`/jobs/${jobId}/image`, { method: 'POST', body: fd }) } catch { /* the post is saved; the photo can be added again */ }
      } else if (jobId && dropPhoto) {
        try { await call(`/jobs/${jobId}/image`, { method: 'DELETE' }) } catch { /* ignore */ }
      }
      navigate('/dashboard/jobs', { state: { flash: editId ? 'Your changes are saved.' : (res?.message || 'Your job post is saved.') } })
    } catch (e2) {
      setErr(e2.status === 402 ? <>{e2.message} <Link to="/dashboard/plans" style={{ fontWeight: 700 }}>See plans →</Link></> : (e2.message || 'We couldn’t save the post. Please try again.'))
    }
    setSaving(false)
  }

  if (!loaded) return <div className="page-inner"><BrandLoader compact label="Loading…" /></div>

  const shownPhoto = photo?.url || (!dropPhoto ? oldPhoto : null)
  // the card workers will see, from what is typed so far
  const preview = {
    id: Number(editId) || 0, title: form.title || (isGig ? 'What you need done' : 'Job title'),
    company: form.company || user?.company || user?.full_name || 'Your business', employer_picture: user?.picture || null,
    location: form.location ? `${form.location}, Oriental Mindoro` : 'Oriental Mindoro', job_type: form.job_type,
    salary_min: form.salary_min || null, salary_max: form.salary_max || null, pay_basis: form.pay_basis,
    is_featured: form.is_featured ? 1 : 0, is_urgent: form.is_urgent ? 1 : 0, needed_by: form.needed_by || null,
    duration: form.duration || null, openings: form.openings || null, created_at: new Date().toISOString(), applicants: 0,
    employer_verified: user?.is_verified ? 1 : 0,
  }
  const words = isGig
    ? { head: editId ? 'Edit request' : fromId ? 'Post a copy' : 'Post a request', title: 'What do you need done? *', titlePh: 'e.g. Fix a leaking roof, Paint a 2-bedroom house, Cater for 50 guests', desc: 'Describe the work *', descPh: 'What needs doing, how big the job is, and anything the worker should bring.', submit: editId ? 'Save changes' : 'Post request' }
    : { head: editId ? 'Edit job post' : fromId ? 'Post a copy' : 'Post a job', title: 'Job title *', titlePh: 'e.g. Electrician, Cashier, Hotel front desk officer', desc: 'Job description *', descPh: 'What the person will do day to day, who they report to, and what makes the job good.', submit: editId ? 'Save changes' : 'Post job' }

  return (
    <div className="page-inner pj">
      <div className="pj-hd">
        <div>
          <h1>{words.head}</h1>
          <p>{fromId ? 'Filled in from your earlier post. Change anything, then post it as new.'
            : isGig ? 'A short job or service, done by a worker near you. Workers who can do it reply to you.'
            : 'A vacancy at your business. Workers see it in search, on their home page, and in their matches.'}</p>
        </div>
        <button type="button" className="btn btn-light" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {!editId && usage && usage.limit >= 0 && usage.active >= usage.limit && (
        <div className="ej-warn" role="status">
          <b>Your plan is full: {usage.active} of {usage.limit} active posts.</b> Close a post, or upgrade, before posting this one.
          <Link to="/dashboard/subscription" className="btn btn-primary btn-sm">See plans</Link>
        </div>
      )}
      {err && <div className="pj-err" role="alert">{err}</div>}

      <div className="pj-grid">
        <form onSubmit={submit} className="pj-form">
          {/* 1 — the basics */}
          <section className="panel pj-sec">
            <h2>{isGig ? 'The job' : 'The position'}</h2>
            <label className="field"><span>{words.title}</span>
              <div className="in no-icon"><input required minLength={3} maxLength={255} value={form.title} onChange={e => set('title', e.target.value)} placeholder={words.titlePh} /></div>
            </label>
            <div className="pj-2">
              <label className="field"><span>{isGig ? 'Your name or business' : 'Company / business name'}</span>
                <div className="in no-icon"><input maxLength={255} value={form.company} onChange={e => set('company', e.target.value)} placeholder={isGig ? 'Shown to workers' : 'e.g. Calapan Construction Corp'} /></div>
              </label>
              <label className="field"><span>Type of work *</span>
                <div className="in no-icon">
                  <select value={form.job_type} onChange={e => set('job_type', e.target.value)}>
                    {(isGig ? [['gig', 'Gig / one-time job'], ['freelance', 'Freelance / project'], ['part-time', 'Part-time']]
                            : [['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contractual', 'Contractual / project-based']]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </label>
              <label className="field"><span>Town *</span>
                <div className="in no-icon">
                  <select required value={form.location} onChange={e => set('location', e.target.value)}>
                    <option value="">Choose the town</option>
                    {POST_TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </label>
              <label className="field"><span>Barangay</span>
                <div className="in no-icon">
                  <select value={form.barangay} disabled={!form.location} onChange={e => set('barangay', e.target.value)}>
                    <option value="">{form.location ? 'Choose the barangay' : 'Choose the town first'}</option>
                    {barangaysOf(form.location).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </label>
              <label className="field"><span>Street or landmark <em>only shown to signed-in workers</em></span>
                <div className="in no-icon"><input maxLength={255} value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. near the public market" /></div>
              </label>
              <label className="field"><span>Kind of work *</span>
                <div className="in no-icon">
                  <select required value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">Choose one</option>
                    {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </label>
              {!isGig && (
                <label className="field"><span>Minimum education</span>
                  <div className="in no-icon">
                    <select value={form.education_level} onChange={e => set('education_level', e.target.value)}>
                      <option value="">Not required</option>
                      {Object.entries(EDUCATION).filter(([k]) => k !== 'none').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </label>
              )}
              {!editId && (
                <label className="field"><span>Keep the post up for</span>
                  <div className="in no-icon">
                    <select value={form.expires_in_days} onChange={e => set('expires_in_days', Number(e.target.value))}>
                      {[15, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
                    </select>
                  </div>
                </label>
              )}
              {!isGig && (
                <label className="field"><span>Openings</span>
                  <div className="in no-icon"><input type="number" min={1} max={999} value={form.openings} onChange={e => set('openings', e.target.value)} placeholder="How many people" /></div>
                </label>
              )}
            </div>
          </section>

          {/* 2 — when (gig) / schedule (job), and pay */}
          {isGig ? (
            <section className="panel pj-sec">
              <h2>When and how long</h2>
              <div className="pj-2">
                <label className="field"><span>Needed by</span>
                  <div className="in no-icon"><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.needed_by} onChange={e => set('needed_by', e.target.value)} /></div>
                </label>
                <label className="field"><span>How long it takes</span>
                  <div className="in no-icon">
                    <select value={form.duration} onChange={e => set('duration', e.target.value)}>
                      <option value="">Not sure</option>
                      {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </label>
              </div>
              <label className="pj-check">
                <input type="checkbox" checked={form.is_urgent} onChange={e => set('is_urgent', e.target.checked)} />
                <span><b>Urgent — I need someone as soon as possible</b><small>Shows a red “Urgent” tag so nearby workers see it first.</small></span>
              </label>
            </section>
          ) : (
            <section className="panel pj-sec">
              <h2>Schedule and experience</h2>
              <div className="pj-2">
                <label className="field"><span>Work schedule <em>optional</em></span>
                  <div className="in no-icon"><input maxLength={120} value={form.schedule} onChange={e => set('schedule', e.target.value)} placeholder="e.g. Mon–Sat, 8 AM – 5 PM" /></div>
                </label>
                <label className="field"><span>Experience needed</span>
                  <div className="in no-icon">
                    <select value={form.experience} onChange={e => set('experience', e.target.value)}>
                      <option value="">Not specified</option>
                      <option value="none">No experience needed</option>
                      <option value="1">At least 1 year</option>
                      <option value="2-3">2–3 years</option>
                      <option value="4+">4 years or more</option>
                    </select>
                  </div>
                </label>
              </div>
            </section>
          )}

          <section className="panel pj-sec">
            <h2>{isGig ? 'Budget' : 'Pay'}</h2>
            <div className="pj-3">
              <label className="field"><span>{isGig ? 'Budget is' : 'Pay is counted'}</span>
                <div className="in no-icon">
                  <select value={form.pay_basis} onChange={e => set('pay_basis', e.target.value)}>
                    {(isGig ? [['fixed', 'Fixed, for the whole job'], ['day', 'Per day'], ['hour', 'Per hour']]
                            : [['month', 'Per month'], ['day', 'Per day (arawan)'], ['hour', 'Per hour']]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </label>
              <label className="field"><span>{isGig ? 'From (₱)' : 'Minimum (₱)'}</span>
                <div className="in no-icon"><input type="number" min={0} value={form.salary_min} onChange={e => set('salary_min', e.target.value)} placeholder={isGig ? 'e.g. 1500' : 'e.g. 15000'} /></div>
              </label>
              <label className="field"><span>{isGig ? 'Up to (₱) ' : 'Maximum (₱) '}<em>optional</em></span>
                <div className="in no-icon"><input type="number" min={0} value={form.salary_max} onChange={e => set('salary_max', e.target.value)} placeholder={isGig ? 'e.g. 2500' : 'e.g. 20000'} /></div>
              </label>
            </div>
            <p className="pj-hint">Posts that show the pay get more replies. Leave it empty and workers see “Salary negotiable”.</p>
            {!isGig && (
              <>
                <h3 className="pj-sub">Benefits <em>tick what you give</em></h3>
                <div className="pj-chips">
                  {BENEFITS.map(b => (
                    <button key={b} type="button" aria-pressed={form.benefits.includes(b)} onClick={() => toggleBenefit(b)}>
                      {form.benefits.includes(b) && <IconCheck size={12} />}{b}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* 3 — the details */}
          <section className="panel pj-sec">
            <h2>Details</h2>
            <label className="field"><span>{words.desc}</span>
              <div className="in no-icon"><textarea required rows={6} maxLength={10000} value={form.description} onChange={e => set('description', e.target.value)} placeholder={words.descPh} /></div>
            </label>
            <label className="field"><span>{isGig ? 'What the worker needs' : 'Requirements'} <em>one per line, optional</em></span>
              <div className="in no-icon"><textarea rows={4} maxLength={5000} value={form.requirements} onChange={e => set('requirements', e.target.value)}
                placeholder={isGig ? 'e.g. Brings own tools\nCan start on a weekend' : 'e.g. At least 18 years old\nTESDA NC II is an advantage'} /></div>
            </label>
            <label className="field"><span>Skills needed <em>comma-separated — used for matching</em></span>
              <div className="in no-icon"><input maxLength={2000} value={form.skills_needed} onChange={e => set('skills_needed', e.target.value)} placeholder="e.g. Electrical wiring, Safety, Customer service" /></div>
            </label>
          </section>

          {/* 4 — photo */}
          <section className="panel pj-sec">
            <h2>Photo <em>optional</em></h2>
            <p className="pj-hint">{isGig ? 'A photo of what needs doing (the roof, the room, the item) helps workers quote the right price.'
              : 'Your shop, office or worksite. Posts with a real photo look more trustworthy than stock pictures.'}</p>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={pickPhoto} />
            {shownPhoto ? (
              <div className="pj-photo">
                <img src={shownPhoto} alt="" />
                <div>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => photoInput.current?.click()}>Change photo</button>
                  <button type="button" className="btn btn-light btn-sm" style={{ color: 'var(--red)' }} onClick={() => { setPhoto(null); setDropPhoto(true) }}>Remove</button>
                </div>
              </div>
            ) : (
              <button type="button" className="pj-drop" onClick={() => photoInput.current?.click()}><IconPlus size={16} /> Add a photo <small>JPG, PNG or WEBP</small></button>
            )}
          </section>

          {!editId && (
            <label className="pj-check panel">
              <input type="checkbox" checked={!!form.is_featured} disabled={usage && !usage.featured_left} onChange={e => set('is_featured', e.target.checked)} />
              <span><b>Feature this post for {usage?.feature_days || 30} days</b>
                <small>{usage ? (usage.featured_left > 0 ? `Shows first in search and on workers’ home pages. Uses 1 of your ${usage.featured_left} featured credits.` : <>No featured credits left. <Link to="/dashboard/subscription">See plans</Link></>) : 'Uses 1 featured credit from your plan.'}</small></span>
            </label>
          )}

          <div className="pj-actions">
            <button type="button" className="btn btn-light" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spin" /> Saving…</> : <><IconPlus size={14} /> {words.submit}</>}</button>
          </div>
        </form>

        <aside className="pj-preview">
          <p className="pj-preview-h"><IconEye size={14} /> What workers will see</p>
          <FeaturedJobCard job={preview} coverUrl={shownPhoto || undefined} compact detailsTo="#" />
          <ul className="pj-tips">
            <li><IconCheck size={13} /> A clear title gets {isGig ? 'faster replies' : 'more applicants'}.</li>
            <li><IconCheck size={13} /> Showing the pay brings more replies.</li>
            <li><IconCheck size={13} /> Skills you list decide who sees it in their matches.</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}

/* wrapper so react-router can supply the :id param */
export function PostJobEdit({ call }) {
  const { id } = useParams()
  return <PostJob call={call} editId={id || null} />
}

/* ─ Employer / Business Profile page ─────────────────────── */
export function EmployerProfile({ user, call, updateUser }) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone:     user?.phone || '',
    location:  user?.location || '',
    bio:       user?.bio || '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoMsg, setLogoMsg] = useState({ type: '', text: '' })
  const [previewLogo, setPreviewLogo] = useState(null)
  const [cropModalSrc, setCropModalSrc] = useState(null)

  // no logo uploaded yet: the generated company mark, not a stock photo of a stranger
  const currentLogo = previewLogo || user?.picture || (user?.id ? localStorage.getItem(`hb_avatar_${user.id}`) : null) || avatarDataUrl(user || {})

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone:     user.phone || '',
        location:  user.location || '',
        bio:       user.bio || '',
      })
    }
  }, [user?.full_name, user?.phone, user?.location, user?.bio])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: form })
      if (res?.user && updateUser) updateUser(res.user)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err?.message || 'Failed to save business profile.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Logo File Selection -> Opens Crop Modal
  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setLogoMsg({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WEBP).' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'Logo image must be under 8MB.' })
      return
    }
    setLogoMsg({ type: '', text: '' })

    const reader = new FileReader()
    reader.onload = (evt) => {
      setCropModalSrc(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Handle Cropped Logo Save
  async function handleCroppedLogo(croppedBlob, croppedDataUrl) {
    setUploadingLogo(true)
    setPreviewLogo(croppedDataUrl)
    setLogoMsg({ type: '', text: '' })

    try {
      const fd = new FormData()
      fd.append('avatar', croppedBlob, 'logo.jpg')
      const res = await call('/auth/avatar', { method: 'POST', body: fd })
      if (res?.picture && updateUser) {
        updateUser({ ...user, picture: res.picture })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, res.picture)
      } else if (res?.user && updateUser) {
        updateUser(res.user)
      }
      setCropModalSrc(null)
      setLogoMsg({ type: 'success', text: 'Company logo updated!' })
      setTimeout(() => setLogoMsg({ type: '', text: '' }), 4000)
    } catch (err) {
      try {
        const fb = await call('/auth/me', { method: 'PATCH', body: { picture: croppedDataUrl } })
        if (fb?.user && updateUser) updateUser(fb.user)
        else if (updateUser) updateUser({ ...user, picture: croppedDataUrl })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, croppedDataUrl)
        setCropModalSrc(null)
        setLogoMsg({ type: 'success', text: 'Company logo updated!' })
        setTimeout(() => setLogoMsg({ type: '', text: '' }), 4000)
      } catch {
        setLogoMsg({ type: 'error', text: 'Failed to upload company logo.' })
        setPreviewLogo(null)
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="page-inner">
      {/* what workers see about this business: their ratings, followers and hires */}
      <ReputationStrip call={call} user={user} />

      {/* the Verified business badge: upload a permit, an admin checks it */}
      <BusinessVerification call={call} user={user} updateUser={updateUser} />


      <div className="wp-grid">
        <form onSubmit={save} className="panel">
          <h2 style={{ marginBottom: 20, fontSize: 18, color: 'var(--navy-d)' }}>Company Information</h2>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', marginBottom: 16, fontSize: 13, border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div className="field">
            <span>Company / Business Name</span>
            <div className="in">
              <IconBuilding size={17} />
              <input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Mindoro Agro-Ventures Corp."
                required
              />
            </div>
          </div>

          <div className="field">
            <span>Hiring Contact Email</span>
            <div className="in">
              <IconMail size={17} />
              <input type="email" value={user.email} disabled style={{ opacity: .6 }} />
            </div>
          </div>

          <div className="field">
            <span>Hiring Contact Phone</span>
            <div className="in">
              <IconPin size={17} />
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div className="field">
            <span>Headquarters / Business Municipality</span>
            <div className="in">
              <IconPin size={17} />
              <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                <option value="">Select Municipality in Oriental Mindoro</option>
                {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <span>About the Company / Business Description</span>
            <div className="in no-icon">
              <textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Describe your company, products/services offered, work environment, and what makes your business great to work for…"
                style={{ minHeight: 120 }}
              />
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${saved ? 'is-done' : ''}`} disabled={saving}>
            {saving ? <span className="spin" /> : saved ? <><IconCheck size={16} /> Business Profile Saved</> : 'Save Business Profile'}
          </button>
        </form>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Logo panel */}
          <div className="panel" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />

            <div style={{ position: 'relative', width: 114, height: 114, margin: '0 auto 16px' }}>
              <div
                onClick={() => !uploadingLogo && fileInputRef.current?.click()}
                title="Click to upload company logo"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '3.5px solid var(--gold)',
                  boxShadow: '0 8px 20px rgba(10,37,87,0.15)',
                  cursor: uploadingLogo ? 'wait' : 'pointer',
                  position: 'relative',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={currentLogo}
                  alt={user?.full_name || 'Company Logo'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.src = avatarDataUrl(user || {}) }}
                />
                {uploadingLogo && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,37,87,.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    <span className="spin" style={{ width: 22, height: 22, marginBottom: 4 }} />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </div>

            {logoMsg.text && (
              <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12, background: logoMsg.type === 'error' ? '#fee2e2' : '#dcfce7', color: logoMsg.type === 'error' ? '#b91c1c' : '#15803d' }}>
                {logoMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconBuilding size={14} /> Upload Company Logo
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.4 }}>
              JPG or PNG up to 5MB.<br/>Recommended square ratio for display on job postings.
            </p>

            <h3 style={{ fontSize: 17, marginBottom: 2, color: 'var(--navy-d)' }}>{user.full_name || 'Company'}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IconBuilding size={14} /> Employer · {user.location || 'Oriental Mindoro'}
            </p>
            <span className="chip green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={12} /> Registered Employer</span>
          </div>

          {/* Quick links card */}
          <div className="panel">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>Employer Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/dashboard/jobs/new" className="btn btn-primary btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconPlus size={14} /> Post a New Vacancy
              </Link>
              <Link to="/dashboard/jobs" className="btn btn-light btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconBriefcase size={14} /> Manage Active Postings
              </Link>
              <Link to="/dashboard/applicants" className="btn btn-light btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconUsers size={14} /> Review Job Applicants
              </Link>
            </div>
          </div>
        </div>
      </div>

      {cropModalSrc && (
        <ImageCropModal
          imageSrc={cropModalSrc}
          title="Crop & Adjust Company Logo"
          cropShape="round-rect"
          saving={uploadingLogo}
          onCrop={handleCroppedLogo}
          onCancel={() => setCropModalSrc(null)}
        />
      )}
    </div>
  )
}

/* ─ Employer Applicants Management ──────────────────────── */
// The hiring pipeline (utils/hiringStatus.js, backend libraries/Hiring_status.php).
// Opening an application moves it from Submitted to Under Review by itself.
export const STATUS_OPTIONS = [
  { id: 'pending', label: 'Submitted', desc: 'New application. Opening it marks it Under Review.', color: '#b45309', bg: '#fef3c7', border: '#fde68a', chipClass: 'gold', icon: IconClock },
  { id: 'reviewed', label: 'Under Review', desc: 'You are looking at this application.', color: '#334155', bg: '#f1f5f9', border: '#e2e8f0', chipClass: 'navy', icon: IconEye },
  { id: 'shortlisted', label: 'Shortlisted', desc: 'Meets your needs. You may invite them to an interview.', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe', chipClass: 'navy', icon: IconStar },
  { id: 'for_interview', label: 'Interview Scheduled', desc: 'Invite them to an interview (or move the date). They get a reminder the day before.', color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe', chipClass: '', icon: IconCalendar },
  { id: 'interviewed', label: 'Interviewed', desc: 'The interview is done. Decide the next step.', color: '#0e7490', bg: '#cffafe', border: '#a5f3fc', chipClass: 'blue', icon: IconCheck },
  { id: 'offer', label: 'Job Offer', desc: 'Offer the job with pay and a start date. The applicant accepts or declines in the app.', color: '#a16207', bg: '#fef9c3', border: '#fde68a', chipClass: 'gold', icon: IconStar },
  { id: 'hired', label: 'Hired', desc: 'They agreed to the job. This closes the application as hired.', color: '#047857', bg: '#d1fae5', border: '#a7f3d0', chipClass: 'green', icon: IconCheck },
  { id: 'rejected', label: 'Not Selected', desc: 'Not selected this time. You can add short, kind feedback.', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', chipClass: '', icon: IconX },
]

/**
 * RateWorker — the employer's half of the two-way rating.
 *
 * Only appears once an applicant is hired, because a rating without a real hire behind
 * it is worth nothing. It posts to /reviews/worker, which refuses anything that is not a
 * hired application on one of this employer's own jobs. The worker rates back from their
 * own Ratings & Reviews page, and both averages show on the public profiles.
 */
function RateWorker({ app, call, onSaved }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(Number(app.my_rating) || 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(app.my_review || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(Boolean(app.my_rating))

  const submit = async e => {
    e.preventDefault()
    if (!rating) { setMsg('Choose from 1 to 5 stars.'); return }
    setBusy(true); setMsg('')
    try {
      await call('/reviews/worker', { method: 'POST', body: { application_id: app.id, rating, comment: comment.trim() || null } })
      setSaved(true); setOpen(false); onSaved?.()
    } catch (err) {
      setMsg(err?.message || 'Could not save the rating.')
    } finally { setBusy(false) }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-light btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
        onClick={() => setOpen(true)} title="Rate how the work went">
        <IconStar size={13} /> {saved ? 'Edit rating' : 'Rate worker'}
      </button>
    )
  }

  return (
    <form className="rw-box" onSubmit={submit}>
      <b>How did {app.applicant_name || 'this worker'} do?</b>
      <div className="rv-stars" role="radiogroup" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={String(n)}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
            className={(hover || rating) >= n ? 'on' : ''}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
        <span>{['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][hover || rating] || ''}</span>
      </div>
      <textarea rows={2} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)}
        placeholder="Were they on time, careful, easy to work with? Other employers read this." />
      {msg && <p className="rw-msg">{msg}</p>}
      <div className="rw-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? <span className="spin" /> : 'Save rating'}</button>
        <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <small>Public on their profile.</small>
      </div>
    </form>
  )
}

export function EmployerApplicants({ call }) {
  const { jobId } = useParams()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackOk, setFeedbackOk] = useState(true)
  const [statusModal, setStatusModal] = useState(null)
  const [profileId, setProfileId] = useState(null) // application whose full profile is open

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = jobId ? `/applications/job/${jobId}` : `/applications/employer`
      const res = await call(endpoint)
      setApps(res?.applications || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [call, jobId])

  useEffect(() => { load() }, [load])

  const handleUpdate = async (id, status, applicantName, interviewDate = null, interviewNotes = null, offer = null) => {
    setUpdatingId(id)
    setFeedback('')
    try {
      const body = { status }
      if (interviewDate !== null) body.interview_date = interviewDate
      if (interviewNotes !== null) body.interview_notes = interviewNotes
      if (offer) Object.assign(body, offer)

      const res = await call(`/applications/${id}/status`, {
        method: 'PATCH',
        body
      })
      const opt = STATUS_OPTIONS.find(o => o.id === status)
      const label = opt ? opt.label : status
      const email = res?.email || {}
      const who = applicantName || 'The applicant'
      let msg
      let ok = true
      if (email.success && email.mode === 'brevo') {
        msg = `${who} is now “${label}”. We told them in the app and by email.`
      } else if (email.mode === 'skipped') {
        msg = `${who} is now “${label}”. We told them in the app (they turned off email updates).`
      } else {
        msg = `${who} is now “${label}”. We told them in the app. The email could not be sent right now.`
        ok = false
      }
      setFeedbackOk(ok)
      setFeedback(msg)
      setTimeout(() => setFeedback(''), ok ? 6000 : 12000)
      load()
    } catch (err) {
      setFeedbackOk(false)
      setFeedback(err.message || 'We couldn’t update this applicant. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === 'pending' || a.status === 'reviewed').length,
    shortlisted: apps.filter(a => a.status === 'shortlisted').length,
    for_interview: apps.filter(a => a.status === 'for_interview').length,
    interviewed: apps.filter(a => a.status === 'interviewed').length,
    offer: apps.filter(a => a.status === 'offer').length,
    hired: apps.filter(a => a.status === 'hired').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const filtered = apps.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.status === 'pending' || a.status === 'reviewed'
    return a.status === filter
  })

  return (
    <div className="page-inner">
      <div className="page-actions" style={{ justifyContent: jobId ? 'space-between' : 'flex-end' }}>
        {jobId && (
          <div className="ap-for">
            <Link to="/dashboard/applicants">← All applicants</Link>
            <b>{apps[0]?.job_title ? `For: ${apps[0].job_title}` : 'For this job post'}</b>
          </div>
        )}
        <button className="btn btn-light btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* Stats: one quiet row, each number shown once */}
      <div className="ap-stats">
        {[
          { label: 'Total', val: counts.all, tone: 'navy' },
          { label: 'Pending', val: counts.pending, tone: 'amber' },
          { label: 'Shortlisted', val: counts.shortlisted, tone: 'blue' },
          { label: 'Interview', val: counts.for_interview, tone: 'violet' },
          { label: 'Hired', val: counts.hired, tone: 'green' },
          { label: 'Rejected', val: counts.rejected, tone: 'red' },
        ].map((s) => (
          <div key={s.label} className={`ap-stat tone-${s.tone}`}>
            <span className="ap-stat-val">{s.val}</span>
            <span className="ap-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
      {feedback && (
        <div style={{ padding: '12px 18px', background: feedbackOk ? '#ecfdf5' : '#fffbeb', border: `1px solid ${feedbackOk ? '#a7f3d0' : '#fde68a'}`, borderRadius: 10, color: feedbackOk ? '#065f46' : '#92400e', fontSize: 14, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          {feedbackOk ? <IconCheck size={18} /> : <IconAlert size={18} />} {feedback}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="ap-tabs">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'shortlisted', label: 'Shortlisted' },
          { id: 'for_interview', label: 'Interview' },
          { id: 'interviewed', label: 'Interviewed' },
          { id: 'offer', label: 'Job Offer' },
          { id: 'hired', label: 'Hired' },
          { id: 'rejected', label: 'Not Selected' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`ap-tab${filter === tab.id ? ' on' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applicants List */}
      {loading ? (
        <div className="panel"><BrandLoader compact label="Loading applicants…" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
          <IconUsers size={36} style={{ color: '#cbd5e1', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, color: 'var(--navy-d)', marginBottom: 6 }}>No applicants found</h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            {filter === 'all'
              ? 'No one has applied to your job postings yet. When workers apply, they will appear here.'
              : `No applicants currently under "${filter.replace('_', ' ')}" status.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(a => {
            const currentStatus = a.status === 'reviewed' ? 'pending' : a.status
            const isHired = currentStatus === 'hired'
            const isInterview = currentStatus === 'for_interview'
            const isShortlisted = currentStatus === 'shortlisted'
            const isRejected = currentStatus === 'rejected'
            const isPending = currentStatus === 'pending'

            const isWithdrawn = currentStatus === 'withdrawn'
            const statusObj = isWithdrawn ? WITHDRAWN_STATUS : (STATUS_OPTIONS.find(o => o.id === currentStatus) || STATUS_OPTIONS[0])

            return (
              <div
                key={a.id}
                className="panel"
                style={{
                  padding: 20,
                  borderLeft: `4px solid ${statusObj.color}`,
                  transition: 'box-shadow .2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  {/* Candidate Profile */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 280 }}>
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                      <img src={a.applicant_picture || avatarDataUrl({ id: a.worker_id, full_name: a.applicant_name || a.full_name })} alt="" />
                      <span>{(a.applicant_name || a.full_name || 'A')[0].toUpperCase()}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
                          {a.applicant_name || a.full_name || 'Candidate'}
                        </h3>
                        {a.match_score && (
                          <span className="chip" style={{ background: '#ecfdf5', color: '#065f46', fontWeight: 700, fontSize: 11 }}>
                            {a.match_score}% Match
                          </span>
                        )}
                        {/* their average from every employer who hired them before you */}
                        {a.worker_rating?.count > 0 && (
                          <span className="chip" title={`${a.worker_rating.count} ${a.worker_rating.count === 1 ? 'employer has' : 'employers have'} rated this worker`}
                            style={{ background: 'var(--gold-l)', color: 'var(--amber)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconStar size={11} /> {a.worker_rating.average} ({a.worker_rating.count})
                          </span>
                        )}

                        {/* Interactive Status Chip with Click-to-Edit */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="chip"
                            style={{
                              fontSize: 11,
                              background: statusObj.bg,
                              color: statusObj.color,
                              border: `1px solid ${statusObj.border}`,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            ● {statusObj.label}
                          </span>
                          {!isWithdrawn && <button
                            type="button"
                            className="btn btn-light btn-xs"
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22 }}
                            onClick={() => setStatusModal({
                              app: a,
                              status: currentStatus,
                              date: a.interview_date ? a.interview_date.replace(' ', 'T').slice(0, 16) : '',
                              notes: a.interview_notes || ''
                            })}
                            title="Edit or customize recruitment status"
                          >
                            <IconEdit size={11} /> Edit Status
                          </button>}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Applied for: <strong style={{ color: 'var(--ink)' }}>{a.job_title}</strong></span>
                        {a.applicant_location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPin size={13} /> {a.applicant_location}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconMail size={13} /> {a.applicant_email || a.email}</span>
                        {a.applicant_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPhone size={13} /> {a.applicant_phone}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconClock size={13} /> {days(a.created_at)}</span>
                      </div>

                      {/* Cover Note */}
                      {a.cover_note && (
                        <div style={{ marginTop: 12, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#334155', borderLeft: '3px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Applicant Note:</span>
                          "{a.cover_note}"
                        </div>
                      )}

                      {/* Application Pipeline Tracker for Employer */}
                      {isWithdrawn
                        ? <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>The applicant withdrew this application, so its status can no longer be changed.</p>
                        : <ApplicationTracker viewer="employer" status={a.status} interviewDate={a.interview_date} interviewNotes={a.interview_notes} />}
                    </div>
                  </div>

                  {/* Action Buttons: Status Customizer & Quick Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: 12, fontWeight: 700 }} onClick={() => setProfileId(a.id)}>
                      View full profile
                    </button>
                    {!isWithdrawn && (<>

                    {/* Quick 1-click Shortlist */}
                    {!isShortlisted && !isHired && (
                      <button
                        className="btn btn-light btn-sm"
                        disabled={updatingId === a.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        onClick={() => handleUpdate(a.id, 'shortlisted', a.applicant_name || a.full_name)}
                        title="Shortlist candidate"
                      >
                        <IconStar size={13} /> Shortlist
                      </button>
                    )}

                    {/* Quick 1-click For Interview */}
                    {!isInterview && !isHired && (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: '#7c3aed',
                          color: '#fff',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12
                        }}
                        disabled={updatingId === a.id}
                        onClick={() => setStatusModal({
                          app: a,
                          status: 'for_interview',
                          date: a.interview_date ? a.interview_date.replace(' ', 'T').slice(0, 16) : '',
                          notes: a.interview_notes || ''
                        })}
                        title="Schedule an interview"
                      >
                        <IconCalendar size={13} /> For Interview
                      </button>
                    )}

                    {/* Quick 1-click Hire / Accept */}
                    {!isHired && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#059669', color: '#fff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        disabled={updatingId === a.id}
                        onClick={() => handleUpdate(a.id, 'hired', a.applicant_name || a.full_name)}
                        title="Officially hire candidate"
                      >
                        {updatingId === a.id ? 'Updating…' : <><IconCheck size={13} /> Hire</>}
                      </button>
                    )}

                    {/* A hire is the only thing that unlocks a rating, in either direction. */}
                    {isHired && <RateWorker app={a} call={call} onSaved={load} />}

                    {/* Quick 1-click Reject */}
                    {!isRejected && !isHired && (
                      <button
                        className="btn btn-light btn-sm"
                        style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        disabled={updatingId === a.id}
                        onClick={() => setStatusModal({
                          app: a,
                          status: 'rejected',
                          date: '',
                          notes: a.interview_notes || ''
                        })}
                        title="Mark as not selected"
                      >
                        <IconX size={13} /> Reject
                      </button>
                    )}

                    {/* Re-open / Reconsider for Hired or Rejected candidates */}


                    </>)}
                    {/* Chat with candidate */}
                    {a.worker_id && (
                      <Link
                        to={`/dashboard/messages?to=${a.worker_id}`}
                        className="btn btn-light btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                      >
                        <IconMsgCircle size={13} /> Message
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {profileId && <ApplicantProfile appId={profileId} call={call} onClose={() => setProfileId(null)} />}

      {/* ─── Status Customizer Modal (Pending / Shortlisted / For Interview / Hired / Rejected) ─── */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 29, 0.7)', backdropFilter: 'blur(3px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="panel" style={{ width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy-d)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconEdit size={20} style={{ color: 'var(--gold)' }} />
                Customize Candidate Status
              </h3>
              <button
                onClick={() => setStatusModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}
              >
                <IconX size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Candidate: <strong style={{ color: 'var(--ink)' }}>{statusModal.app.applicant_name || statusModal.app.full_name}</strong><br />
              Position: <strong style={{ color: 'var(--ink)' }}>{statusModal.app.job_title}</strong>
            </p>

            {/* 5 Selectable Status Cards */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
                Select Application Status
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                {STATUS_OPTIONS.filter(o => nextSteps(statusModal.app.status).includes(o.id)).map(opt => {
                  const isSelected = statusModal.status === opt.id
                  const OptIcon = opt.icon
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setStatusModal(m => ({ ...m, status: opt.id }))}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: isSelected ? `2px solid ${opt.color}` : '1.5px solid var(--line)',
                        background: isSelected ? opt.bg : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: isSelected ? opt.color : '#f1f5f9',
                            color: isSelected ? '#ffffff' : opt.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <OptIcon size={14} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? opt.color : 'var(--navy-d)' }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 12, color: isSelected ? opt.color : 'var(--muted)', marginTop: 1, opacity: isSelected ? 0.9 : 0.8 }}>
                            {opt.desc}
                          </div>
                        </div>
                      </div>

                      <input
                        type="radio"
                        name="candidate_status"
                        checked={isSelected}
                        onChange={() => setStatusModal(m => ({ ...m, status: opt.id }))}
                        style={{ accentColor: opt.color, width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conditional Fields based on status */}
            {statusModal.status === 'for_interview' && (
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px 0', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCalendar size={15} /> Interview Schedule &amp; Instructions
                </h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#4c1d95' }}>
                    Interview Date &amp; Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={statusModal.date}
                    onChange={e => setStatusModal(m => ({ ...m, date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: 13, background: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#4c1d95' }}>
                    Venue / Meeting Link / Notes for Candidate (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. In-person interview at Calapan City Office or Google Meet link. Please bring printed resume and 1 valid ID."
                    value={statusModal.notes}
                    onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: 13, resize: 'vertical', background: '#fff' }}
                  />
                </div>
              </div>
            )}

            {statusModal.status === 'offer' && (
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                <label className="field" style={{ marginBottom: 0 }}><span>Pay offered (₱) <em>optional</em></span>
                  <div className="in no-icon"><input type="number" min={0} value={statusModal.offer_salary || ''} onChange={e => setStatusModal(m => ({ ...m, offer_salary: e.target.value }))} placeholder="e.g. 16000" /></div></label>
                <label className="field" style={{ marginBottom: 0 }}><span>Start date <em>optional</em></span>
                  <div className="in no-icon"><input type="date" value={statusModal.offer_start || ''} onChange={e => setStatusModal(m => ({ ...m, offer_start: e.target.value }))} /></div></label>
                <label className="field" style={{ marginBottom: 0 }}><span>Details <em>schedule, requirements to bring</em></span>
                  <textarea className="pf-textarea" value={statusModal.offer_details || ''} onChange={e => setStatusModal(m => ({ ...m, offer_details: e.target.value }))} /></label>
              </div>
            )}

            {statusModal.status === 'rejected' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconX size={15} /> Constructive Feedback / Reason (Optional)
                </h4>
                <p style={{ fontSize: 12, color: '#991b1b', margin: '0 0 8px 0' }}>
                  Provide helpful feedback for the applicant (e.g. position filled, specific skill certification needed).
                </p>
                <textarea
                  rows={2}
                  placeholder="e.g. Thank you for your application. We have decided to proceed with candidates with specialized NC II certification."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, resize: 'vertical', background: '#fff' }}
                />
              </div>
            )}

            {statusModal.status === 'hired' && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px 0', color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} /> Onboarding Instructions &amp; Next Steps (Optional)
                </h4>
                <textarea
                  rows={2}
                  placeholder="e.g. Congratulations! Please report to HR on Monday 8:00 AM with 2 valid IDs and SSS/PhilHealth."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #86efac', fontSize: 13, resize: 'vertical', background: '#fff' }}
                />
              </div>
            )}

            {(statusModal.status === 'shortlisted' || statusModal.status === 'pending') && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--navy-d)' }}>
                  Screening Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Strong experience in electrical installations, follow up next week."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, resize: 'vertical' }}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button
                className="btn btn-light"
                onClick={() => setStatusModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  const { app, status, date, notes } = statusModal
                  if (status === 'for_interview' && !date) { setFeedbackOk(false); setFeedback('Choose the interview date and time first.'); return }
                  setStatusModal(null)
                  handleUpdate(app.id, status, app.applicant_name || app.full_name, date || null, notes || null,
                    status === 'offer' ? { offer_salary: statusModal.offer_salary || '', offer_start: statusModal.offer_start || '', offer_details: statusModal.offer_details || '' } : null)
                }}
              >
                <IconCheck size={14} /> Save and tell the applicant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
