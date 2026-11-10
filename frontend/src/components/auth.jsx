import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo, IconBack, IconBolt, IconHammer, IconWrench, IconCheck, IconAlert, IconBook, IconPin, IconLock, Eye } from './icons.jsx'
import { Avatar, Seascape, TYPES } from './art.jsx'

/* ---------- back button: link or handler ---------- */
export function Back({ to, onClick, children = 'Back' }) {
  const inner = <><IconBack size={18} /><span>{children}</span></>
  return to
    ? <Link to={to} className="back">{inner}</Link>
    : <button type="button" className="back" onClick={onClick}>{inner}</button>
}

/* ---------- page shell shared by login, register and onboarding ---------- */
export function AuthLayout({ back, showcase = true, children }) {
  return (
    <div className={`auth ${showcase ? '' : 'solo'}`}>
      <main className="auth-main">
        <div className="auth-top">
          {back ? <Back {...back} /> : <span />}
          <Logo />
        </div>
        {children}
      </main>
      {showcase && <Showcase />}
    </div>
  )
}

/* ---------- field ---------- */
export function Field({ label, optional, icon, error, good, children }) {
  return (
    <label className={`field ${error ? 'bad' : ''} ${good ? 'good' : ''}`}>
      <span>{label}{optional && <em>Optional</em>}</span>
      <div className="in">{icon}{children}</div>
      {error && <p className="hint" role="alert">{error}</p>}
    </label>
  )
}

export function PasswordField({ label = 'Password', error, ...input }) {
  const [show, setShow] = useState(false)
  return (
    <label className={`field ${error ? 'bad' : ''}`}>
      <span>{label}</span>
      <div className="in pw"><IconLock />
        <input {...input} type={show ? 'text' : 'password'} />
        <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Eye off={show} /></button>
      </div>
      {error && <p className="hint" role="alert">{error}</p>}
    </label>
  )
}

export function ErrorNote({ children }) {
  if (!children) return null
  return <p className="error" role="alert" key={children}><IconAlert size={18} />{children}</p>
}

/* ---------- password strength ---------- */
export function passwordChecks(p) {
  return [['8+ characters', p.length >= 8], ['A letter', /[A-Za-z]/.test(p)], ['A number', /\d/.test(p)]]
}
export function PasswordMeter({ value }) {
  if (!value) return null
  const checks = passwordChecks(value)
  const score = checks.filter(([, ok]) => ok).length + (value.length >= 12 && /[^A-Za-z0-9]/.test(value) ? 1 : 0)
  const label = ['', 'Weak', 'Okay', 'Good', 'Strong'][score] || 'Weak'
  return (
    <div className={`pwm s${score}`} aria-live="polite">
      <div className="pwm-bar">{[1, 2, 3, 4].map((n) => <i key={n} className={n <= score ? 'on' : ''} />)}</div>
      <div className="pwm-meta">
        <ul>{checks.map(([t, ok]) => <li key={t} className={ok ? 'ok' : ''}><IconCheck size={13} />{t}</li>)}</ul>
        <b>{label}</b>
      </div>
    </div>
  )
}

/* ---------- account type picker (illustrated) ---------- */
export function TypePicker({ value, onChange }) {
  return (
    <div className="types" role="radiogroup" aria-label="Account type">
      {TYPES.map((t, i) => (
        <button key={t.id} type="button" role="radio" aria-checked={value === t.id}
          className={`type ${value === t.id ? 'on' : ''}`} onClick={() => onChange(t.id)} style={{ '--d': `${i * 0.07}s` }}>
          <span className="type-av"><Avatar who={t.who} /></span>
          <span className="type-body">
            <b>{t.name}<em>{t.tag}</em></b>
            <small>{t.blurb}</small>
          </span>
          <span className="radio"><IconCheck size={14} /></span>
        </button>
      ))}
    </div>
  )
}

