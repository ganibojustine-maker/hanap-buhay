import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { AuthLayout, PasswordField, PasswordMeter, ErrorNote } from '../components/auth.jsx'
import { IconCheck } from '../components/icons.jsx'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password needs 8+ characters with at least one letter and one number.'); return
    }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } })
      setDone(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout back={{ to: "/login", children: "Back to sign in" }} showcase={false}>
      <div className="auth-box">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        {!token ? (
          <>
            <ErrorNote>This reset link is missing its token. Please request a new one.</ErrorNote>
            <p className="switch"><Link to="/forgot-password">Request a new link</Link></p>
          </>
        ) : done ? (
          <div style={{ padding: '14px 16px', background: 'var(--green-l)', color: 'var(--green)', borderRadius: 10, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconCheck size={18} /> Password updated. Taking you to sign in…
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <PasswordField label="New password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            <PasswordMeter value={password} />
            <PasswordField label="Confirm new password" autoComplete="new-password" placeholder="Repeat the password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <ErrorNote>{error}</ErrorNote>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? <span className="spin" /> : 'Update password'}
            </button>
          </form>
        )}
        <p className="switch"><Link to="/login">Back to sign in</Link></p>
      </div>
    </AuthLayout>
  )
}
