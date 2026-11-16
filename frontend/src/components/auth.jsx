import { api } from '../api.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo, IconBack, IconCheck, IconAlert, IconLock, IconShield, IconBolt, IconHammer, IconBuilding, IconUsers, IconPin, IconBell, IconMsgCircle, Eye } from './icons.jsx'
import { TYPES } from './art.jsx'

/* ---------- back button: link or handler ---------- */
export function Back({ to, onClick, children = 'Back' }) {
  const inner = <><IconBack size={18} /><span>{children}</span></>
  return to
    ? <Link to={to} className="back">{inner}</Link>
    : <button type="button" className="back" onClick={onClick}>{inner}</button>
}

/* ---------- page shell shared by login, register, onboarding and password pages ----------
   Two columns that fill the screen exactly: the form on the left (it scrolls on its own
   only if a long form doesn't fit), a quiet navy brand panel on the right. One column on
   phones. `side` pins the panel to one account type ('worker', 'employer', 'hirer');
   without it the panel plays through all three. */
export function AuthLayout({ back, showcase = true, side = '', children }) {
  return (
    <div className={`auth ${showcase ? '' : 'solo'}`}>
      <main className="auth-main">
        <div className="auth-top">
          <Logo height={38} />
          {back ? <Back {...back} /> : <span />}
        </div>
        <div className="auth-body">{children}</div>
        <p className="auth-legal">
          © {new Date().getFullYear()} hanapbuhay · <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link> · <Link to="/help">Help</Link>
        </p>
      </main>
      {showcase && <AuthSide kind={side} />}
    </div>
  )
}

/* ---------- brand panel: one small picture of the app per account type ----------
   A white card on navy that shows what each account does, with one line under it.
   Plays through the three on its own; on sign-up it follows the type being picked. */
function SlideWorker() {
  return (
    <div className="sl-card">
      <div className="sl-row">
        <span className="sl-co">M</span>
        <div className="sl-grow"><b>Electrician</b><small><IconPin size={12} /> Calapan City · ₱650/day</small></div>
        <span className="sl-ring" style={{ '--p': 92 }}><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" /><circle className="arc" cx="22" cy="22" r="18" /></svg><b>92%</b></span>
      </div>
      <div className="sl-chips">
        <span className="ok"><IconCheck size={12} /> Wiring</span>
        <span className="ok"><IconCheck size={12} /> Panel install</span>
        <span className="miss">NC II needed</span>
      </div>
      <span className="sl-btn">Apply now</span>
      <span className="sl-float"><IconBell size={13} /> New match</span>
    </div>
  )
}
function SlideEmployer() {
  const rows = [['AR', 'Ana R.', 94], ['MD', 'Mark D.', 88], ['JP', 'Joy P.', 81]]
  return (
    <div className="sl-card">
      <div className="sl-head"><b>Applicants</b><small>Store Cashier</small></div>
      {rows.map(([i, n, m], k) => (
        <div className="sl-row sl-app" key={i} style={{ '--d': `${0.15 + k * 0.12}s` }}>
          <span className="sl-av">{i}</span>
          <div className="sl-grow"><b>{n} <IconShield size={12} /></b><span className="sl-bar"><i style={{ width: `${m}%` }} /></span></div>
          <em>{m}%</em>
        </div>
      ))}
      <span className="sl-float"><IconShield size={13} /> Verified business</span>
    </div>
  )
}
function SlideClient() {
  return (
    <div className="sl-card">
      <span className="sl-urgent"><IconBolt size={12} /> Urgent · Today</span>
      <b className="sl-title">Aircon cleaning</b>
      <small className="sl-sub"><IconPin size={12} /> Pinamalayan · ₱1,500 budget</small>
      <div className="sl-row sl-near">
        <span className="sl-stack"><i>RB</i><i>LC</i><i>EM</i></span>
        <span className="sl-grow">4 workers nearby</span>
        <span className="sl-btn sm">Invite</span>
      </div>
      <span className="sl-float"><IconMsgCircle size={13} /> Replied in 5 min</span>
    </div>
  )
}
const SLIDES = [
  ['worker', 'Jobs that fit your skills.', SlideWorker],
  ['employer', 'Hire the right people, faster.', SlideEmployer],
  ['hirer', 'Get help today, nearby.', SlideClient],
]
const SLIDE_MS = 5000

function AuthSide({ kind }) {
  const pinned = SLIDES.findIndex(([id]) => id === kind)
  const [i, setI] = useState(pinned >= 0 ? pinned : 0)
  useEffect(() => { if (pinned >= 0) setI(pinned) }, [pinned])
  useEffect(() => {
    if (pinned >= 0) return undefined
    const t = setTimeout(() => setI(n => (n + 1) % SLIDES.length), SLIDE_MS)
    return () => clearTimeout(t)
  }, [i, pinned])
  const [, caption, View] = SLIDES[i]

  return (
    <aside className="auth-side" aria-label="What you can do on hanapbuhay">
      <div className="sl-stage" key={i}><View /></div>
      <h2 className="sl-caption" key={`c${i}`}>{caption}</h2>
      <div className={`sl-dots${pinned >= 0 ? ' pinned' : ''}`} role="tablist" aria-label="Slides">
        {SLIDES.map(([id, cap], k) => (
          <button key={id} type="button" role="tab" aria-selected={k === i} aria-label={cap} className={k === i ? 'on' : ''}
            onClick={() => setI(k)} disabled={pinned >= 0}>
            <i key={k === i ? `on${i}` : 'off'} />
          </button>
        ))}
      </div>
    </aside>
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

/* ---------- account type picker ----------
   Three plain choices written the way people think about it ("I'm looking for work"),
   each with one icon. Arrow keys move between them, like any radio group. */
const TYPE_ICON = { worker: IconHammer, employer: IconBuilding, hirer: IconBolt }

export function TypePicker({ value, onChange }) {
  const onKey = (e, i) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = TYPES[(i + step + TYPES.length) % TYPES.length]
    onChange(next.id)
    e.currentTarget.parentElement?.children[(i + step + TYPES.length) % TYPES.length]?.focus()
  }
  return (
    <div className="types" role="radiogroup" aria-label="Account type">
      {TYPES.map((t, i) => {
        const Ic = TYPE_ICON[t.id] || IconUsers
        const on = value === t.id
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} tabIndex={on || (!value && i === 0) ? 0 : -1}
            className={`type ${on ? 'on' : ''}`} onClick={() => onChange(t.id)} onKeyDown={e => onKey(e, i)} style={{ '--d': `${i * 0.05}s` }}>
            <span className="type-ic"><Ic size={22} /></span>
            <span className="type-body">
              <b>{t.ask}</b>
              <small><em>{t.name}</em> · {t.blurb}</small>
            </span>
            <span className="radio" aria-hidden="true"><IconCheck size={13} /></span>
          </button>
        )
      })}
    </div>
  )
}

/* resend the verification link without revealing whether the account exists */
export function ResendVerification({ email }) {
  const [state, setState] = useState('')
  const send = async () => {
    setState('busy')
    try { await api('/auth/resend-verification', { method: 'POST', body: { email } }) } catch { /* same answer either way */ }
    setState('sent')
  }
  if (state === 'sent') return <span style={{ fontWeight: 600, color: 'var(--green)' }}>Sent. Check your inbox.</span>
  return (
    <button type="button" onClick={send} disabled={state === 'busy'}
      style={{ background: 'none', border: 0, padding: 0, color: 'var(--blue)', fontWeight: 700, cursor: 'pointer', font: 'inherit' }}>
      {state === 'busy' ? 'Sending…' : 'Resend the link'}
    </button>
  )
}
