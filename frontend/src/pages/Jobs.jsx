import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Logo, IconSearch, IconPin, IconFilter, IconBriefcase, IconX, IconCheck,
         IconArrow, IconClock, IconChevron, IconMenu } from '../components/icons.jsx'
import { TOWNS } from '../components/art.jsx'
import { getJobImage } from '../utils/jobImages.js'

const JOB_TYPES = ['full-time','part-time','contractual','freelance','gig']
const SALARY_RANGES = [
  { label: 'Any amount', min: null, max: null },
  { label: '₱5,000–₱10,000', min: 5000, max: 10000 },
  { label: '₱10,000–₱20,000', min: 10000, max: 20000 },
  { label: '₱20,000–₱35,000', min: 20000, max: 35000 },
  { label: '₱35,000+', min: 35000, max: null },
]

const DEMO_JOBS = [
  { id:1, title:'Construction Worker',      company:'Vicor Construction Services',    location:'Calapan City, Oriental Mindoro', job_type:'full-time',   salary_min:15000, salary_max:20000, match_pct:92, created_at:'2026-10-15' },
  { id:2, title:'Construction Helper',      company:'Lumen Builders Inc.',            location:'Calapan City, Oriental Mindoro', job_type:'part-time',   salary_min:8000,  salary_max:12000, match_pct:70, created_at:'2026-10-14' },
  { id:3, title:'Civil Engineer (Site)',    company:'DMC Major Construction',         location:'Calapan City, Oriental Mindoro', job_type:'full-time',   salary_min:25000, salary_max:35000, match_pct:60, created_at:'2026-10-13' },
  { id:4, title:'Welder',                   company:'Mindoro Metal Works',            location:'Bansud, Oriental Mindoro',        job_type:'contractual', salary_min:12000, salary_max:18000, match_pct:73, created_at:'2026-10-12' },
  { id:5, title:'Electrician',              company:'Calapan Power Solutions',        location:'Calapan City, Oriental Mindoro', job_type:'contractual', salary_min:14000, salary_max:22000, match_pct:85, created_at:'2026-10-12' },
  { id:6, title:'Service Crew',             company:'Oriental Food Corp',             location:'Calapan City, Oriental Mindoro', job_type:'part-time',   salary_min:8000,  salary_max:11000, match_pct:77, created_at:'2026-10-11' },
  { id:7, title:'Graphic Designer',        company:'Mindoro Creative Studio',         location:'Naujan, Oriental Mindoro',        job_type:'freelance',   salary_min:15000, salary_max:null,  match_pct:88, created_at:'2026-10-10' },
  { id:8, title:'Warehouse Staff',          company:'Rosario Logistics',             location:'Gloria, Oriental Mindoro',        job_type:'full-time',   salary_min:13000, salary_max:16000, match_pct:65, created_at:'2026-10-09' },
]

function matchChip(score) {
  if (!score) return null
  const cls = score >= 80 ? 'green' : score >= 65 ? 'match-mid' : 'match-low'
  return <span className={`chip ${cls}`}>{score}% Match</span>
}

function fmt(min, max) {
  if (!min && !max) return 'Negotiable'
  const f = n => '₱' + Number(n).toLocaleString()
  return min && max ? `${f(min)}–${f(max)}/mo` : min ? `From ${f(min)}/mo` : `Up to ${f(max)}/mo`
}

