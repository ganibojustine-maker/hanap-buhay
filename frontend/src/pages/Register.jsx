import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { GoogleBtn, IconMail, IconUser, IconPin, IconArrow, IconCheck } from '../components/icons.jsx'
import { TOWNS, TYPES } from '../components/art.jsx'
import { AuthLayout, Field, PasswordField, ErrorNote, PasswordMeter, TypePicker, passwordChecks } from '../components/auth.jsx'

export default function Register() {
  const { register, google } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const preset = TYPES.some((t) => t.id === params.get('type')) ? params.get('type') : ''
  const [step, setStep] = useState(1)
  const dir = useRef('fwd')
  const [type, setType] = useState(preset)
  const [f, setF] = useState({ full_name: '', email: '', password: '', location: '' })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [fe, setFe] = useState({})
  const [agree, setAgree] = useState(false)
  const loc = useLocation()
  const chosen = TYPES.find((t) => t.id === type)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: '' }) }

  const goto = (n) => { dir.current = n > step ? 'fwd' : 'back'; setError(''); setStep(n) }

  function validate() {
    const e = {}
    if (f.full_name.trim().length < 2) e.full_name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
    if (!passwordChecks(f.password).every(([, ok]) => ok)) e.password = 'Use 8+ characters with at least one letter and one number.'
    if (!agree) e.agree = 'Please tick the box to agree to the Terms of Service and Privacy Policy.'
    return e
  }
  // back to the post they wanted to apply to, if they came from one
  const done = () => { setBusy('done'); setTimeout(() => nav(loc.state?.from || '/dashboard', { replace: true }), 600) }

  async function submit(e) {
    e.preventDefault()
    const v = validate(); setFe(v)
    if (Object.keys(v).length) { setError(''); return }
    setError(''); setBusy('email')
    try { await register({ ...f, full_name: f.full_name.trim(), email: f.email.trim(), account_type: type, accept_terms: agree }); done() }
    catch (err) { setError(err.message); setBusy('') }
  }
  async function viaGoogle() {
    if (!agree) { setFe({ ...fe, agree: 'Please tick the box to agree to the Terms of Service and Privacy Policy.' }); return }
    setError(''); setBusy('google')
    try { await google(type, true); done() } catch (err) { setError(err.message); setBusy('') }
  }

  return (
    <AuthLayout side={type} back={step === 1 ? { to: '/', children: 'Home' } : { onClick: () => goto(1), children: 'Change type' }}>
      <div className="auth-box wide">
        <div className="progress" aria-label={`Step ${step} of 2`}>
          <i className="on" /><i className={step === 2 ? 'on' : ''} />
        </div>
        {step === 1 ? (
          <div key="s1" className={`pane ${dir.current === 'back' ? 'from-left' : ''}`}>
            <p className="eyebrow">Step 1 of 2</p>
            <h1>How will you use hanapbuhay?</h1>
            <p className="sub">Choose one. You get the tools for it.</p>
            <TypePicker value={type} onChange={setType} />
            <button className="btn btn-primary btn-lg btn-block" disabled={!type} onClick={() => goto(2)}>
              {type ? `Continue as ${chosen.id === 'employer' ? 'an employer' : chosen.id === 'hirer' ? 'a client' : 'a job seeker'}` : 'Choose one to continue'} {type && <IconArrow />}
            </button>
            <p className="switch">Already have an account? <Link to="/login" state={loc.state}>Sign in</Link></p>
          </div>
        ) : (
          <div key="s2" className="pane from-right">
            <p className="eyebrow">Step 2 of 2 · {chosen?.name}</p>
            <h1>Create your account</h1>
            <p className="sub">{type === 'employer' ? 'Free to start. Post your first opening today.' : type === 'hirer' ? 'Free to start. Post your first gig today.' : 'Free, always. No résumé needed.'}</p>
            <div className="pf-consent">
              <label>
                <input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); if (fe.agree) setFe({ ...fe, agree: '' }) }} />
                <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and <Link to="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>, including how hanapbuhay uses my information to match me with {type === 'worker' ? 'jobs and gigs' : 'workers'}.</span>
              </label>
              {fe.agree && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: '-8px 0 12px' }}>{fe.agree}</p>}
            </div>
            <GoogleBtn onClick={viaGoogle} busy={busy === 'google'}>Sign up with Google</GoogleBtn>
            <div className="or"><span>or use your email</span></div>
            <form onSubmit={submit} noValidate>
              <Field label="Full name" icon={<IconUser />} error={fe.full_name}>
                <input autoComplete="name" placeholder="Juan Dela Cruz" value={f.full_name} onChange={set('full_name')} />
              </Field>
              <Field label="Email" icon={<IconMail />} error={fe.email}>
                <input type="email" autoComplete="email" placeholder="you@example.com" value={f.email} onChange={set('email')} />
              </Field>
              <PasswordField autoComplete="new-password" placeholder="Create a password" value={f.password} onChange={set('password')} error={fe.password} />
              <PasswordMeter value={f.password} />
              <Field label="Town" optional icon={<IconPin />}>
                <select value={f.location} onChange={set('location')}>
                  <option value="">Choose your town in Oriental Mindoro</option>
                  {TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <ErrorNote>{error}</ErrorNote>
              <button className={`btn btn-primary btn-lg btn-block ${busy === 'done' ? 'is-done' : ''}`} disabled={!!busy}>
                {busy === 'email' ? <span className="spin" /> : busy === 'done' ? <><IconCheck size={20} /> Account created</> : 'Create account'}
              </button>
              <p className="fine">We never share your mobile number or email with the public. <Link to="/privacy" target="_blank" rel="noreferrer">How we protect your data</Link>.</p>
            </form>
            <p className="switch">Already have an account? <Link to="/login" state={loc.state}>Sign in</Link></p>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
