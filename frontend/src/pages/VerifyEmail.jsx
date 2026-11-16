import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { AuthLayout } from '../components/auth.jsx'
import { IconCheck, IconAlert } from '../components/icons.jsx'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const token = params.get('token') || ''
  const [state, setState] = useState(token ? 'busy' : 'error')
  const [msg, setMsg] = useState(token ? '' : 'This verification link is missing its token.')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => {
        setState('ok')
        setTimeout(() => navigate('/dashboard', { replace: true }), 1400)
      })
      .catch((err) => {
        setState('error')
        setMsg(err.message || 'This verification link is invalid or has expired.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <AuthLayout back={{ to: '/login', children: 'Back to sign in' }} showcase={false}>
      <div className="auth-box">
        <p className="eyebrow">Email verification</p>
        {state === 'busy' && (<><h1>Verifying your email…</h1><p className="sub">This only takes a moment.</p></>)}
        {state === 'ok' && (
          <>
            <h1>Email verified</h1>
            <div style={{ padding: '14px 16px', background: 'var(--green-l)', color: 'var(--green)', borderRadius: 10, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}>
              <IconCheck size={18} /> Your account is active. Taking you to your dashboard…
            </div>
          </>
        )}
        {state === 'error' && (
          <>
            <h1>Link not valid</h1>
            <div style={{ padding: '14px 16px', background: 'var(--red-l)', color: 'var(--red)', borderRadius: 10, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <IconAlert size={18} /> <span>{msg}</span>
            </div>
            <p className="switch">Go to <Link to="/login">sign in</Link> and we can send you a new link.</p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