function days(dt) {
  const d = Math.floor((Date.now() - new Date(dt)) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? '1 day ago' : `${d} days ago`
}

export default function Jobs() {
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { user } = useAuth()

  const [q, setQ]           = useState(params.get('q') || '')
  const [loc, setLoc]       = useState(params.get('location') || '')
  const [jobType, setJobType]= useState([])
  const [salary, setSalary] = useState(SALARY_RANGES[0])
  const [jobs, setJobs]     = useState([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [loading, setLoading]= useState(true)
  const [filterOpen, setFilterOpen] = useState(true)
  const [showAllTowns, setShowAllTowns] = useState(false)

  const fetchJobs = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: pg, limit: 50 })
      if (q.trim())   qs.set('q', q.trim())
      if (loc)         qs.set('location', loc)
      if (jobType.length > 0) qs.set('job_type', jobType.join(','))
      const r = await api(`/jobs?${qs}`)
      let list = r.jobs || r.data || []

      // Multi-type filter
      if (jobType.length > 0) {
        list = list.filter(j => jobType.includes(j.job_type))
      }
      // Salary filter
      if (salary.min !== null) {
        list = list.filter(j => Number(j.salary_max || j.salary_min || 0) >= salary.min)
      }
      if (salary.max !== null) {
        list = list.filter(j => Number(j.salary_min || 0) <= salary.max)
      }

      setJobs(list)
      setTotal(list.length)
      setPage(pg)
    } catch {
      let list = DEMO_JOBS
      if (loc) list = list.filter(j => (j.location || '').includes(loc))
      if (jobType.length > 0) list = list.filter(j => jobType.includes(j.job_type))
      if (salary.min !== null) list = list.filter(j => Number(j.salary_max || j.salary_min || 0) >= salary.min)
      if (salary.max !== null) list = list.filter(j => Number(j.salary_min || 0) <= salary.max)
      setJobs(list); setTotal(list.length)
    } finally { setLoading(false) }
  }, [q, loc, jobType, salary])

  useEffect(() => { fetchJobs(1) }, [fetchJobs])

  function search(e) { e?.preventDefault(); setParams({ q, location: loc }); fetchJobs(1) }

  const toggleType = t => setJobType(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top Nav */}
      <header style={{ background: 'var(--navy)', padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Logo light />
        <nav style={{ display: 'flex', gap: 6 }}>
          {[['/', 'Home'], ['/jobs', 'Jobs'], ['/map', 'Job Map'], ['/training', 'Training'], ['/dashboard', 'Dashboard']].map(([to, label]) => (
            <Link key={to} to={to} style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.75)', padding: '8px 14px', borderRadius: 8, transition: '.2s' }}
              onMouseEnter={e => e.target.style.color = '#fff'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.75)'}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {user ? (
            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div className="avatar" style={{ width: 34, height: 34, overflow: 'hidden' }}>
                <img src={user.picture || '/images/avatar.jpg'} alt={user.full_name || 'User'} onError={e => { e.currentTarget.style.display = 'none' }} />
                <span>{(user.full_name || user.email)[0].toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{user.full_name?.split(' ')[0] || 'Dashboard'}</span>
            </Link>
          ) : (
            <>
              <Link to="/login" style={{ color: 'rgba(255,255,255,.8)', fontWeight: 600, fontSize: 14 }}>Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>
      </header>

      {/* Breadcrumb + Title */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '14px 36px' }}>
        <nav style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
          <Link to="/" style={{ color: 'var(--navy)' }}>Home</Link> › <span>Jobs</span>
        </nav>
        <h1 style={{ fontSize: 26, letterSpacing: '-.04em', marginBottom: 4 }}>Job Search</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Find the perfect job that matches your skills and location.</p>
      </div>

      {/* Search bar */}
      <form onSubmit={search} style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '14px 36px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="in" style={{ flex: 2, minWidth: 200 }}>
          <IconSearch size={17} />
          <input type="search" placeholder="Job title, skills, or keyword" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="in" style={{ flex: 1.5, minWidth: 160 }}>
          <IconPin size={17} />
          <select value={loc} onChange={e => setLoc(e.target.value)}>
            <option value="">All Locations</option>
            {TOWNS.map(t => <option key={t} value={t}>{t}, Oriental Mindoro</option>)}
          </select>
        </div>
        <div className="in" style={{ flex: 1, minWidth: 140 }}>
          <IconBriefcase size={17} />
          <select value={jobType[0] || ''} onChange={e => setJobType(e.target.value ? [e.target.value] : [])}>
            <option value="">All Job Types</option>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1).replace('-',' ')}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: 50 }}>Search</button>
      </form>

      <div style={{ display: 'flex', maxWidth: 1280, margin: '0 auto', padding: '0 24px 48px', gap: 20, alignItems: 'flex-start' }}>

        {/* Filters Sidebar */}
        <aside style={{ width: 240, flexShrink: 0, background: '#fff', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', padding: 20, marginTop: 24, position: 'sticky', top: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontSize: 16 }}>Filters</h2>
            {(jobType.length > 0 || loc) && (
              <button className="linklike" style={{ fontSize: 12 }} onClick={() => { setJobType([]); setLoc('') }}>Clear all</button>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10 }}>Location</h3>
            {(showAllTowns ? TOWNS : TOWNS.slice(0, 5)).map(t => (
              <label key={t} className="check" style={{ display: 'flex', marginBottom: 8 }}>
                <input type="checkbox" checked={loc === t} onChange={() => setLoc(loc === t ? '' : t)} />
                {t}
              </label>
            ))}
            <button
              type="button"
              className="linklike"
              style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600, marginTop: 4, cursor: 'pointer' }}
              onClick={() => setShowAllTowns(!showAllTowns)}
            >
              {showAllTowns ? 'Show fewer towns' : `+ ${TOWNS.length - 5} more towns`}
            </button>
          </div>

          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10 }}>Job Type</h3>
            {JOB_TYPES.map(t => (
              <label key={t} className="check" style={{ display: 'flex', marginBottom: 8 }}>
                <input type="checkbox" checked={jobType.includes(t)} onChange={() => toggleType(t)} />
                {t.charAt(0).toUpperCase()+t.slice(1).replace('-',' ')}
              </label>
            ))}
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10 }}>Salary Range</h3>
            {SALARY_RANGES.map(r => (
              <label key={r.label} className="check" style={{ display: 'flex', marginBottom: 8 }}>
                <input type="radio" name="salary" checked={salary.label === r.label}
                  onChange={() => setSalary(r)} style={{ borderRadius: '50%' }} />
                {r.label}
              </label>
            ))}
          </div>
        </aside>

        {/* Results */}
        <div style={{ flex: 1, minWidth: 0, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              {loading ? 'Searching…' : `Showing ${jobs.length} of ${total} results${q ? ` for "${q}"` : ''}${loc ? ` in ${loc}` : ''}`}
            </p>
            <select className="in" style={{ width: 'auto', height: 38, border: '1px solid var(--line)', borderRadius: 8, padding: '0 12px', fontSize: 13 }}>
              <option>Most Relevant</option>
              <option>Most Recent</option>
              <option>Salary: High to Low</option>
            </select>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {loading
              ? Array(5).fill(0).map((_, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 'var(--r-xl)', padding: 20, border: '1px solid var(--line)' }}>
                  <div className="skel" style={{ height: 80 }} />
                </div>
              ))
              : jobs.map((job, i) => (
                <article key={job.id || i}
                  style={{ background: '#fff', borderRadius: 'var(--r-xl)', padding: 22, border: '1px solid var(--line)', display: 'flex', gap: 16, alignItems: 'flex-start', transition: 'box-shadow .2s, border-color .2s', cursor: 'pointer' }}
                  onClick={() => nav(`/jobs/${job.id}`)}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = '#d1d5db' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--line)' }}
                >
                  {/* Company / Role photo thumbnail */}
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--navy-soft)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, color: 'var(--navy)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                    <img src={getJobImage(job)} alt={job.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    <span>{(job.company || job.title || 'J')[0]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <div>
                        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>{job.title}</h2>
                        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 0 0' }}>{job.company || job.employer_name || 'Local Employer'}</p>
                      </div>
                      {matchChip(job.match_pct)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                        <IconPin size={13} />{job.location || 'Oriental Mindoro'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                        <IconBriefcase size={13} />{(job.job_type || 'Full-time').replace('-', ' ')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted)' }}>
                        <IconClock size={13} />{days(job.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{fmt(job.salary_min, job.salary_max)}</span>
                      <button className="btn btn-navy btn-sm" onClick={e => { e.stopPropagation(); nav(`/jobs/${job.id}`) }}>View Details</button>
                    </div>
                  </div>
                </article>
              ))
            }
          </div>

          {/* Pagination */}
          {total > 10 && !loading && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 28 }}>
              {page > 1 && <button className="btn btn-light btn-sm" onClick={() => fetchJobs(page - 1)}>← Prev</button>}
              {Array.from({ length: Math.min(5, Math.ceil(total / 10)) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-navy' : 'btn-light'}`} onClick={() => fetchJobs(p)}>{p}</button>
              ))}
              {page < Math.ceil(total / 10) && <button className="btn btn-light btn-sm" onClick={() => fetchJobs(page + 1)}>Next →</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
