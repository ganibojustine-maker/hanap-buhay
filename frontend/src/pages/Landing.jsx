/**
 * Landing — the public front page.
 *
 *   Header    SiteHeader (shared with every public page)
 *   Hero      promise + two buttons; the real map of Oriental Mindoro with live job counts
 *   Hiring    a slow ticker of real open jobs
 *   Roles     three accounts, one line each
 *   Features  four differences, one at a time: a list and a single quiet picture
 *   Employers a hiring board that runs on its own (New → Shortlist → Hired)
 *   How · CTA · Footer
 *
 * All job numbers are live. Copy lives in i18n.jsx (`lh.*`, `lp.*`), English and Filipino.
 */
import { useEffect, useState } from 'react'
import BrowsePosts from '../components/BrowsePosts.jsx'
import { Link, useLocation } from 'react-router-dom'
import {
  IconArrow, IconPin, IconHammer, IconBuilding, IconBolt, IconCheck, IconShield, IconBook,
  IconTrend, IconQr, IconAlert, IconSearch, IconFile, IconStar, IconBell,
} from '../components/icons.jsx'
import Reveal from '../components/Reveal.jsx'
import MindoroMap from '../components/MindoroMap.jsx'
import { SiteHeader, SiteFooter } from '../components/SiteHeader.jsx'
import { useInView } from '../hooks/useInView.js'
import { useLanguage } from '../i18n.jsx'
import { api } from '../api.js'

const cap = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '')
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
function payLine(j) {
  const n = Number(j.salary_min || j.salary_max || 0)
  if (!n) return null
  const unit = { month: '/mo', day: '/day', hour: '/hr', fixed: '' }[j.pay_basis || 'month'] ?? '/mo'
  return `₱${n.toLocaleString('en-PH')}${unit}`
}
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ─ Hero ────────────────────────────────────────────────── */
function Hero({ live, towns }) {
  const { t } = useLanguage()
  const total = towns?.total ?? live?.total
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-in lp-hero-in">
        <div className="lp-copy">
          <p className="lp-pill rise"><i />{t('lp.hero.eyebrow')}</p>
          <h1 id="lp-title" className="rise" style={{ '--d': '.06s' }}>
            {t('lp.hero.title_a')} <span>{t('lp.hero.title_b')}</span>
          </h1>
          <p className="lp-lede rise" style={{ '--d': '.12s' }}>{t('lp.hero.lede')}</p>
          <div className="lp-actions rise" style={{ '--d': '.18s' }}>
            <Link to="/register" className="btn btn-primary btn-lg">{t('lp.hero.cta')} <IconArrow /></Link>
            <Link to="/jobs" className="btn lp-ghost btn-lg">{t('lp.hero.browse')}</Link>
          </div>
          <ul className="lp-trust rise" style={{ '--d': '.24s' }}>
            {['t1', 't2', 't3'].map(k => <li key={k}><IconCheck size={15} />{t(`lp.hero.${k}`)}</li>)}
          </ul>
        </div>
        <div className="lp-map rise" style={{ '--d': '.1s' }}>
          <span className="lp-radar" aria-hidden="true"><i /><i /><i /></span>
          <MindoroMap counts={towns?.towns || {}} jobs={live?.jobs || []} t={t} />
          {total != null && (
            <p className="lp-legend"><i />{fill(t('lp.map.legend'), { n: Number(total).toLocaleString('en-PH') })}<span>{t('lp.map.hint')}</span></p>
          )}
        </div>
      </div>
    </section>
  )
}

