import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Logo, IconArrow, IconCheck, IconMenu, IconX, IconPin, IconSearch,
  IconBriefcase, IconBook, IconMap, IconShield, IconUsers
} from '../components/icons.jsx'
import { Avatar, TOWNS } from '../components/art.jsx'
import Reveal from '../components/Reveal.jsx'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { getJobImage } from '../utils/jobImages.js'
import { useLanguage, LanguageSwitcher } from '../i18n.jsx'

/* ─ Nav ─────────────────────────────────────────────────── */
function Nav() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 24)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const navLinks = [
    ['jobs', t('nav.find_jobs')],
    ['how', t('nav.how_it_works')],
    ['who', t('nav.who_its_for')],
    ['towns', t('nav.locations')],
  ]

  return (
    <header className={`nav ${scrolled ? 'is-stuck' : ''} ${open ? 'is-open' : ''}`}>
      <div className="nav-in">
        <Logo light />
        <nav aria-label="Primary" className="nav-links">
          {navLinks.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <div className="nav-cta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Exclusively located on the Landing Page */}
          <LanguageSwitcher variant="dropdown" />

          {user ? (
            <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
              <div className="avatar" style={{ width: 34, height: 34 }}>
                <img
                  src={user.picture || '/images/avatar.jpg'}
                  alt={user.full_name || 'User'}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <span>{(user.full_name || user.email)[0].toUpperCase()}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                {user.full_name?.split(' ')[0] || t('nav.dashboard')}
              </span>
            </Link>
          ) : (
            <>
              <Link to="/login" className="nav-signin">{t('nav.sign_in')}</Link>
              <Link to="/register" className="btn btn-primary btn-sm">{t('nav.sign_up')}</Link>
            </>
          )}

          <button
            className="nav-burger"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <IconX size={22} /> : <IconMenu size={22} />}
          </button>
        </div>
      </div>

      <div className="nav-sheet" hidden={!open}>
        <div style={{ padding: '6px 0 14px', borderBottom: '1px solid var(--line)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{t('lang.label')}:</span>
          <LanguageSwitcher variant="toggle" />
        </div>
        {navLinks.map(([id, label], i) => (
          <a key={id} href={`#${id}`} onClick={() => setOpen(false)} style={{ '--d': `${i * 0.05}s` }}>
            {label}
          </a>
        ))}
        <Link to="/login" onClick={() => setOpen(false)}>{t('nav.sign_in')}</Link>
        <Link to="/register" className="btn btn-navy btn-lg" onClick={() => setOpen(false)}>
          {t('nav.create_account')} <IconArrow />
        </Link>
      </div>
    </header>
  )
}

/* ─ Hero ────────────────────────────────────────────────── */
function Hero() {
  const nav = useNavigate()
  const { t } = useLanguage()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const search = () => nav(`/jobs?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}`)

  return (
    <section className="frame hero" aria-label="Find the right job">
      <div className="hero-overlay" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="hero-pill rise">
            <i /> {t('hero.badge')}
          </div>
          <h1>
            <span className="w" style={{ '--d': '0.05s' }}>{t('hero.title_line1')}</span><br />
            <span className="w" style={{ '--d': '0.22s' }}>{t('hero.title_line2')}</span><br />
            <span className="w gold" style={{ '--d': '.42s' }}>{t('hero.title_line3')}</span>
          </h1>
          <p className="hero-lede rise" style={{ '--d': '.55s' }}>
            {t('hero.subtitle')}
          </p>

          {/* Search bar */}
          <div className="hero-search rise" style={{ '--d': '.65s' }}>
            <div className="hero-search-field">
              <IconSearch size={16} />
              <input
                type="search"
                placeholder={t('hero.search_placeholder')}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
            </div>
            <div className="hero-search-field">
              <IconPin size={16} />
              <input
                type="text"
                placeholder={t('hero.location_placeholder')}
                value={loc}
                onChange={e => setLoc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
              />
            </div>
            <button className="btn btn-primary" onClick={search}>{t('hero.search_button')}</button>
          </div>

          <div className="hero-stats rise" style={{ '--d': '.75s' }}>
            <div className="hero-stat"><b>2,400+</b><span>{t('hero.stat_jobs')}</span></div>
            <div className="hero-stat"><b>15 LGUs</b><span>{t('hero.stat_lgus')}</span></div>
            <div className="hero-stat"><b>8,500+</b><span>{t('hero.stat_placed')}</span></div>
          </div>
        </div>

        {/* Hero visual */}
        <div className="hero-visual rise" style={{ '--d': '.3s' }} aria-hidden="true">
          <div className="hero-img-wrap">
            <img
              src="/images/hero.png"
              alt="Skilled vocational trade tools, blueprints, and digital job analytics"
              loading="eager"
            />
          </div>
          <div className="hero-badge hero-badge-1">
            <div className="badge-icon"><IconBriefcase size={20} /></div>
            <div>
              <b>{t('hero.badge_match')}</b>
              <small>{t('hero.badge_match_sub')}</small>
            </div>
          </div>
          <div className="hero-badge hero-badge-2">
            <b>124</b>
            <small>{t('hero.badge_jobs_week')}</small>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─ Features strip ──────────────────────────────────────── */
function Features() {
  const { t } = useLanguage()

  const features = [
    { icon: 'navy', Ic: IconBriefcase, title: t('feat.f1_title'), desc: t('feat.f1_desc') },
    { icon: 'gold', Ic: IconBook,      title: t('feat.f2_title'), desc: t('feat.f2_desc') },
    { icon: 'green',Ic: IconShield,    title: t('feat.f3_title'), desc: t('feat.f3_desc') },
    { icon: 'blue', Ic: IconUsers,     title: t('feat.f4_title'), desc: t('feat.f4_desc') },
  ]

  return (
    <div className="features-strip">
      <div className="features-inner">
        {features.map(({ icon, Ic, title, desc }, i) => (
          <Reveal key={title} className="feature-item" delay={i * 0.08}>
            <div className={`feature-icon ${icon}`}><Ic size={22} /></div>
            <div><h3>{title}</h3><p>{desc}</p></div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}

/* ─ Featured Jobs ───────────────────────────────────────── */
function FeaturedJobs() {
  const { t } = useLanguage()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/jobs/featured')
      .then(r => setJobs(r.jobs || []))
      .catch(() => setJobs(DEMO_JOBS))
      .finally(() => setLoading(false))
  }, [])

  const matchColor = (score) => score >= 80 ? 'green' : score >= 60 ? 'match-mid' : 'match-low'
  const fmt = (min, max) => {
    if (!min && !max) return t('jobs.negotiable')
    const f = n => '₱' + Number(n).toLocaleString()
    return min && max
      ? `${f(min)}–${f(max)}${t('jobs.mo')}`
      : min
        ? `${t('jobs.from')} ${f(min)}${t('jobs.mo')}`
        : `${t('jobs.up_to')} ${f(max)}${t('jobs.mo')}`
  }

  return (
    <section id="jobs" className="featured-jobs">
      <Reveal className="section-head">
        <div>
          <p className="eyebrow" style={{ color: 'var(--gold)' }}>{t('jobs.eyebrow')}</p>
          <h2>{t('jobs.title')}</h2>
        </div>
        <Link to="/jobs" className="btn btn-outline">{t('jobs.view_all')} <IconArrow /></Link>
      </Reveal>
      <div className="jobs-grid">
        {loading
          ? Array(4).fill(0).map((_, i) => <div key={i} className="fjob"><div className="skel" style={{ height: 140 }} /></div>)
          : (jobs.length ? jobs : DEMO_JOBS).slice(0, 8).map((job, i) => (
            <Reveal key={job.id || i} as="article" className="fjob" delay={i * 0.06}>
              <div className="fjob-header">
                <div className="fjob-logo">
                  <img src={getJobImage(job)} alt={job.title} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <span>{(job.company || job.title || 'J')[0].toUpperCase()}</span>
                </div>
                <div>
                  <div className="fjob-title">{job.title}</div>
                  <div className="fjob-company">{job.company || job.employer_name || t('jobs.local_employer')}</div>
                </div>
              </div>
              <div className="fjob-meta">
                <span className="fjob-meta-item"><IconPin size={13} />{job.location || 'Oriental Mindoro'}</span>
                <span className={`fjob-type ${job.job_type || 'full-time'}`}>{(job.job_type || 'Full-time').replace('-', ' ')}</span>
              </div>
              <div className="fjob-footer">
                <span className="fjob-salary">{fmt(job.salary_min, job.salary_max)}</span>
                {job.match_pct && <span className={`chip ${matchColor(job.match_pct)}`}>{job.match_pct}% {t('jobs.match')}</span>}
                <Link to={`/jobs/${job.id}`} className="btn btn-navy btn-sm">{t('jobs.view_details')}</Link>
              </div>
            </Reveal>
          ))
        }
      </div>
    </section>
  )
}

/* ─ How it works ────────────────────────────────────────── */
function How() {
  const { t } = useLanguage()

  const steps = [
    { n: '01', title: t('how.s1_title'), desc: t('how.s1_desc') },
    { n: '02', title: t('how.s2_title'), desc: t('how.s2_desc') },
    { n: '03', title: t('how.s3_title'), desc: t('how.s3_desc') },
    { n: '04', title: t('how.s4_title'), desc: t('how.s4_desc') },
  ]

  return (
    <div id="how" className="how-wrap">
      <Reveal className="how-inner">
        <p className="eyebrow">{t('how.eyebrow')}</p>
        <h2>{t('how.title')}</h2>
        <div className="how-steps">
          {steps.map(({ n, title, desc }, i) => (
            <Reveal key={n} className="how-step" delay={i * 0.1}>
              <div className="how-step-num">{n}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

/* ─ Who it's for ────────────────────────────────────────── */
function Who() {
  const { t } = useLanguage()

  const cards = [
    {
      id: 'worker',
      who: 'worker',
      name: t('who.worker_title'),
      tag: t('who.worker_tag'),
      blurb: t('who.worker_blurb'),
      points: [t('who.worker_p1'), t('who.worker_p2'), t('who.worker_p3')],
      cta: t('who.worker_cta')
    },
    {
      id: 'employer',
      who: 'employer',
      name: t('who.employer_title'),
      tag: t('who.employer_tag'),
      blurb: t('who.employer_blurb'),
      points: [t('who.employer_p1'), t('who.employer_p2'), t('who.employer_p3')],
      cta: t('who.employer_cta')
    },
    {
      id: 'hirer',
      who: 'hirer',
      name: t('who.client_title'),
      tag: t('who.client_tag'),
      blurb: t('who.client_blurb'),
      points: [t('who.client_p1'), t('who.client_p2'), t('who.client_p3')],
      cta: t('who.client_cta')
    }
  ]

  return (
    <section id="who" className="who-wrap">
      <Reveal>
        <p className="eyebrow">{t('who.eyebrow')}</p>
        <h2>{t('who.title')}</h2>
      </Reveal>
      <div className="who-grid">
        {cards.map((c, i) => (
          <Reveal as="article" key={c.id} delay={i * 0.1} className={`who-card w${i}`}>
            <div className="who-av"><Avatar who={c.who} /></div>
            <h3>{c.name}</h3>
            <em>{c.tag}</em>
            <p>{c.blurb}</p>
            <ul>{c.points.map(p => <li key={p}><IconCheck size={14} />{p}</li>)}</ul>
            <Link to={`/register?type=${c.id}`} className="who-link">
              {c.cta} <IconArrow className="arr" />
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/* ─ Towns ───────────────────────────────────────────────── */
function Towns() {
  const { t } = useLanguage()

  return (
    <div id="towns" className="towns-wrap">
      <Reveal className="towns-inner">
        <p className="eyebrow light">{t('towns.eyebrow')}</p>
        <h2>{t('towns.title')}</h2>
        <div className="town-list">
          {TOWNS.map(tName => (
            <Link to={`/jobs?location=${encodeURIComponent(tName)}`} key={tName}>
              <IconPin size={13} />{tName}
            </Link>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

/* ─ CTA ─────────────────────────────────────────────────── */
function CTA() {
  const { t } = useLanguage()

  return (
    <section className="cta-section">
      <Reveal as="h2">{t('cta.title')}</Reveal>
      <Reveal as="p" delay={0.1}>{t('cta.subtitle')}</Reveal>
      <Reveal className="hero-actions" delay={0.2}>
        <Link to="/register" className="btn btn-navy btn-lg">
          {t('cta.create_account')} <IconArrow />
        </Link>
        <Link to="/jobs" className="btn btn-outline btn-lg">
          {t('cta.browse_jobs')}
        </Link>
      </Reveal>
    </section>
  )
}

/* ─ Demo jobs (shown when API is unavailable) ───────────── */
const DEMO_JOBS = [
  { id: 1, title: 'Construction Worker', company: 'Vicor Construction Services', location: 'Calapan City', job_type: 'full-time',    salary_min: 15000, salary_max: 20000, match_pct: 92 },
  { id: 2, title: 'Service Crew',        company: 'Oriental Food Corp',          location: 'Calapan City', job_type: 'part-time',    salary_min: 8000,  salary_max: 12000, match_pct: 75 },
  { id: 3, title: 'Graphic Designer',    company: 'Mindoro Creative Studio',     location: 'Naujan',       job_type: 'freelance',    salary_min: 15000, salary_max: null,  match_pct: 88 },
  { id: 4, title: 'Electrician',         company: 'DMC Home Services',           location: 'Bansud',       job_type: 'contractual',  salary_min: 12000, salary_max: 18000, match_pct: 80 },
  { id: 5, title: 'Welder',             company: 'Mindoro Metal Works',          location: 'Bongabong',    job_type: 'contractual',  salary_min: 12000, salary_max: 18000, match_pct: 73 },
  { id: 6, title: 'Computer Technician', company: 'Tech Mindoro',               location: 'Pinamalayan',  job_type: 'full-time',    salary_min: 18000, salary_max: 25000, match_pct: 82 },
  { id: 7, title: 'Warehouse Staff',    company: 'Rosario Logistics',            location: 'Gloria',       job_type: 'full-time',    salary_min: 13000, salary_max: 16000, match_pct: 65 },
  { id: 8, title: 'Boat Mechanic',      company: 'Puerto Galera Marine',         location: 'Puerto Galera',job_type: 'gig',          salary_min: 500,   salary_max: 2000,  match_pct: 70 },
]

export default function Landing() {
  const { t } = useLanguage()

  return (
    <div className="land">
      <Nav />
      <Hero />
      <Features />
      <FeaturedJobs />
      <How />
      <Who />
      <Towns />
      <CTA />
      <footer className="wrap foot">
        <Logo height={36} />
        <p>© {new Date().getFullYear()} {t('foot.copy')}</p>
        <div className="foot-links">
          <a href="#">{t('foot.about')}</a>
          <a href="#">{t('foot.privacy')}</a>
          <a href="#">{t('foot.terms')}</a>
          <a href="#">{t('foot.contact')}</a>
        </div>
      </footer>
    </div>
  )
}
