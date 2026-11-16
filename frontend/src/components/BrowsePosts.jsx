/**
 * Browse — real, current posts from the database on the landing page: jobs from employers
 * and gigs from clients. The server only returns posts that are live, approved and not
 * expired (JobController::index), and never a street address or contact details to a
 * visitor. Every post can be browsed here, with its photo, but a visitor has to sign in
 * (or create an account) to open a post or apply; after that they land on the same post.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import Dialog from './Dialog.jsx'
import { IconPin, IconCheck, IconSearch, IconBriefcase, IconArrow } from './icons.jsx'
import { CATEGORIES } from '../utils/categories.js'
import { getJobImage } from '../utils/jobImages.js'
import { peso, phDate } from '../utils/format.js'
import '../styles/platform.css'

const TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const WORK = { 'full-time': 'Full-time', 'part-time': 'Part-time', contractual: 'Contractual', freelance: 'Freelance', gig: 'One-time gig' }
const BASIS = { month: '/ month', day: '/ day', hour: '/ hour', fixed: 'for the job' }
const PAGE = 12

function pay(j) {
  if (!j.salary_min && !j.salary_max) return j.post_type === 'gig' ? 'Price to discuss' : 'Pay to discuss'
  const r = [j.salary_min, j.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–')
  return `${r} ${BASIS[j.pay_basis] || '/ month'}`
}

export default function BrowsePosts() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [town, setTown] = useState('')
  const [cat, setCat] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)     // { jobs, total, failed }
  const [loadingMore, setLoadingMore] = useState(false)
  const [note, setNote] = useState('')
  const [gate, setGate] = useState(null)     // the post a signed-out visitor tried to open

  // a new filter starts again from page 1 (in the same render, so old pages are never mixed in)
  const filter = set => e => { set(e.target.value); setPage(1); setData(null) }

  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ q, post_type: type, location: town, category: cat, limit: PAGE, page, sort: 'recent' }).filter(([, v]) => v))
      if (page > 1) setLoadingMore(true)
      api(`/jobs?${qs}`)
        .then(r => {
          if (!alive) return
          setData(prev => page > 1 && prev && !prev.failed
            ? { ...r, jobs: [...prev.jobs, ...(r.jobs || []).filter(j => !prev.jobs.some(p => p.id === j.id))] }
            : r)
        })
        .catch(() => { if (alive && page === 1) setData({ jobs: [], total: 0, failed: true }) })
        .finally(() => { if (alive) setLoadingMore(false) })
    }, q && page === 1 ? 300 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [q, type, town, cat, page])

  /** Opening a post needs an account; a signed-out visitor gets the sign-in prompt. */
  function open(j, e) {
    if (user) return
    e?.preventDefault()
    setGate(j)
  }

  function apply(j) {
    const isGig = j.post_type === 'gig'
    if (!user) return setGate(j)
    if (user.role === 'admin' || user.account_type !== 'worker') {
      setNote(`Only job seekers can ${isGig ? 'send proposals' : 'apply'}. You are signed in as ${user.role === 'admin' ? 'an administrator' : user.account_type === 'hirer' ? 'a client' : 'an employer'}.`)
      return
    }
    nav(`/jobs/${j.id}`)
  }

  const list = data?.jobs || []
  const total = Number(data?.total || 0)
  const filtered = q || type || town || cat
  const from = gate ? `/jobs/${gate.id}` : '/jobs'
  return (
    <section className="lp-sec" id="browse" aria-labelledby="lp-browse">
      <div className="lp-in">
        <div className="pf-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="lp-h2" id="lp-browse" style={{ margin: 0 }}>Browse jobs and gigs</h2>
            <p className="pf-muted" style={{ margin: '6px 0 0' }}>
              {data && !data.failed ? `${total.toLocaleString('en-PH')} open post${total === 1 ? '' : 's'} from employers and clients in Oriental Mindoro right now.` : 'Open posts from employers and clients across Oriental Mindoro.'}
            </p>
          </div>
          <Link to="/jobs" className="btn btn-light" onClick={e => { if (!user) { e.preventDefault(); setGate({ id: null }) } }}>See all <IconArrow size={14} /></Link>
        </div>
        <div className="pf-browse-filters">
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search: welder, cashier, aircon cleaning…" aria-label="Search posts" />
          <select value={type} onChange={filter(setType)} aria-label="Type"><option value="">Jobs and gigs</option><option value="job">Jobs only</option><option value="gig">Gigs and services only</option></select>
          <select value={town} onChange={filter(setTown)} aria-label="Town"><option value="">Any town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select>
          <select value={cat} onChange={filter(setCat)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        {!user && (
          <div className="pf-note info" style={{ marginBottom: 14 }}>
            <Link to="/login" state={{ from: '/jobs' }}>Sign in</Link> or <Link to="/register?type=worker" state={{ from: '/jobs' }}>create a free account</Link> to see the full details and apply.
          </div>
        )}
        {note && <div className="pf-note info" role="status" style={{ marginBottom: 14 }}>{note} <Link to="/register?type=worker">Create a job seeker account</Link></div>}
        {!data ? (
          <p className="pf-muted" role="status">Loading open posts…</p>
        ) : data.failed ? (
          <div className="pf-note warn">We couldn’t load the posts right now. Please refresh the page in a moment.</div>
        ) : list.length === 0 ? (
          <div className="panel pf-empty">
            <IconSearch size={36} />
            <h2>{filtered ? 'No posts match' : 'No open posts yet'}</h2>
            <p>{filtered ? 'Try another word, town or kind of work.' : 'New jobs and gigs are posted every week. Create a free account and we’ll tell you when one fits your skills.'}</p>
            <div className="pf-actions" style={{ justifyContent: 'center' }}>
              <Link to="/register?type=worker" className="btn btn-primary">I’m looking for work</Link>
              <Link to="/register?type=employer" className="btn btn-light">I’m hiring</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="pf-post-grid">
              {list.map(j => {
                const isGig = j.post_type === 'gig'
                const who = j.company || j.employer_name || (isGig ? 'Client' : 'Employer')
                return (
                  <article key={j.id} className="pf-post has-cover">
                    <Link to={`/jobs/${j.id}`} className="pf-cover" tabIndex={-1} aria-hidden="true" onClick={e => open(j, e)}>
                      <img src={getJobImage(j)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
                      <span className={`pf-type ${isGig ? 'gig' : 'job'}`}>{isGig ? 'Gig / service' : 'Job'}</span>
                      {Number(j.is_urgent) === 1 && <span className="pf-urgent">Urgent</span>}
                    </Link>
                    <div className="pf-post-body">
                      <div className="pf-poster">
                        <span className="pf-logo" aria-hidden="true">
                          <span>{(who[0] || 'H').toUpperCase()}</span>
                          {j.employer_picture && <img src={j.employer_picture} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <h3><Link to={`/jobs/${j.id}`} onClick={e => open(j, e)} style={{ color: 'inherit', textDecoration: 'none' }}>{j.title}</Link></h3>
                          <p className="pf-small" style={{ margin: 0 }}>
                            {who}
                            {Number(j.employer_verified) === 1 && <span className="pf-vbadge" style={{ marginLeft: 6 }}><IconCheck size={10} /> Verified</span>}
                          </p>
                        </div>
                      </div>
                      <p className="pf-small" style={{ margin: 0 }}><IconPin size={12} /> {[j.barangay, j.location].filter(Boolean).join(', ') || 'Oriental Mindoro'} · {WORK[j.job_type] || 'Work'}{j.category ? ` · ${CATEGORIES[j.category]}` : ''}</p>
                      <div className="pf-between">
                        <span className="pf-pay">{pay(j)}</span>
                        <span className="pf-small">{phDate(j.created_at)}</span>
                      </div>
                      <div className="pf-actions" style={{ marginTop: 'auto' }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(j)}>{isGig ? 'Send proposal' : 'Apply'}</button>
                        <Link to={`/jobs/${j.id}`} className="btn btn-light btn-sm" onClick={e => open(j, e)}><IconBriefcase size={13} /> View</Link>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="pf-actions" style={{ justifyContent: 'center', marginTop: 20, flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span className="pf-small">Showing {list.length.toLocaleString('en-PH')} of {total.toLocaleString('en-PH')}</span>
              {list.length < total && (
                <button type="button" className="btn btn-light" disabled={loadingMore} onClick={() => setPage(p => p + 1)}>
                  {loadingMore ? 'Loading…' : 'Show more posts'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {gate && (
        <Dialog
          tone="info"
          title="Sign in to continue"
          onClose={() => setGate(null)}
          actions={[
            { label: 'Create a free account', onClick: () => nav('/register?type=worker', { state: { from } }) },
            { label: 'Sign in', primary: true, onClick: () => nav('/login', { state: { from } }) },
          ]}
        >
          <p style={{ margin: 0 }}>
            {gate.title
              ? <>To see the full details of <b>{gate.title}</b> and {gate.post_type === 'gig' ? 'send a proposal' : 'apply'}, sign in to your Hanapbuhay account.</>
              : <>To see every post and apply, sign in to your Hanapbuhay account.</>}
          </p>
          <p className="pf-small" style={{ margin: '8px 0 0' }}>It’s free. After you sign in, we’ll bring you right back here.</p>
        </Dialog>
      )}
    </section>
  )
}
