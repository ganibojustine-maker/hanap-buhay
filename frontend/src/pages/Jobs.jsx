/**
 * /jobs — the job board for guests.
 *
 * Deliberately lighter than Find Jobs inside the app: a navy search band, then plain
 * cards (role, employer, town, pay, when). No photos, match scores or saving: those come
 * with an account, and a card in the grid says so. Signed-in people are sent to the full
 * board in the dashboard instead (App.jsx).
 *
 * The URL keeps the search (?q=&location=&job_type=), so links from the landing page
 * ("jobs in Baco") open already filtered.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SiteHeader, SiteFooter } from '../components/SiteHeader.jsx'
import { IconSearch, IconPin, IconArrow, IconBriefcase, IconTrend, IconClock } from '../components/icons.jsx'
import { TOWNS } from '../components/art.jsx'
import { useLanguage } from '../i18n.jsx'
import { api } from '../api.js'

const PAGE = 18
const TYPES = [['', 'All'], ['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contractual', 'Contract'], ['freelance', 'Freelance'], ['gig', 'Gig']]
const TYPE_LABEL = Object.fromEntries(TYPES)
const cap = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')
function pay(j) {
  const n = Number(j.salary_min || j.salary_max || 0)
  if (!n) return null
  const unit = { month: '/mo', day: '/day', hour: '/hr', fixed: '' }[j.pay_basis || 'month'] ?? '/mo'
  return `₱${n.toLocaleString('en-PH')}${unit}`
}
function ago(v) {
  const d = new Date(String(v || '').replace(' ', 'T'))
  if (isNaN(d)) return ''
  const days = Math.floor((Date.now() - d) / 864e5)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? `${days} days ago` : days < 30 ? `${Math.floor(days / 7)}w ago` : `${Math.floor(days / 30)}mo ago`
}

function JobTile({ j, i }) {
  const company = cap(j.company || j.employer_name || 'Local employer')
  return (
    <Link to={`/jobs/${j.id}`} className="gj-card" style={{ '--d': `${Math.min(i, 8) * 0.04}s` }}>
      <div className="gj-card-top">
        <span className="gj-co">{company[0]}</span>
        <span className={`gj-type t-${j.job_type || 'full-time'}`}>{TYPE_LABEL[j.job_type] || 'Full-time'}</span>
      </div>
      <h3>{cap(j.title)}</h3>
      <p className="gj-company">{company}</p>
      <p className="gj-meta"><span><IconPin size={13} />{String(j.location || '').split(',')[0] || 'Oriental Mindoro'}</span><span><IconClock size={13} />{ago(j.created_at)}</span></p>
      <div className="gj-card-ft">
        <b>{pay(j) || 'Pay to discuss'}</b>
        <span className="gj-go" aria-hidden="true"><IconArrow size={15} /></span>
      </div>
    </Link>
  )
}

function Promo() {
  const { t } = useLanguage()
  return (
    <div className="gj-promo">
      <span className="gj-promo-ic"><IconTrend size={20} /></span>
      <h3>{t('gj.promo.t', 'See your match for every job')}</h3>
      <p>{t('gj.promo.d', 'Build a free Skills Passport and know what each job needs before you apply.')}</p>
      <Link to="/register?type=worker" className="btn btn-primary">{t('lp.hero.cta')} <IconArrow size={16} /></Link>
    </div>
  )
}

export default function Jobs() {
  const { t } = useLanguage()
  const [params, setParams] = useSearchParams()
  const q0 = params.get('q') || '', loc0 = params.get('location') || '', type0 = (params.get('job_type') || '').split(',')[0]
  const [q, setQ] = useState(q0)
  const [town, setTown] = useState(loc0)
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  // the search itself follows the URL
  useEffect(() => {
    let alive = true
    setBusy(true); setError('')
    const qs = new URLSearchParams({ limit: PAGE, page, sort: 'recent' })
    if (q0) qs.set('q', q0)
    if (loc0) qs.set('location', loc0)
    if (type0) qs.set('job_type', type0)
    api(`/jobs?${qs}`)
      .then(r => { if (!alive) return; setTotal(Number(r.total || 0)); setJobs(prev => (page === 1 ? r.jobs || [] : [...prev, ...(r.jobs || [])])) })
      .catch(e => { if (alive) setError(e.message || 'Could not load jobs.') })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [q0, loc0, type0, page])

  const apply = (next) => {
    const p = new URLSearchParams()
    const v = { q: q.trim(), location: town, job_type: type0, ...next }
    Object.entries(v).forEach(([k, x]) => { if (x) p.set(k, x) })
    setPage(1); setParams(p)
  }
  const reset = () => { setQ(''); setTown(''); setPage(1); setParams(new URLSearchParams()) }
  const filtered = Boolean(q0 || loc0 || type0)

  const cards = jobs.map((j, i) => <JobTile key={j.id} j={j} i={i} />)
  if (cards.length >= 6) cards.splice(6, 0, <Promo key="promo" />)

  return (
    <div className="gj">
      <SiteHeader />
      <section className="gj-hero">
        <div className="lp-in">
          <p className="lp-pill"><i />{total == null ? t('gj.loading', 'Loading open jobs…') : `${total.toLocaleString('en-PH')} ${t('gj.open', 'open jobs')}${loc0 ? ` · ${loc0}` : ''}`}</p>
          <h1>{t('gj.title', 'Open jobs in Oriental Mindoro')}</h1>
          <form className="gj-search" role="search" onSubmit={e => { e.preventDefault(); apply() }}>
            <label className="gj-f">
              <IconSearch size={18} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t('lp.hero.q', 'Job title or skill')} aria-label={t('lp.hero.q', 'Job title or skill')} />
            </label>
            <label className="gj-f gj-f-town">
              <IconPin size={18} />
              <select value={town} onChange={e => { setTown(e.target.value); apply({ location: e.target.value }) }} aria-label={t('lp.hero.anytown', 'Any town')}>
                <option value="">{t('lp.hero.anytown', 'Any town')}</option>
                {TOWNS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button className="btn btn-primary">{t('lp.hero.search', 'Search')}</button>
          </form>
          <div className="gj-types" role="group" aria-label="Job type">
            {TYPES.map(([id, label]) => (
              <button key={id || 'all'} type="button" className={type0 === id ? 'on' : ''} aria-pressed={type0 === id} onClick={() => apply({ job_type: id })}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <main className="lp-in gj-body">
        <div className="gj-bar">
          <span>{busy && page === 1 ? t('gj.searching', 'Searching…') : `${t('gj.showing', 'Showing')} ${jobs.length} ${t('gj.of', 'of')} ${(total ?? 0).toLocaleString('en-PH')} · ${t('gj.newest', 'newest first')}`}</span>
          {filtered && <button type="button" onClick={reset}>{t('gj.clear', 'Clear search')}</button>}
        </div>

        {error ? (
          <div className="gj-empty"><IconBriefcase size={26} /><b>{t('gj.err', 'We couldn’t load jobs just now.')}</b><button type="button" className="btn btn-navy btn-sm" onClick={() => apply()}>{t('gj.retry', 'Try again')}</button></div>
        ) : busy && page === 1 ? (
          <div className="gj-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="gj-card is-sk"><span /><span /><span /><span /></div>)}</div>
        ) : jobs.length ? (
          <>
            <div className="gj-grid">{cards}</div>
            {jobs.length < (total || 0) && (
              <div className="gj-more">
                <button type="button" className="btn btn-light btn-lg" disabled={busy} onClick={() => setPage(p => p + 1)}>
                  {busy ? <span className="spin spin-dark" /> : t('gj.more', 'Show more jobs')}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="gj-empty">
            <IconBriefcase size={26} />
            <b>{t('gj.none', 'No jobs match that search yet.')}</b>
            <span>{t('gj.none2', 'Try another town or a shorter keyword.')}</span>
            <button type="button" className="btn btn-navy btn-sm" onClick={reset}>{t('gj.all', 'See all jobs')}</button>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
