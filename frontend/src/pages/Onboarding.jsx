import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { IconArrow } from '../components/icons.jsx'
import { AuthLayout, ErrorNote, TypePicker } from '../components/auth.jsx'

// Shown to Google sign-ins that haven't picked an account type yet.
export default function Onboarding() {
  const { user, chooseType, logout } = useAuth()
  const nav = useNavigate()
  const [type, setType] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user.account_type) return <Navigate to="/dashboard" replace />

  async function save() {
    setBusy(true); setError('')
    try { await chooseType(type); nav('/dashboard', { replace: true }) }
    catch (e) { setError(e.message); setBusy(false) }
  }
  return (
    <AuthLayout showcase={false} back={{ onClick: logout, children: 'Sign out' }}>
      <div className="auth-box wide">
        <p className="eyebrow rise">Welcome, {user.full_name?.split(' ')[0] || 'friend'}</p>
        <h1 className="rise" style={{ '--d': '.05s' }}>How will you use Hanapbuhay?</h1>
        <p className="sub rise" style={{ '--d': '.1s' }}>One last step. This sets up the right tools for you.</p>
        <TypePicker value={type} onChange={setType} />
        <ErrorNote>{error}</ErrorNote>
        <button className="btn btn-primary btn-lg btn-block" disabled={!type || busy} onClick={save}>
          {busy ? <span className="spin" /> : <>Continue <IconArrow /></>}
        </button>
      </div>
    </AuthLayout>
  )
}