/* ---------- right-hand panel: auto-playing product story ---------- */
const SLIDES = [
  ['Match skills with real work.', 'Build your Skills Passport once and get matched with jobs and gigs across Oriental Mindoro.'],
  ['Know exactly what’s missing.', 'A high score never hides a missing license. We tell you first, in plain words.'],
  ['Learn what’s next, near you.', 'Training suggestions that close your gaps, listed by place, length and cost.'],
]
function SlideMatch() {
  return (
    <div className="sc-slide-in">
      <svg className="sc-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M13 20C24 20 24 32 36 32" /><path d="M13 50H36" /><path d="M13 80C24 80 24 68 36 68" />
      </svg>
      {[[IconBolt, 14], [IconHammer, 44], [IconWrench, 74]].map(([I, top], k) => (
        <span className="sc-ic" style={{ top: `${top}%`, '--d': `${k * 0.15}s` }} key={k}><I size={22} /></span>
      ))}
      <div className="sc-card" style={{ background: '#FFFFFF', color: '#1E293B', boxShadow: '0 20px 45px rgba(0,0,0,0.35)', border: '1px solid #E2E8F0', zIndex: 10 }}>
        <div className="dots3"><i /><i /><i /></div>
        {[['rey', 'Justine', 'Electrician', 94], ['ben', 'Bhenjay', 'Carpenter', 88], ['jun', 'BrixLee', 'Boat mechanic', 76]].map(([w, n, t, m], k) => (
          <div className="sc-row" key={w} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #E5E7EB', opacity: 1 }}>
            <span className="sc-av"><Avatar who={w} /></span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <b style={{ display: 'block', color: '#0A2557', fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{n}</b>
              <small style={{ display: 'block', color: '#475569', fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{t}</small>
            </div>
            <span className="chip ok" style={{ fontWeight: 800, fontSize: 12, color: '#166534', background: '#DCFCE7', padding: '3px 8px', borderRadius: 9999 }}>{m}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function SlideGap() {
  return (
    <div className="sc-slide-in single">
      <div className="sc-card" style={{ background: '#FFFFFF', color: '#1E293B', boxShadow: '0 20px 45px rgba(0,0,0,0.35)', border: '1px solid #E2E8F0' }}>
        <div className="sc-head"><div className="mini-ring" style={{ '--p': 95 }}><span>95%</span></div><div style={{ textAlign: 'left' }}><b style={{ color: '#0A2557', fontSize: 16, fontWeight: 800 }}>Electrician</b><small style={{ color: '#475569', fontWeight: 600 }}>Calapan City · Full-time</small></div></div>
        <div className="alert" style={{ '--d': '.25s' }}><IconAlert size={18} /><div><b style={{ color: '#991B1B', fontWeight: 800 }}>Required license missing</b><small style={{ color: '#7F1D1D', fontWeight: 600 }}>TESDA NC II (Electrical Installation)</small></div></div>
        <p className="ok-row" style={{ '--d': '.4s', color: '#166534', fontWeight: 600 }}><IconCheck /> Wiring and panel installation</p>
        <p className="ok-row" style={{ '--d': '.5s', color: '#166534', fontWeight: 600 }}><IconCheck /> 3 years on residential jobs</p>
      </div>
    </div>
  )
}
function SlideTrain() {
  return (
    <div className="sc-slide-in single">
      <div className="sc-card" style={{ background: '#FFFFFF', color: '#1E293B', boxShadow: '0 20px 45px rgba(0,0,0,0.35)', border: '1px solid #E2E8F0' }}>
        <div className="dots3"><i /><i /><i /></div>
        {[['TESDA NC II · Electrical', 'Calapan City · 3 months', 'Free'], ['Solar PV Basics', 'Pinamalayan · 2 weeks', '₱1,500']].map(([t, s, c], k) => (
          <div className="sc-row" key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #E5E7EB', opacity: 1 }}>
            <span className="st-ic blue"><IconBook size={18} /></span>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <b style={{ display: 'block', color: '#0A2557', fontSize: 14, fontWeight: 800 }}>{t}</b>
              <small style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569', fontSize: 12, fontWeight: 600 }}><IconPin size={12} /> {s}</small>
            </div>
            <span className="chip blue" style={{ fontWeight: 800 }}>{c}</span>
          </div>
        ))}
        <p className="st-lab" style={{ marginTop: 10, color: '#64748B', fontWeight: 700 }}>Match after training</p>
        <div className="bar"><i style={{ '--w': '95%' }} /></div>
      </div>
    </div>
  )
}
const SLIDE_VIEWS = [SlideMatch, SlideGap, SlideTrain]

export function Showcase() {
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  useEffect(() => {
    if (hold) return
    const t = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 5200)
    return () => clearTimeout(t)
  }, [i, hold])
  return (
    <aside className="showcase" aria-label="Product highlights" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
      <Seascape />
      <div className="sc-stage">
        {SLIDE_VIEWS.map((V, k) => (
          <div key={k} className={`sc-slide ${k === i ? 'on' : ''}`} aria-hidden={k !== i}>{k === i && <V />}</div>
        ))}
      </div>
      <div className="sc-copy">
        {SLIDES.map(([h, p], k) => (
          <div key={h} className={`sc-text ${k === i ? 'on' : ''}`} aria-hidden={k !== i}><h2>{h}</h2><p>{p}</p></div>
        ))}
      </div>
      <div className="dots" role="tablist" aria-label="Slides">
        {SLIDES.map(([h], k) => (
          <button key={h} role="tab" aria-selected={k === i} aria-label={h} className={k === i ? 'on' : ''} onClick={() => setI(k)}><i /></button>
        ))}
      </div>
    </aside>
  )
}