/* ─ Hiring now: a slow ticker of real openings ──────────── */
function HiringNow({ live }) {
  const { t } = useLanguage()
  const jobs = (live?.jobs || []).slice(0, 14)
  if (!jobs.length) return null
  const row = copy => jobs.map(j => (
    <Link key={j.id} to={`/jobs/${j.id}`} className="lp-tick" tabIndex={copy ? -1 : undefined}>
      <b>{cap(j.title)}</b>
      <span><IconPin size={12} />{String(j.location || '').split(',')[0]}</span>
      {payLine(j) && <em>{payLine(j)}</em>}
    </Link>
  ))
  return (
    <section className="lp-now" aria-label={t('lp.now.title')}>
      <div className="lp-in lp-now-in">
        <span className="lp-now-label"><i />{t('lp.now.title')}</span>
        <div className="lp-marquee">
          <div className="lp-track">{row(false)}<span aria-hidden="true" className="lp-track-copy">{row(true)}</span></div>
        </div>
        <Link to="/jobs" className="lp-now-all">{t('lp.now.all')} <IconArrow size={14} /></Link>
      </div>
    </section>
  )
}

/* ─ Roles ───────────────────────────────────────────────── */
const ROLES = [['worker', IconHammer], ['employer', IconBuilding], ['hirer', IconBolt]]
function Roles() {
  const { t } = useLanguage()
  return (
    <section className="lp-sec" id="roles" aria-labelledby="lp-roles">
      <div className="lp-in">
        <Reveal as="h2" className="lp-h2" id="lp-roles">{t('lp.roles.title')}</Reveal>
        <div className="lp-roles">
          {ROLES.map(([id, Ic], i) => (
            <Reveal key={id} delay={i * 0.06}>
              <Link to={`/register?type=${id}`} className="lp-role">
                <span className="lp-ic"><Ic size={22} /></span>
                <h3>{t(`lp.roles.${id}.title`)}</h3>
                <p>{t(`lp.roles.${id}.desc`)}</p>
                <span className="lp-go">{t(`lp.roles.${id}.cta`)} <IconArrow size={15} /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─ Features: one feature at a time ───────────────────────
   A list on the left, one quiet picture on the right. It moves on by itself every few
   seconds (a thin line shows the time) and stops as soon as someone points at it. ─ */
function FeatPic({ k, t }) {
  if (k === 'passport') return (
    <div className="fp-pass">
      <div className="fp-pass-top"><span className="fp-mark">HB</span><small>SKILLS PASSPORT</small><IconQr size={18} /></div>
      <b>Juan Dela Cruz</b>
      <span>Electrician · Calapan City</span>
      <div className="fp-chips"><i>Wiring</i><i>Solar PV</i><i>Panel install</i></div>
      <div className="fp-pass-ft"><span><IconShield size={14} /> {t('lp.why.verified')}</span><em>NC II · TESDA</em></div>
    </div>
  )
  if (k === 'match') return (
    <div className="fp-card fp-match">
      <span className="fp-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" /><circle className="arc" cx="40" cy="40" r="34" /></svg><b>86%</b></span>
      <div>
        <b className="fp-title">Electrician · Pola</b>
        <ul className="fp-list">
          <li className="ok"><IconCheck size={14} /> Wiring</li>
          <li className="ok"><IconCheck size={14} /> 3 yrs experience</li>
          <li className="miss"><IconAlert size={14} /> NC II missing</li>
        </ul>
      </div>
    </div>
  )
  if (k === 'verify') return (
    <div className="fp-card fp-verify">
      <div className="fp-doc"><span><IconFile size={18} /></span><div><b>TESDA NC II certificate</b><small>Electrical Installation</small></div></div>
      <ul className="fp-steps">
        {['v1', 'v2', 'v3'].map((v, i) => <li key={v} style={{ '--d': `${0.15 + i * 0.15}s` }}><span><IconCheck size={12} /></span>{t(`lp.why.${v}`)}</li>)}
      </ul>
    </div>
  )
  return (
    <div className="fp-card fp-train">
      <div className="fp-doc"><span className="gold"><IconBook size={18} /></span><div><b>Electrical Installation NC II</b><small>TESDA · Calapan City · {t('lp.why.free')}</small></div></div>
      <div className="fp-prog"><div><span>{t('lp.why.after')}</span><em>72% → 95%</em></div><span className="fp-track"><i /></span></div>
    </div>
  )
}

const FEATS = [['passport', IconShield], ['match', IconTrend], ['verify', IconCheck], ['train', IconBook]]
function Features() {
  const { t } = useLanguage()
  const [ref, seen] = useInView({ threshold: 0.3 })
  const [i, setI] = useState(0)
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!seen || held || reduced()) return undefined
    const id = setTimeout(() => setI(n => (n + 1) % FEATS.length), 6000)
    return () => clearTimeout(id)
  }, [i, seen, held])
  const k = FEATS[i][0]
  return (
    <section className="lp-sec lp-dark" id="features" aria-labelledby="lp-why">
      <div className="lp-in">
        <Reveal as="h2" className="lp-h2" id="lp-why">{t('lp.why.title')}</Reveal>
        <div ref={ref} className="fs" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
          <div className="fs-list" role="tablist" aria-label={t('lh.features')}>
            {FEATS.map(([id, Ic], n) => (
              <button key={id} type="button" role="tab" aria-selected={n === i} aria-controls="fs-panel"
                className={`fs-item${n === i ? ' on' : ''}`} onClick={() => setI(n)} onFocus={() => setI(n)}>
                <span className="fs-ic"><Ic size={18} /></span>
                <span className="fs-txt"><b>{t(`lp.why.${id}.t`)}</b><small>{t(`lp.why.${id}.d`)}</small></span>
                {n === i && seen && !held && <i className="fs-time" key={`t${i}`} />}
              </button>
            ))}
          </div>
          <div className="fs-panel" id="fs-panel" role="tabpanel">
            <div className="fs-stage" key={k}><FeatPic k={k} t={t} /></div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─ For employers: a hiring board that runs on its own ─── */
const PEOPLE = { AR: ['Ana R.', 94], MD: ['Mark D.', 88], JP: ['Joy P.', 81], RL: ['Rico L.', 76] }
const FRAMES = [
  { cols: [['AR', 'MD', 'JP'], [], []] },
  { cols: [['RL', 'AR', 'MD', 'JP'], [], []], toast: 'RL' },
  { cols: [['RL', 'MD', 'JP'], ['AR'], []] },
  { cols: [['RL', 'JP'], ['AR', 'MD'], []] },
  { cols: [['RL', 'JP'], ['MD'], ['AR']], hired: 'AR' },
  { cols: [['RL', 'JP'], ['MD'], ['AR']], hired: 'AR', hold: true },
]
function HiringBoard() {
  const { t } = useLanguage()
  const [ref, seen] = useInView({ threshold: 0.3 })
  const [f, setF] = useState(0)
  useEffect(() => {
    if (!seen) return undefined
    if (reduced()) { setF(4); return undefined }
    const id = setInterval(() => setF(n => (n + 1) % FRAMES.length), 1700)
    return () => clearInterval(id)
  }, [seen])
  const fr = FRAMES[f]
  const names = [t('lp.emp.col1'), t('lp.emp.col2'), t('lp.emp.col3')]
  return (
    <div ref={ref} className="hb">
      <div className="hb-top">
        <span className="hb-live"><i />{t('lp.emp.board')}</span>
        <span className="hb-job">Store Cashier · Calapan City</span>
      </div>
      <div className="hb-cols">
        {fr.cols.map((ids, c) => (
          <div key={c} className={`hb-col c${c}`}>
            <div className="hb-col-hd"><span>{names[c]}</span><em>{ids.length}</em></div>
            {ids.map(id => (
              <div key={`${id}-${c}`} className={`hb-card${fr.hired === id && c === 2 ? ' won' : ''}`}>
                <span className="hb-av">{id}</span>
                <div className="hb-who"><b>{PEOPLE[id][0]}</b><span className="hb-m"><i style={{ width: `${PEOPLE[id][1]}%` }} /></span></div>
                <em>{PEOPLE[id][1]}%</em>
                {fr.hired === id && c === 2 && <span className="hb-won"><IconCheck size={11} /></span>}
              </div>
            ))}
          </div>
        ))}
      </div>
      {fr.toast && (
        <div className="hb-toast" key={`t${f}`}>
          <span><IconBell size={14} /></span>
          <div><b>{t('lp.emp.newapp')}</b><small>{PEOPLE[fr.toast][0]} · {PEOPLE[fr.toast][1]}% match</small></div>
        </div>
      )}
      {fr.hired && !fr.hold && <div className="hb-hired" key={`h${f}`}><IconStar size={14} /> {t('lp.emp.hired')}</div>}
    </div>
  )
}

function Employers() {
  const { t } = useLanguage()
  const points = [[IconFile, 'p1'], [IconTrend, 'p2'], [IconSearch, 'p3'], [IconShield, 'p4']]
  return (
    <section className="lp-sec" id="employers" aria-labelledby="lp-emp">
      <div className="lp-in lp-emp">
        <Reveal className="lp-emp-copy">
          <p className="lp-kicker">{t('lp.emp.kicker')}</p>
          <h2 id="lp-emp">{t('lp.emp.title')}</h2>
          <ul>
            {points.map(([Ic, k]) => <li key={k}><span><Ic size={16} /></span>{t(`lp.emp.${k}`)}</li>)}
          </ul>
          <div className="lp-emp-cta">
            <Link to="/register?type=employer" className="btn btn-navy btn-lg">{t('lp.emp.cta')} <IconArrow /></Link>
            <Link to="/register?type=hirer" className="lp-textlink">{t('lp.emp.gig')} <IconArrow size={14} /></Link>
          </div>
        </Reveal>
        <Reveal className="lp-emp-vis" delay={0.1}>
          <HiringBoard />
          <span className="ea-chip"><IconShield size={13} /> {t('lp.emp.verified')}</span>
        </Reveal>
      </div>
    </section>
  )
}

/* ─ How ─────────────────────────────────────────────────── */
function How() {
  const { t } = useLanguage()
  return (
    <section className="lp-sec lp-soft" id="how" aria-labelledby="lp-how">
      <div className="lp-in">
        <Reveal as="h2" className="lp-h2" id="lp-how">{t('lp.how.title')}</Reveal>
        <ol className="lp-steps">
          {[1, 2, 3].map(n => (
            <Reveal as="li" key={n} delay={(n - 1) * 0.08}>
              <span className="lp-num">{n}</span>
              <h3>{t(`lp.how.${n}t`)}</h3>
              <p>{t(`lp.how.${n}d`)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Cta() {
  const { t } = useLanguage()
  return (
    <section className="lp-in lp-cta-wrap">
      <Reveal className="lp-cta">
        <h2>{t('lp.cta.title')}</h2>
        <p>{t('lp.cta.lede')}</p>
        <div className="lp-cta-btns">
          <Link to="/register?type=worker" className="btn btn-primary btn-lg">{t('lp.cta.work')} <IconArrow /></Link>
          <Link to="/register?type=employer" className="btn lp-ghost btn-lg">{t('lp.cta.hire')}</Link>
        </div>
      </Reveal>
    </section>
  )
}

export default function Landing() {
  const { hash } = useLocation()
  const [live, setLive] = useState(null)
  const [towns, setTowns] = useState(null)
  useEffect(() => {
    let alive = true
    api('/jobs?limit=50&sort=recent')
      .then(r => { if (alive) setLive({ total: Number(r.total || 0), jobs: r.jobs || [] }) })
      .catch(() => { if (alive) setLive({ total: null, jobs: [] }) })
    api('/jobs/towns')
      .then(r => { if (alive) setTowns({ towns: r.towns || {}, total: Number(r.total || 0) }) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  // arriving from another page with /#features etc.
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [hash])

  return (
    <div className="lp">
      <SiteHeader />
      <main>
        <Hero live={live} towns={towns} />
        <HiringNow live={live} />
        <BrowsePosts />
        <Roles />
        <Features />
        <Employers />
        <How />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  )
}
