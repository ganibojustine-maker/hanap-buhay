/**
 * JobSearch — the one job board in the app.
 *
 * The same component is the public /jobs page and the signed-in Job Search page
 * (/dashboard/browse). Only the chrome around it differs, so nothing about the
 * search, the filters or a result card changes when someone signs in.
 *
 * For a signed-in worker the server scores every job with the same Job_matcher the
 * Job Matches page uses, so the percentage on a card here is the same number the
 * employer sees on their application. Jobs in their own town come first.
 */
import { Pager } from '../../components/Pager.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth.jsx'
import { api } from '../../api.js'
import { IconSearch, IconPin, IconArrow } from '../../components/icons.jsx'
import { TOWNS } from '../../components/art.jsx'
import { useSavedJobs, FeaturedJobCard } from '../../components/JobCard.jsx'
import QuickApplyModal from '../../components/QuickApplyModal.jsx'
import BrandLoader from '../../components/BrandLoader.jsx'
import '../../styles/public.css'

export const JOB_TYPES = ['full-time', 'part-time', 'contractual', 'freelance', 'gig']

export const SALARY_RANGES = [
  { id: 'any', label: 'Any amount', min: null, max: null },
  { id: 'a', label: '₱5,000 – ₱10,000', min: 5000, max: 10000 },
  { id: 'b', label: '₱10,000 – ₱20,000', min: 10000, max: 20000 },
  { id: 'c', label: '₱20,000 – ₱35,000', min: 20000, max: 35000 },
  { id: 'd', label: '₱35,000 and above', min: 35000, max: null },
]

const SORTS = [
  ['relevant', 'Best match'],
  ['recent', 'Newest first'],
  ['salary', 'Highest pay'],
  ['pay_low', 'Lowest pay'],
]

export const typeLabel = t => String(t || '').replace('-', ' ').replace(/^\w/, c => c.toUpperCase())

