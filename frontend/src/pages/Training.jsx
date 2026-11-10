import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Logo, IconBook, IconPin, IconClock, IconSearch, IconArrow } from '../components/icons.jsx'
import { TOWNS } from '../components/art.jsx'
import { getCourseImage } from '../utils/jobImages.js'

const CATEGORIES = ['All', 'Construction', 'Technology', 'Food & Hospitality', 'Agriculture', 'Healthcare', 'Business', 'Maritime', 'Energy']

const DEMO_COURSES = [
  { id:1,  title:'Basic Welding NC II',               provider:'TESDA Calapan',          location:'Calapan City',  duration:'3 months',  is_free:1, category:'Construction',      desc:'Learn stick and MIG welding fundamentals. TESDA NC II certification included.' },
  { id:2,  title:'Computer Hardware Servicing NC II', provider:'TESDA Calapan',          location:'Calapan City',  duration:'3 months',  is_free:1, category:'Technology',        desc:'Diagnose and repair desktop and laptop computers. Includes hands-on lab sessions.' },
  { id:3,  title:'Electrical Installation & Maint.', provider:'TESDA Pinamalayan',       location:'Pinamalayan',   duration:'3 months',  is_free:1, category:'Construction',      desc:'Install and maintain electrical systems in residential and commercial buildings.' },
  { id:4,  title:'Bread & Pastry Production NC II',  provider:'TESDA Naujan',            location:'Naujan',        duration:'2 months',  is_free:1, category:'Food & Hospitality', desc:'Commercial baking, food safety, and pastry production. NC II certification.' },
  { id:5,  title:'Bookkeeping NC III',               provider:'TESDA Gloria',            location:'Gloria',        duration:'3 months',  is_free:1, category:'Business',          desc:'Basic bookkeeping, accounting records, and financial statements.' },
  { id:6,  title:'Solar PV Systems Basics',          provider:'Mindoro Solar Inc.',      location:'Calapan City',  duration:'2 weeks',   is_free:0, cost:1500, category:'Energy',  desc:'Install and maintain solar PV systems. Practical training on real installations.' },
  { id:7,  title:'Seafood Processing NC II',         provider:'Roxas Fishport Coop',     location:'Roxas',         duration:'6 weeks',   is_free:1, category:'Maritime',          desc:'Fish cleaning, salting, smoking, and quality control for export-grade seafood.' },
  { id:8,  title:'Organic Agriculture NC II',        provider:'DA Oriental Mindoro',     location:'Gloria',        duration:'2 months',  is_free:1, category:'Agriculture',       desc:'Organic farming methods, soil health, composting, and pest management.' },
  { id:9,  title:'Caregiving NC II',                 provider:'TESDA Calapan',          location:'Calapan City',  duration:'3 months',  is_free:1, category:'Healthcare',        desc:'Basic nursing care, first aid, and elderly care. For domestic and hospital work.' },
  { id:10, title:'Cookery NC II',                    provider:'TESDA Puerto Galera',     location:'Puerto Galera', duration:'3 months',  is_free:1, category:'Food & Hospitality', desc:'Professional cooking, kitchen safety, and food presentation.' },
  { id:11, title:'Hilot (Wellness Massage)',         provider:'TESDA Calapan',          location:'Calapan City',  duration:'1 month',   is_free:1, category:'Healthcare',        desc:'Traditional Filipino wellness massage techniques. NC II certification.' },
  { id:12, title:'Motorcycle Driving NC II',         provider:'LTMS Partner School',     location:'Calapan City',  duration:'2 weeks',   is_free:0, cost:800, category:'Business', desc:'Defensive driving, road safety, and motorcycle maintenance. License-ready.' },
]

