/**
 * Browse — real, current posts from the database on the landing page: jobs from employers
 * and gigs from clients. The server only returns posts that are live, approved and not
 * expired (JobController::index), and never a street address or contact details to a
 * visitor. Applying asks a visitor to sign in, then brings them back to the same post.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { IconPin, IconCheck, IconSearch, IconBriefcase, IconArrow } from './icons.jsx'
import { CATEGORIES } from '../utils/categories.js'
import { peso, phDate } from '../utils/format.js'
import '../styles/platform.css'

const TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const WORK = { 'full-time': 'Full-time', 'part-time': 'Part-time', contractual: 'Contractual', freelance: 'Freelance', gig: 'One-time gig' }
const BASIS = { month: '/ month', day: '/ day', hour: '/ hour', fixed: 'for the job' }

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
  const [data, setData] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ q, post_type: type, location: town, category: cat, limit: 12, sort: 'recent' }).filter(([, v]) => v))
      api(`/jobs?${qs}`).then(setData).catch(() => setData({ jobs: [], total: 0, failed: true }))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, type, town, cat])

  function apply(j) {
    const isGig = j.post_type === 'gig'
    if (!user) return nav('/login', { state: { from: `/jobs/${j.id}` } })
    if (user.role === 'admin' || user.account_type !== 'worker') {
      setNote(`Only job seekers can ${isGig ? 'send proposals' : 'apply'}. You are signed in as ${user.role === 'admin' ? 'an administrator' : user.account_type === 'hirer' ? 'a client' : 'an employer'}.`)
      return
    }
    nav(`/jobs/${j.id}`)
  }

  const list = data?.jobs || []
  const filtered = q || type || town || cat
  return (
    <section className="lp-sec" id="browse" aria-labelledby="lp-browse">
      <div className="lp-in">
        <div className="pf-between" style={{ marginBottom: 16 }}>
          <div>
            <h2 className="lp-h2" id="lp-browse" style={{ margin: 0 }}>Browse jobs and gigs</h2>
            <p className="pf-muted" style={{ margin: '6px 0 0' }}>
              {data && !data.failed ? `${Number(data.total || 0).toLocaleString('en-PH')} open post${Number(data.total) === 1 ? '' : 's'} in Oriental Mindoro right now.` : 'Open posts from employers and clients across Oriental Mindoro.'}
            </p>
          </div>
          <Link to="/jobs" className="btn btn-light">See all <IconArrow size={14} /></Link>
        </div>
        <div className="pf-browse-filters">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search: welder, cashier, aircon cleaning…" aria-label="Search posts" />
          <select value={type} onChange={e => setType(e.target.value)} aria-label="Type"><option value="">Jobs and gigs</option><option value="job">Jobs only</option><option value="gig">Gigs and services only</option></select>
          <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town"><option value="">Any town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select>
          <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
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
          <div className="pf-post-grid">
            {list.map(j => {
              const isGig = j.post_type === 'gig'
              return (
                <article key={j.id} className="pf-post">
                  <div className="pf-between">
                    <span className={`pf-type ${isGig ? 'gig' : 'job'}`}>{isGig ? 'Gig / service' : 'Job'}</span>
                    <span className="pf-small">Posted {phDate(j.created_at)}</span>
                  </div>
                  <h3><Link to={`/jobs/${j.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{j.title}</Link></h3>
                  <p className="pf-small" style={{ margin: 0 }}>
                    {j.company || j.employer_name}
                    {Number(j.employer_verified) === 1 && <span className="pf-vbadge" style={{ marginLeft: 6 }}><IconCheck size={10} /> Verified</span>}
                  </p>
                  <p className="pf-small" style={{ margin: 0 }}><IconPin size={12} /> {[j.barangay, j.location].filter(Boolean).join(', ') || 'Oriental Mindoro'} · {WORK[j.job_type] || 'Work'}{j.category ? ` · ${CATEGORIES[j.category]}` : ''}</p>
                  <span className="pf-pay">{pay(j)}</span>
                  <div className="pf-actions" style={{ marginTop: 'auto' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(j)}>{isGig ? 'Send proposal' : 'Apply'}</button>
                    <Link to={`/jobs/${j.id}`} className="btn btn-light btn-sm"><IconBriefcase size={13} /> View</Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
