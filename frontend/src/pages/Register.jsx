import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  const chosen = TYPES.find((t) => t.id === type)
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (fe[k]) setFe({ ...fe, [k]: '' }) }

  const goto = (n) => { dir.current = n > step ? 'fwd' : 'back'; setError(''); setStep(n) }

  function validate() {
    const e = {}
    if (f.full_name.trim().length < 2) e.full_name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.'
    if (!passwordChecks(f.password).every(([, ok]) => ok)) e.password = 'Use 8+ characters with at least one letter and one number.'
    return e
  }
  const done = () => { setBusy('done'); setTimeout(() => nav('/dashboard', { replace: true }), 600) }

  async function submit(e) {
    e.preventDefault()
    const v = validate(); setFe(v)
    if (Object.keys(v).length) { setError(''); return }
    setError(''); setBusy('email')
    try { await register({ ...f, full_name: f.full_name.trim(), email: f.email.trim(), account_type: type }); done() }
    catch (err) { setError(err.message); setBusy('') }
  }
  async function viaGoogle() {
    setError(''); setBusy('google')
    try { await google(type); done() } catch (err) { setError(err.message); setBusy('') }
  }

  return (
    <AuthLayout back={step === 1 ? { to: '/', children: 'Back to home' } : { onClick: () => goto(1), children: 'Change account type' }}>
      <div className="auth-box wide">
        <div className="progress" aria-label={`Step ${step} of 2`}>
          <i className="on" /><i className={step === 2 ? 'on' : ''} />
        </div>
        {step === 1 ? (
          <div key="s1" className={`pane ${dir.current === 'back' ? 'from-left' : ''}`}>
            <p className="eyebrow">Step 1 of 2</p>
            <h1>How will you use Hanapbuhay?</h1>
            <p className="sub">Pick the account that fits. It sets up the right tools for you.</p>
            <TypePicker value={type} onChange={setType} />
            <button className="btn btn-primary btn-lg btn-block" disabled={!type} onClick={() => goto(2)}>
              {type ? `Continue as ${chosen.id === 'employer' ? 'an employer' : chosen.id === 'hirer' ? 'a client' : 'a worker'}` : 'Choose an account type'} <IconArrow />
            </button>
            <p className="switch">Already have an account? <Link to="/login">Log in</Link></p>
          </div>
        ) : (
          <div key="s2" className="pane from-right">
            <p className="eyebrow">Step 2 of 2 · {chosen?.name}</p>
            <h1>Create your account</h1>
            <p className="sub">Free to start. No résumé needed.</p>
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
              <p className="fine">By continuing you agree to our Terms and Privacy Notice.</p>
            </form>
            <p className="switch">Already have an account? <Link to="/login">Log in</Link></p>
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