function TopNav() {
  const { user } = useAuth()
  return (
    <header style={{ background: 'var(--navy)', padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 50 }}>
      <Logo light />
      <nav style={{ display: 'flex', gap: 4 }}>
        {[['/', 'Home'], ['/jobs', 'Jobs'], ['/map', 'Job Map'], ['/training', 'Training']].map(([to, label]) => (
          <Link key={to} to={to} style={{ fontSize: 14, fontWeight: 600, color: to === '/training' ? 'var(--gold)' : 'rgba(255,255,255,.75)', padding: '8px 14px', borderRadius: 8 }}>
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
  )
}

export default function Training() {
  const [courses, setCourses]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [q, setQ]               = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)

  useEffect(() => {
    const qs = new URLSearchParams()
    if (location) qs.set('location', location)
    if (category !== 'All') qs.set('category', category)
    api(`/training?${qs}`).then(r => setCourses(r.courses || [])).catch(() => setCourses(DEMO_COURSES)).finally(() => setLoading(false))
  }, [location, category])

  const filtered = courses.filter(c => {
    if (q && !c.title.toLowerCase().includes(q.toLowerCase()) && !c.desc?.toLowerCase().includes(q.toLowerCase())) return false
    if (freeOnly && !c.is_free) return false
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopNav />

      {/* Hero */}
      <div style={{ background: 'var(--navy)', backgroundImage: 'radial-gradient(60% 70% at 80% 0, var(--navy-l), transparent 60%)', padding: 'clamp(40px,7vw,80px) 36px', color: '#fff' }}>
        <div style={{ maxWidth: 700 }}>
          <p className="eyebrow light">Skills Development</p>
          <h1 style={{ color: '#fff', fontSize: 'clamp(28px,4.5vw,52px)', letterSpacing: '-.04em', margin: '12px 0 14px' }}>Training & Courses</h1>
          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 16, maxWidth: 520, lineHeight: 1.7 }}>
            Free and affordable TESDA and local training programs in Oriental Mindoro. Upskill, get certified, and find better work.
          </p>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
          {[['50+', 'Programs available'], ['Free', 'Most TESDA courses'], ['NC II', 'National certification']].map(([val, lbl]) => (
            <div key={val}><b style={{ display: 'block', fontSize: 26, fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--display)' }}>{val}</b><span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{lbl}</span></div>
          ))}
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '16px 36px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="in" style={{ flex: 2, minWidth: 200 }}>
          <IconSearch size={17} />
          <input placeholder="Search courses…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="in" style={{ flex: 1, minWidth: 140 }}>
          <IconBook size={17} />
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="in" style={{ flex: 1, minWidth: 140 }}>
          <IconPin size={17} />
          <select value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">All Locations</option>
            {TOWNS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <label className="check" style={{ whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={freeOnly} onChange={e => setFreeOnly(e.target.checked)} />
          Free only
        </label>
      </div>

      {/* Category chips */}
      <div style={{ background: '#fff', padding: '12px 36px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            style={{ padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1.5px solid', transition: '.2s',
              background: category === c ? 'var(--navy)' : 'transparent',
              color: category === c ? '#fff' : 'var(--muted)',
              borderColor: category === c ? 'var(--navy)' : 'var(--line)'
            }}>
            {c}
          </button>
        ))}
      </div>

      {/* Courses grid */}
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 60px' }}>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
          {loading ? 'Loading…' : `${filtered.length} course${filtered.length !== 1 ? 's' : ''} found`}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
          {loading
            ? Array(6).fill(0).map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', overflow: 'hidden' }}><div className="skel" style={{ height: 160 }} /></div>)
            : filtered.map(c => (
              <article key={c.id} style={{ background: '#fff', borderRadius: 'var(--r-xl)', border: '1px solid var(--line)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'box-shadow .3s, transform .3s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}>
                {/* Course photo thumbnail banner */}
                <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: 'var(--navy-soft)' }}>
                  <img src={getCourseImage(c)} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: c.is_free ? 'var(--green)' : 'var(--gold)' }} />
                </div>
                <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: 'var(--gold-l)', color: 'var(--amber)' }}>{c.category}</span>
                    {c.is_free
                      ? <span className="free-badge">FREE</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: 'var(--navy-soft)', color: 'var(--navy)' }}>₱{Number(c.cost).toLocaleString()}</span>}
                  </div>
                  <h2 style={{ fontSize: 17, letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1.3 }}>{c.title}</h2>
                  {c.desc && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, flex: 1 }}>{c.desc}</p>}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconBook size={13} />{c.provider}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconPin size={13} />{c.location}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconClock size={13} />{c.duration}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button className="btn btn-navy" style={{ flex: 1 }}>
                      Enroll Now <IconArrow size={15} />
                    </button>
                    <button className="btn btn-light btn-sm" title="Save for later">♡</button>
                  </div>
                </div>
              </article>
            ))
          }
        </div>

        {/* TESDA info */}
        <div style={{ marginTop: 48, background: 'var(--navy)', borderRadius: 'var(--r-2xl)', padding: 'clamp(28px,4vw,48px)', color: '#fff', display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
          <div>
            <p className="eyebrow light">Partnered</p>
            <h2 style={{ color: '#fff', fontSize: 'clamp(22px,3vw,32px)', marginTop: 8, marginBottom: 10, letterSpacing: '-.04em' }}>
              TESDA programs are free for qualified applicants.
            </h2>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 15, maxWidth: 480, lineHeight: 1.7 }}>
              Most training programs in Hanapbuhay are fully funded by TESDA — the Technical Education and Skills Development Authority. Enroll today and get a nationally recognized NC II certificate.
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <Link to="/register" className="btn btn-primary btn-lg">Sign Up Free <IconArrow /></Link>
          </div>
        </div>
      </div>
    </div>
  )
}
