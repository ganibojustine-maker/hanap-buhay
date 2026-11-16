import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { AuthLayout, Field, ErrorNote } from '../components/auth.jsx'
import { IconMail, IconCheck } from '../components/icons.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return }
    setBusy(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } })
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not send the reset email. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout back={{ to: "/login", children: "Back to sign in" }} showcase={false}>
      <div className="auth-box">
        <p className="eyebrow">Account recovery</p>
        <h1>Forgot your password?</h1>
        <p className="sub">Enter the email you signed up with and we will send you a link to choose a new password.</p>

        {sent ? (
          <div className="ok-row" style={{ padding: '14px 16px', background: 'var(--green-l)', color: 'var(--green)', borderRadius: 10, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <IconCheck size={18} />
            <span>If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Check your inbox and spam folder. The link expires in 1 hour.</span>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <Field label="Email" icon={<IconMail />}>
              <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <span className="spin" /> : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="switch">Remembered it? <Link to="/login">Back to sign in</Link></p>
      </div>
    </AuthLayout>
  )
}
