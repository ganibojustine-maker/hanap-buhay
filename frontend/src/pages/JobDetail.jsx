import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Logo, IconPin, IconBriefcase, IconClock, IconCheck, IconAlert,
         IconBack, IconSend, IconBuilding, IconPhone, IconCalendar, IconUsers } from '../components/icons.jsx'
import { getJobImage } from '../utils/jobImages.js'

const DEMO = {
  id: 1, title: 'Construction Worker', company: 'Vicor Construction Services',
  employer_name: 'Juan Santos', location: 'Calapan City', job_type: 'full-time',
  salary_min: 15000, salary_max: 20000,
  description: 'We are looking for skilled Construction Workers to join our growing team in Calapan City. You will be responsible for carrying out physical labor tasks at construction sites, following instructions from supervisors and foremen.',
  requirements: 'At least 1 year of construction experience\nPhysically fit and able to work long hours\nSafety awareness and compliance\nWilling to work in Calapan City area',
  skills_needed: 'Masonry, Carpentry, Concrete mixing, Safety compliance',
  status: 'active', views: 142, created_at: '2026-10-15',
  match_pct: 92,
  skill_gaps: ['TESDA NC II (Construction)'],
  matching_skills: ['Physical labor', '3 years construction experience', 'Safety training'],
}

function fmt(min, max) {
  const f = n => '₱' + Number(n).toLocaleString()
  return min && max ? `${f(min)}–${f(max)}/mo` : min ? `From ${f(min)}/mo` : max ? `Up to ${f(max)}/mo` : 'Negotiable'
}

function days(dt) {
  const d = Math.floor((Date.now() - new Date(dt)) / 86400000)
  return d === 0 ? 'Today' : d === 1 ? '1 day ago' : `${d} days ago`
}

