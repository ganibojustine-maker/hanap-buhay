import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Jobs from './pages/Jobs.jsx'
import JobDetail from './pages/JobDetail.jsx'
import JobMap from './pages/JobMap.jsx'
import Training from './pages/Training.jsx'

function Splash() {
  return (
    <div className="splash">
      <span className="spin" />
      Loading your account…
    </div>
  )
}

// Signed-in users go to the app; guests see the page.
function GuestOnly({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <Splash />
  if (user) return <Navigate to={user.account_type || user.role === 'admin' ? '/dashboard' : '/onboarding'} replace />
  return children
}

function Private({ children, needType = true }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <Splash />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (needType && !user.account_type && user.role !== 'admin') return <Navigate to="/onboarding" replace />
  return children
}

// Non-admin route guard: redirects admins to /dashboard
function NonAdminOnly({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return <Splash />
  if (user?.role === 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0) }, [pathname])

  return (
    <Routes>
      {/* Public pages (guests & workers; admins redirect to /dashboard) */}
      <Route path="/" element={<Landing />} />
      <Route path="/jobs" element={<NonAdminOnly><Jobs /></NonAdminOnly>} />
      <Route path="/jobs/:id" element={<NonAdminOnly><JobDetail /></NonAdminOnly>} />
      <Route path="/map" element={<NonAdminOnly><JobMap /></NonAdminOnly>} />
      <Route path="/training" element={<NonAdminOnly><Training /></NonAdminOnly>} />

      {/* Auth */}
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/onboarding" element={<Private needType={false}><Onboarding /></Private>} />

      {/* Protected dashboard — nested routes */}
      <Route path="/dashboard/*" element={<Private><Dashboard /></Private>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
