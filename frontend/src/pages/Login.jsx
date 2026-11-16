import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { GoogleBtn, IconMail, IconCheck } from '../components/icons.jsx'
import { AuthLayout, Field, PasswordField, ErrorNote, ResendVerification } from '../components/auth.jsx'

export default function Login() {
  const { login, google } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [unverified, setUnverified] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [fe, setFe] = useState({})

  const go = (r) => {
    setBusy('done')
    const dest = r.user.account_type || r.user.role === 'admin' ? (loc.state?.from || '/dashboard') : '/onboarding'
    setTimeout(() => nav(dest, { replace: true }), 550)
  }

  async function submit(e) {
    e.preventDefault()
    const f = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) f.email = 'Enter a valid email address.'
    if (!password) f.password = 'Enter your password.'
    setFe(f)
    if (Object.keys(f).length) { setError(''); return }
    setError(''); setBusy('email')
    try { go(await login(email.trim(), password, remember)) } catch (err) {
      if (err?.data?.code === 'unverified') setUnverified(err.data.email || email.trim())
      setError(err.message); setBusy('')
    }
  }
  async function viaGoogle() {
    setError(''); setBusy('google')
    try { go(await google()) } catch (err) { setError(err.message); setBusy('') }
  }

  return (
    <AuthLayout back={{ to: '/', children: 'Home' }}>
      <div className="auth-box">
        <h1 className="rise">Welcome back</h1>
        <p className="sub rise" style={{ '--d': '.05s' }}>Sign in to see your jobs, applications and messages.</p>

        <div className="rise" style={{ '--d': '.15s' }}>
          <GoogleBtn onClick={viaGoogle} busy={busy === 'google'}>Continue with Google</GoogleBtn>
          <div className="or"><span>or sign in with email</span></div>
        </div>

        <form onSubmit={submit} noValidate className="rise" style={{ '--d': '.2s' }}>
          <Field label="Email" icon={<IconMail />} error={fe.email}>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email}
              onChange={(e) => { setEmail(e.target.value); setFe({ ...fe, email: '' }) }} />
          </Field>
          <PasswordField autoComplete="current-password" placeholder="Your password" value={password} error={fe.password}
            onChange={(e) => { setPassword(e.target.value); setFe({ ...fe, password: '' }) }} />
          <div className="opts">
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <ErrorNote>{error}</ErrorNote>
          {unverified && <p className="switch" style={{ marginTop: 6 }}>Didn't get the link? <ResendVerification email={unverified} /></p>}
          <button className={`btn btn-primary btn-lg btn-block ${busy === 'done' ? 'is-done' : ''}`} disabled={!!busy}>
            {busy === 'email' ? <span className="spin" /> : busy === 'done' ? <><IconCheck size={20} /> Signed in</> : 'Sign in'}
          </button>
        </form>
        <p className="switch">New to hanapbuhay? <Link to="/register">Create a free account</Link></p>
      </div>
    </AuthLayout>
  )
}