export default function JobDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user, tokens, call } = useAuth()
  const [job, setJob] = useState(null)
  const [userSkills, setUserSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [showApply, setShowApply] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api(`/jobs/${id}`)
      .then(r => setJob(r.job || null))
      .catch(() => setJob(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (user && call) {
      call('/skills/my')
        .then(r => setUserSkills((r.skills || []).map(s => s.skill_name.toLowerCase().trim())))
        .catch(() => {})
      call('/applications/my')
        .then(r => {
          const appliedIds = (r.applications || []).map(a => Number(a.job_id))
          if (appliedIds.includes(Number(id))) setApplied(true)
        })
        .catch(() => {})
    }
  }, [user, call, id])

  async function apply() {
    if (!user) return nav('/login')
    setApplying(true); setError('')
    try {
      await call('/applications', { method: 'POST', body: { job_id: Number(id), cover_note: coverNote } })
      setApplied(true); setSuccess('Application submitted successfully!')
      setShowApply(false)
    } catch(e) {
      if (e?.status === 401) {
        setError('Your session has expired. Please log in again.')
        nav('/login')
      } else {
        setError(e.message)
      }
    }
    finally { setApplying(false) }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center' }}>
      <div className="splash"><span className="spin" /></div>
    </div>
  )

  if (!job) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--navy)', padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Logo light />
        <Link to="/jobs" style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, fontWeight: 600 }}>← Back to Jobs</Link>
      </header>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ maxWidth: 440, background: '#fff', padding: 36, borderRadius: 'var(--r-2xl)', border: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>Job Not Found</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>This job listing does not exist or may have been removed.</p>
          <Link to="/jobs" className="btn btn-primary" style={{ width: '100%' }}>Browse All Jobs</Link>
        </div>
      </div>
    </div>
  )

  const j = job

  // Dynamic Skill Match Calculation
  const needed = (j.skills_needed || '').split(',').map(s => s.trim()).filter(Boolean)
  const matched = needed.filter(n => userSkills.some(us => us.includes(n.toLowerCase()) || n.toLowerCase().includes(us)))
  const missing = needed.filter(n => !userSkills.some(us => us.includes(n.toLowerCase()) || n.toLowerCase().includes(us)))

  let matchScore = needed.length > 0 ? Math.round((matched.length / needed.length) * 80) + 15 : 75
  if (user?.location && (j.location || '').toLowerCase().includes(user.location.toLowerCase())) {
    matchScore = Math.min(100, matchScore + 10)
  }
  matchScore = Math.max(45, Math.min(98, matchScore))
  const matchColor = matchScore >= 80 ? 'var(--green)' : matchScore >= 65 ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <header style={{ background: 'var(--navy)', padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Logo light />
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

      {/* Breadcrumb */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '12px 36px', fontSize: 13, color: 'var(--muted)' }}>
        <Link to="/" style={{ color: 'var(--navy)' }}>Home</Link> ›{' '}
        <Link to="/jobs" style={{ color: 'var(--navy)' }}>Jobs</Link> › {j.title}
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Main content */}
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Job header */}
          <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: '28px 30px', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ width: 68, height: 68, borderRadius: 18, background: 'var(--navy-soft)', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 800, fontSize: 24, color: 'var(--navy)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                <img src={getJobImage(j)} alt={j.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                <span>{(j.company || j.title || 'J')[0]}</span>
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 26, letterSpacing: '-.04em', marginBottom: 4 }}>{j.title}</h1>
                <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 12 }}>{j.company || j.employer_name}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--muted)' }}><IconPin size={14} />{j.location}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--muted)' }}><IconBriefcase size={14} />{(j.job_type||'Full-time').replace('-',' ')}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--muted)' }}><IconClock size={14} />Posted {days(j.created_at)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'var(--muted)' }}><IconUsers size={14} />{j.views || 0} views</span>
                </div>
              </div>
              {user && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div className="ring ring-lg" style={{ '--p': matchScore, background: `conic-gradient(${matchColor} ${matchScore}%, var(--line) 0)` }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{matchScore}%</span>
                  </div>
                  <small style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 4 }}>Match</small>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: 18 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 2 }}>Salary</p>
                <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{fmt(j.salary_min, j.salary_max)}</p>
              </div>
              {success
                ? <div style={{ background: 'var(--green-l)', color: 'var(--green)', padding: '10px 18px', borderRadius: 10, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}><IconCheck size={18} />{success}</div>
                : applied
                  ? <span style={{ color: 'var(--green)', fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><IconCheck />Applied</span>
                  : <button className="btn btn-primary btn-lg" onClick={() => setShowApply(true)}>Apply Now</button>}
            </div>
          </div>

          {/* Match card */}
          {user && (
            <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: '22px 26px', border: '1px solid var(--line)' }}>
              <h2 style={{ fontSize: 18, marginBottom: 14 }}>Your Match Analysis</h2>
              {missing.map(gap => (
                <div key={gap} className="alert-box" style={{ marginBottom: 10 }}>
                  <IconAlert size={18} />
                  <div><b>Required: Missing</b><small style={{ display: 'block' }}>{gap}</small></div>
                </div>
              ))}
              {matched.map(s => (
                <div key={s} className="ok-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--soft)' }}>
                  <IconCheck size={16} />{s}
                </div>
              ))}
              {needed.length === 0 && (
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>No specific prerequisite certifications required for this position.</p>
              )}
            </div>
          )}

          {/* Description */}
          <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: '24px 28px', border: '1px solid var(--line)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 16 }}>Job Description</h2>
            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text)' }}>
              {(j.description || '').split('\n').map((p, i) => <p key={i} style={{ marginBottom: 12 }}>{p}</p>)}
            </div>
          </div>

          {/* Requirements */}
          {j.requirements && (
            <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: '24px 28px', border: '1px solid var(--line)' }}>
              <h2 style={{ fontSize: 18, marginBottom: 16 }}>Requirements</h2>
              <ul style={{ display: 'grid', gap: 10 }}>
                {j.requirements.split('\n').filter(Boolean).map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: 15, color: 'var(--text)' }}>
                    <IconCheck size={16} style={{ color: 'var(--navy)', flexShrink: 0, marginTop: 3 }} />{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {j.skills_needed && (
            <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: '22px 26px', border: '1px solid var(--line)' }}>
              <h2 style={{ fontSize: 18, marginBottom: 14 }}>Skills Required</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {j.skills_needed.split(',').map(s => (
                  <span key={s} className="chip navy" style={{ fontSize: 13 }}>{s.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'grid', gap: 16, position: 'sticky', top: 24 }}>
          {/* Apply box */}
          <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-2xl)', padding: 24, color: '#fff' }}>
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>Ready to Apply?</h3>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 14, marginBottom: 18, lineHeight: 1.6 }}>Submit your application now. Your Skills Passport will be shared with the employer.</p>
            {error && <p style={{ background: 'var(--red-l)', color: 'var(--red)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {applied || success
              ? <div style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: 16 }}><IconCheck size={20} /> Applied!</div>
              : <button className="btn btn-primary btn-block btn-lg" onClick={() => setShowApply(true)}>Apply Now</button>}
            {!user && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 12 }}>You need to <Link to="/login" style={{ color: 'var(--gold)' }}>sign in</Link> first.</p>}
          </div>

          {/* Job summary */}
          <div style={{ background: '#fff', borderRadius: 'var(--r-xl)', padding: 22, border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Job Overview</h3>
            <dl className="facts">
              <div><dt><IconBriefcase size={14} /> Type</dt><dd style={{ textTransform: 'capitalize' }}>{(j.job_type||'').replace('-',' ')}</dd></div>
              <div><dt><IconPin size={14} /> Location</dt><dd>{j.location}</dd></div>
              <div><dt><IconCalendar size={14} /> Posted</dt><dd>{days(j.created_at)}</dd></div>
              <div><dt><IconBuilding size={14} /> Company</dt><dd>{j.company || j.employer_name}</dd></div>
            </dl>
          </div>

          <Link to="/jobs" className="btn btn-light" style={{ textAlign: 'center' }}>← Back to Jobs</Link>
        </div>
      </div>

      {/* Apply modal */}
      {showApply && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,62,.5)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowApply(false) }}>
          <div style={{ background: '#fff', borderRadius: 'var(--r-2xl)', padding: 30, width: '100%', maxWidth: 520 }}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>Apply for {j.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>at {j.company || j.employer_name} · {j.location}</p>
            <div className="field">
              <span>Cover Note <em>Optional</em></span>
              <div className="in no-icon">
                <textarea placeholder="Tell the employer why you're a great fit for this role…"
                  value={coverNote} onChange={e => setCoverNote(e.target.value)}
                  style={{ minHeight: 130 }} />
              </div>
            </div>
            {error && <p style={{ background: 'var(--red-l)', color: 'var(--red)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 16 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-light" onClick={() => setShowApply(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={applying} onClick={apply}>
                {applying ? <span className="spin" /> : <><IconSend size={16} /> Submit Application</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
