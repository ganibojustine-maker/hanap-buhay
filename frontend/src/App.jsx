import { useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Landing from './pages/Landing.jsx'
import AppUpdate from './components/AppUpdate.jsx'
import TopProgress from './components/TopProgress.jsx'
import PageErrorBoundary from './components/PageErrorBoundary.jsx'
import DataNotice from './components/DataNotice.jsx'

// Landing ships with the app; every other page is its own download, fetched when it is
// first opened. JobMap brings the map library and Messages brings Firebase only then.
const Login          = lazy(() => import('./pages/Login.jsx'))
const Register       = lazy(() => import('./pages/Register.jsx'))
const Onboarding     = lazy(() => import('./pages/Onboarding.jsx'))
const Dashboard      = lazy(() => import('./pages/Dashboard.jsx'))
const Jobs           = lazy(() => import('./pages/Jobs.jsx'))
const JobDetail      = lazy(() => import('./pages/JobDetail.jsx'))
const JobMap         = lazy(() => import('./pages/JobMap.jsx'))
const Training       = lazy(() => import('./pages/Training.jsx'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
const ResetPassword  = lazy(() => import('./pages/ResetPassword.jsx'))
const VerifyEmail    = lazy(() => import('./pages/VerifyEmail.jsx'))
const Privacy        = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.Privacy })))
const Terms          = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.Terms })))
const About          = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.About })))
const Help           = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.Help })))
const Faq            = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.Faq })))
const NotFound       = lazy(() => import('./pages/Legal.jsx').then(m => ({ default: m.NotFound })))
const PublicPassport = lazy(() => import('./pages/PublicPassport.jsx'))

// Same look as the boot screen in index.html, so going from one to the other doesn't flash.
// Rarely seen now: a returning visitor's session is restored from the device (auth.jsx).
function Splash({ label = 'Loading your account…' }) {
  return (
    <div className="boot-splash" role="status" aria-live="polite">
      <div>
        <img className="boot-logo" src="/images/logo-light.png" alt="hanapbuhay" width="240" />
        <span>{label}</span>
      </div>
    </div>
  )
}

// The dashboard's code comes in two parts (the shell, then the pages for the person's role).
// Fetch both at once instead of one after the other.
function prefetchDashboard(user) {
  import('./pages/Dashboard.jsx')
  if (user.role === 'admin') import('./pages/dashboard/AdminPages.jsx')
  else if (user.account_type === 'hirer') import('./pages/dashboard/client/ClientPages.jsx')
  else if (user.account_type === 'employer') import('./pages/dashboard/EmployerPages.jsx')
  else if (user.account_type === 'worker') import('./pages/dashboard/WorkerPages.jsx')
}

// Signed-in users go to the app; guests see the page.
function GuestOnly({ children }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <Splash />
  // signed in from "Apply" on a post: go back to that post, not to the dashboard
  if (user) return <Navigate to={user.account_type || user.role === 'admin' ? (loc.state?.from || '/dashboard') : '/onboarding'} replace />
  return children
}

function Private({ children, needType = true }) {
  const { user, ready, signedOut } = useAuth()
  const loc = useLocation()
  if (!ready) return <Splash />
  // after a deliberate sign-out, remember nothing: the next person starts fresh at their own dashboard
  if (!user) return <Navigate to="/login" state={signedOut ? null : { from: loc.pathname }} replace />
  if (needType && !user.account_type && user.role !== 'admin') return <Navigate to="/onboarding" replace />
  return children
}

/**
 * Job Search, a job posting, the Job Map and Training exist once each. A guest gets the
 * public page; everyone signed in gets the very same page inside the dashboard, so the
 * sidebar stays put and these never feel like a different website.
 *
 * Old links keep working: a notification pointing at /jobs/12 lands on
 * /dashboard/browse/12 for a signed-in person, and on the public posting for a guest.
 */
function PublicOrDashboard({ to, children }) {
  const { user, ready } = useAuth()
  const { search, hash } = useLocation()
  const params = useParams()
  if (!ready) return <Splash />
  if (user) {
    const target = to.replace(/:(\w+)/g, (_, k) => params[k] ?? '')
    return <Navigate to={`${target}${search}${hash}`} replace />
  }
  return children
}

export default function App() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  useEffect(() => { if (!window.location.hash) window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    if (user && pathname.startsWith('/dashboard')) prefetchDashboard(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, user?.account_type])

  return (
    <>
    <AppUpdate />
    <TopProgress />
    {!pathname.startsWith('/dashboard') && <DataNotice />}
    {/* keyed by the first path segment: going to another section clears an earlier error */}
    <PageErrorBoundary key={pathname.split('/')[1]}>
    <Suspense fallback={<Splash label="Loading…" />}>
    <Routes>
      {/* Public pages. Signed in, each one re-opens inside the dashboard. */}
      <Route path="/" element={<Landing />} />
      <Route path="/jobs"      element={<PublicOrDashboard to="/dashboard/browse"><Jobs /></PublicOrDashboard>} />
      <Route path="/jobs/:id"  element={<PublicOrDashboard to="/dashboard/browse/:id"><JobDetail /></PublicOrDashboard>} />
      <Route path="/map"       element={<PublicOrDashboard to="/dashboard/map"><JobMap /></PublicOrDashboard>} />
      <Route path="/training"  element={<PublicOrDashboard to="/dashboard/training"><Training /></PublicOrDashboard>} />
      {/* a worker's shared Skills Passport (link / QR code): open to everyone, admins included */}
      <Route path="/p/:token" element={<PublicPassport />} />

      {/* Auth */}
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/about" element={<About />} />
      <Route path="/help" element={<Help />} />
      <Route path="/contact" element={<Help />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/onboarding" element={<Private needType={false}><Onboarding /></Private>} />

      {/* Protected dashboard — nested routes */}
      <Route path="/dashboard/*" element={<Private><Dashboard /></Private>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </PageErrorBoundary>
    </>
  )
}