/* ─ The board ────────────────────────────────────────────── */
export default function JobSearch({ embedded = false, basePath = '/jobs' }) {
  const [params, setParams] = useSearchParams()
  const { user, call } = useAuth()
  const nav = useNavigate()
  const saved = useSavedJobs()
  const firstLoad = useRef(true)

  const [q, setQ] = useState(params.get('q') || '')
  const [loc, setLoc] = useState(params.get('location') || '')
  const [types, setTypes] = useState(() => (params.get('job_type') || '').split(',').filter(Boolean))
  const [salary, setSalary] = useState(SALARY_RANGES[0])
  const [sort, setSort] = useState(params.get('sort') || 'relevant')
  const [page, setPage] = useState(1)

  const [res, setRes] = useState({ jobs: [], total: 0, scored: false, my_town: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [applyJob, setApplyJob] = useState(null)
  const [applying, setApplying] = useState(null)
  const [appliedNow, setAppliedNow] = useState({})

  const PER_PAGE = 20
  const isWorker = user?.account_type === 'worker' && user?.role !== 'admin'

  const load = useCallback(async (pg = 1) => {
    setLoading(true); setError('')
    try {
      const qs = new URLSearchParams({ page: String(pg), limit: String(PER_PAGE), sort })
      if (q.trim()) qs.set('q', q.trim())
      if (loc) qs.set('location', loc)
      if (types.length) qs.set('job_type', types.join(','))
      // call() adds the token when signed in, so the server can score each job
      const r = user && call ? await call(`/jobs?${qs}`) : await api(`/jobs?${qs}`)
      setRes({ jobs: r.jobs || [], total: Number(r.total || 0), scored: !!r.scored, my_town: r.my_town || null })
      setPage(pg)
    } catch (e) {
      setError(e?.message || 'Could not load jobs. Please try again.')
      setRes({ jobs: [], total: 0, scored: false, my_town: null })
    } finally {
      setLoading(false)
    }
  }, [q, loc, types, sort, user, call])

  // re-run on any filter change (debounced for typing)
  useEffect(() => {
    const t = setTimeout(() => load(1), firstLoad.current ? 0 : 280)
    firstLoad.current = false
    return () => clearTimeout(t)
  }, [load])

  // keep the address bar in step, so a search can be shared or bookmarked
  useEffect(() => {
    const next = {}
    if (q.trim()) next.q = q.trim()
    if (loc) next.location = loc
    if (types.length) next.job_type = types.join(',')
    if (sort !== 'relevant') next.sort = sort
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, loc, types, sort])

  // pay range is applied here: the server has no salary filter, and the whole
  // page of results is already in memory
  const jobs = useMemo(() => {
    let list = res.jobs
    if (salary.min !== null) list = list.filter(j => Number(j.salary_max || j.salary_min || 0) >= salary.min)
    if (salary.max !== null) list = list.filter(j => Number(j.salary_min || j.salary_max || 0) <= salary.max)
    return list.map(j => (appliedNow[j.id] ? { ...j, applied: true } : j))
  }, [res.jobs, salary, appliedNow])

  const pages = Math.max(1, Math.ceil(res.total / PER_PAGE))
  const hasFilters = !!(q || loc || types.length || salary.min !== null || salary.max !== null)
  const clearAll = () => { setQ(''); setLoc(''); setTypes([]); setSalary(SALARY_RANGES[0]) }
  const toggleType = t => setTypes(p => (p.includes(t) ? p.filter(x => x !== t) : [...p, t]))
  const detailTo = id => `${basePath}/${id}`

  async function submitApply(note, ack = false) {
    const job = applyJob
    setApplying(job.id)
    try {
      await call('/applications', { method: 'POST', body: { job_id: job.id, cover_note: note, acknowledge_gap: ack } })
      setAppliedNow(p => ({ ...p, [job.id]: true }))
      setApplyJob(null)
    } catch (e) {
      setError(e?.message || 'Could not send the application.')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className={`jb${embedded ? ' is-embedded' : ''}`}>
      {applyJob && (
        <QuickApplyModal job={applyJob} user={user} skills={applyJob.match?.matched || []}
          onClose={() => setApplyJob(null)} onSubmit={submitApply} />
      )}

      {/* 1 — what and where */}
      <form className="jb-search" onSubmit={e => { e.preventDefault(); load(1) }}>
        <div className="in jb-q">
          <IconSearch size={17} />
          <input type="search" placeholder="Job title, skill or company" value={q} onChange={e => setQ(e.target.value)} aria-label="Search jobs" />
        </div>
        <div className="in jb-where">
          <IconPin size={17} />
          <select value={loc} onChange={e => setLoc(e.target.value)} aria-label="Town">
            <option value="">All of Oriental Mindoro</option>
            {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {/* 2 — narrow it down: one row, no side column */}
      <div className="jb-filters">
        <div className="jb-types" role="group" aria-label="Job type">
          {JOB_TYPES.map(t => (
            <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggleType(t)}>{typeLabel(t)}</button>
          ))}
        </div>
        <div className="jb-selects">
          <label className="sr-only" htmlFor="jb-pay">Monthly pay</label>
          <select id="jb-pay" value={salary.id} onChange={e => setSalary(SALARY_RANGES.find(r => r.id === e.target.value) || SALARY_RANGES[0])}>
            {SALARY_RANGES.map(r => <option key={r.id} value={r.id}>{r.id === 'any' ? 'Any pay' : r.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="jb-sort">Sort results</label>
          <select id="jb-sort" value={sort} onChange={e => setSort(e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* 3 — results */}
      <div className="jb-toolbar">
        <p className="jb-count">
          {loading && !res.jobs.length ? 'Searching…' : (
            <>
              <b>{res.total}</b> job{res.total === 1 ? '' : 's'}
              {q ? <> for “{q}”</> : null}{loc ? <> in {loc}</> : res.my_town ? <>, nearest {res.my_town} first</> : null}
            </>
          )}
        </p>
        {hasFilters && <button type="button" className="jb-clear" onClick={clearAll}>Clear filters</button>}
      </div>

      {error && (
        <div className="jb-empty" role="alert" style={{ marginBottom: 12 }}>
          <p style={{ color: 'var(--red)' }}>{error}</p>
          <button type="button" className="btn btn-light btn-sm" onClick={() => load(page)}>Try again</button>
        </div>
      )}

      {loading && !res.jobs.length
        ? <BrandLoader compact label="Searching jobs…" />
        : jobs.length === 0
          ? (
            <div className="jb-empty">
              <p>No job matches these filters{loc ? ` in ${loc}` : ''}.</p>
              {hasFilters && <button type="button" className="btn btn-navy" onClick={clearAll}>Clear the filters</button>}
            </div>
          )
          : (
            <div className={`jc-grid jb-grid${loading ? ' is-busy' : ''}`}>
              {jobs.map(job => (
                <FeaturedJobCard
                  key={job.id}
                  job={job}
                  detailsTo={detailTo(job.id)}
                  compact={!isWorker}
                  saved={saved.isSaved(job.id)}
                  onToggleSave={user ? saved.toggle : undefined}
                  onApply={setApplyJob}
                  busy={applying === job.id}
                />
              ))}
            </div>
          )}

      {pages > 1 && !loading && (
        <Pager pg={{ page, pages, total: res?.total || 0, perPage: PER_PAGE, setPage: n => { load(n); window.scrollTo({ top: 0, behavior: 'smooth' }) } }} label="Job search pages" />
      )}

      {!user && !loading && jobs.length > 0 && (
        <div className="jb-empty" style={{ marginTop: 18, textAlign: 'left', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <b style={{ fontSize: 15 }}>See how well each job fits you.</b>
            <p style={{ margin: '4px 0 0' }}>A free account scores every job against your skills and your town.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => nav('/register')}>Create free account <IconArrow /></button>
        </div>
      )}
    </div>
  )
}
