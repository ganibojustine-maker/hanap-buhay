import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import Dialog from '../components/Dialog.jsx'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import { Logo, IconMail, IconCheck, IconArrow, IconSearch, IconChevron, IconLogout, IconBell, IconPlus, IconSettings, IconMenu, IconX, IconGlobe, IconPhone } from '../components/icons.jsx'
import { useLanguage } from '../i18n.jsx'
import { tr, setTagalog, tagalogLoaded, loadTagalog } from '../lang/dash.js'
import { TYPES, TOWNS } from '../components/art.jsx'
import UserAvatar from '../components/Avatar.jsx'
import BrandLoader from '../components/BrandLoader.jsx'
import { days } from './dashboard/shared.jsx'
import InstallApp from '../components/InstallApp.jsx'
import PageErrorBoundary from '../components/PageErrorBoundary.jsx'
import '../styles/social.css'
import { sectionsFor, headerFor, tabIsActive, profileMeta, accountLinks, MESSAGES_PATH, PLAN_PATH, roleOf } from './dashboard/nav.js'
import '../styles/platform.css'

// Each role's pages are a separate download, fetched the first time they are opened:
// a worker never downloads the admin or employer code, and chat (Firebase) loads
// only when Messages is opened.
const workerPages   = () => import('./dashboard/WorkerPages.jsx')
const employerPages = () => import('./dashboard/EmployerPages.jsx')
const adminPages    = () => import('./dashboard/AdminPages.jsx')
const pick = (load, name) => lazy(() => load().then(m => ({ default: m[name] })))

const WorkerOverview     = pick(workerPages, 'WorkerOverview')
const WorkerProfile      = pick(workerPages, 'WorkerProfile')
const SkillsPassport     = pick(workerPages, 'SkillsPassport')
const JobMatches         = pick(workerPages, 'JobMatches')
const MyApplications     = pick(workerPages, 'MyApplications')
const SavedJobs          = pick(workerPages, 'SavedJobs')
const EmployerOverview   = pick(employerPages, 'EmployerOverview')
const EmployerProfile    = pick(employerPages, 'EmployerProfile')
const EmployerJobs       = pick(employerPages, 'EmployerJobs')
const PostJob            = pick(employerPages, 'PostJob')
const PostJobEdit        = pick(employerPages, 'PostJobEdit')
const EmployerApplicants = pick(employerPages, 'EmployerApplicants')
const talentPages   = () => import('./dashboard/TalentPages.jsx')
const FindWorkers        = pick(talentPages, 'FindWorkers')
const SavedWorkers       = pick(talentPages, 'SavedWorkers')
const TalentProfile      = pick(talentPages, 'TalentProfile')
const AdminOverview      = pick(adminPages, 'AdminOverview')
const AdminProfile       = pick(adminPages, 'AdminProfile')
const AdminUsers         = pick(adminPages, 'AdminUsers')
const AdminReports       = pick(adminPages, 'AdminReports')
// Each role has its own Messages page, file and address (dashboard/messages/*)
const WorkerMessages     = pick(() => import('./dashboard/messages/WorkerMessages.jsx'), 'WorkerMessages')
const EmployerMessages   = pick(() => import('./dashboard/messages/EmployerMessages.jsx'), 'EmployerMessages')
const ClientMessages     = pick(() => import('./dashboard/messages/ClientMessages.jsx'), 'ClientMessages')
const AdminMessages      = pick(() => import('./dashboard/messages/AdminMessages.jsx'), 'AdminMessages')
// Client (service buyer) pages
const clientPages   = () => import('./dashboard/client/ClientPages.jsx')
const ClientOverview     = pick(clientPages, 'ClientOverview')
const ClientGigs         = pick(clientPages, 'ClientGigs')
const ClientPostGig      = pick(clientPages, 'ClientPostGig')
const ClientProposals    = pick(clientPages, 'ClientProposals')
const ClientContracts    = pick(clientPages, 'ClientContracts')
const ClientContract     = pick(clientPages, 'ClientContract')
const ClientServices     = pick(clientPages, 'ClientServices')
const ClientProfile      = pick(clientPages, 'ClientProfile')
const clientTalent  = () => import('./dashboard/client/ClientTalentPages.jsx')
const ClientFindWorkers  = pick(clientTalent, 'ClientFindWorkers')
const ClientSavedWorkers = pick(clientTalent, 'ClientSavedWorkers')
const ClientTalentProfile= pick(clientTalent, 'ClientTalentProfile')
// Worker gig pages
const workerGigs    = () => import('./dashboard/worker/WorkerGigs.jsx')
const WorkerGigBoard     = pick(workerGigs, 'WorkerGigBoard')
const WorkerProposals    = pick(workerGigs, 'WorkerProposals')
const WorkerContracts    = pick(workerGigs, 'WorkerContracts')
const WorkerContract     = pick(workerGigs, 'WorkerContract')
const WorkerServices     = pick(workerGigs, 'WorkerServices')
// Verification, billing, admin
const verifyPages   = () => import('./dashboard/VerificationPages.jsx')
const WorkerVerification   = pick(verifyPages, 'WorkerVerification')
const ClientVerification   = pick(verifyPages, 'ClientVerification')
const EmployerVerification = pick(verifyPages, 'EmployerVerification')
const EmployerPlans      = pick(() => import('./dashboard/billing/EmployerPlans.jsx'), 'EmployerPlans')
const ClientPass         = pick(() => import('./dashboard/billing/ClientPass.jsx'), 'ClientPass')
const adminPlatform = () => import('./dashboard/admin/AdminPlatform.jsx')
const AdminPosts         = pick(adminPlatform, 'AdminPosts')
const AdminVerificationHub = pick(adminPlatform, 'AdminVerificationHub')
const AdminDisputes      = pick(adminPlatform, 'AdminDisputes')
const AdminGigContracts  = pick(adminPlatform, 'AdminGigContracts')
const AdminHiringMonitor = pick(adminPlatform, 'AdminHiringMonitor')
const AdminPaymentsPage  = pick(adminPlatform, 'AdminPaymentsPage')
const supportPages = () => import('./dashboard/Support.jsx')
const HelpSupport        = pick(supportPages, 'HelpSupport')
const AdminSupport       = pick(supportPages, 'AdminSupport')
const ResumeBuilder      = lazy(() => import('./ResumeBuilder.jsx'))
const ServiceDetail      = lazy(() => import('./dashboard/ServiceDetail.jsx'))

// The public pages, rendered inside this shell. They are the same components /jobs,
// /jobs/:id, /map and /training use — only the chrome differs — so moving between the
// signed-out site and the dashboard never changes the page itself.
const JobSearch          = lazy(() => import('./jobs/JobSearch.jsx'))
const JobView            = lazy(() => import('./jobs/JobView.jsx'))
const JobMapPage         = lazy(() => import('./JobMap.jsx'))
const TrainingBrowser    = lazy(() => import('./training/TrainingBrowser.jsx'))
const socialPages        = () => import('./dashboard/SocialPages.jsx')
const Network            = pick(socialPages, 'Network')
const PublicProfile      = pick(socialPages, 'PublicProfile')
const Reviews            = pick(socialPages, 'Reviews')

/** Shown while a page's code downloads (usually a fraction of a second, longer on slow data). */
function PageLoading() {
  return <BrandLoader label={tr('Loading…')} />
}

/* ─ Sidebar nav config ──────────────────────────────────── */
/* ─ Sidebar ─────────────────────────────────────────────── */
/**
 * Six to eight places, not fifteen. Anything that is a view of something already listed
 * (the job map, saved jobs, the resume builder) is a tab on that section's header instead
 * of a row of its own, and the account pages hang off the name at the top.
 */
function Sidebar({ user, logout, open, onClose, badges = {} }) {
  const { pathname } = useLocation()
  const sections = sectionsFor(user)
  const main = sections.filter(x => !x.foot)
  const foot = sections.filter(x => x.foot)

  const Row = ({ item }) => {
    const n = item.badge ? badges[item.badge] || 0 : 0
    const owned = [item.to, ...(item.tabs || []).map(t => t.to), ...(item.paths || [])]
    const active = owned.some(r => pathname === r || (r !== '/dashboard' && pathname.startsWith(r + '/')))
    const Ic = item.icon
    return (
      <Link to={item.to} className={active ? 'active' : ''} onClick={onClose} aria-current={active ? 'page' : undefined}>
        <Ic size={18} />{tr(item.label)}
        {n > 0 && <span className="nav-badge">{n > 99 ? '99+' : n}</span>}
      </Link>
    )
  }

  return (
    <aside className={`sidebar ${open ? 'mob-open' : ''}`}>
      <div className="sidebar-logo">
        <Logo light to="/dashboard" />
        <button onClick={onClose} className="mob-close-btn" aria-label={tr('Close menu')}>
          <IconX size={20} />
        </button>
      </div>


      <nav className="sidebar-nav" aria-label={tr('Dashboard navigation')}>
        {main.map(item => <Row key={item.id} item={item} />)}
      </nav>

      <div className="sidebar-footer">
        {foot.map(item => <Row key={item.id} item={item} />)}
        <button type="button" onClick={logout}>
          <IconLogout size={18} />{tr('Sign Out')}
        </button>
      </div>
    </aside>
  )
}

/* ─ Page header ─────────────────────────────────────────── */
/**
 * One heading per page, drawn here rather than by each page, so the title, the tab strip
 * and the sidebar can never drift apart. Pages that are a single thing — one job, one
 * applicant — get no header: they carry their own title and a way back.
 */
function PageHeader({ user }) {
  const { pathname } = useLocation()
  const head = headerFor(sectionsFor(user), pathname, user)
  if (!head) return null
  const act = head.action

  return (
    <header className={`dash-head${head.tabs ? '' : ' no-tabs'}`}>
      <div className="dash-head-top">
        <div>
          <h1>{tr(head.title)}</h1>
          {head.lede && <p>{tr(head.lede)}</p>}
        </div>
        {act && (act.href
          ? <a href={act.href} target="_blank" rel="noopener noreferrer" className="btn btn-light btn-sm dash-head-act">{tr(act.label)} <IconArrow size={14} /></a>
          : <Link to={act.to} className="btn btn-primary btn-sm dash-head-act">{act.icon === 'search' ? <IconSearch size={15} /> : <IconPlus size={15} />} {tr(act.label)}</Link>)}
      </div>

      {head.tabs && (
        <nav className="dash-tabs" aria-label={tr('{section} views', { section: tr(head.title) })}>
          {head.tabs.map(t => {
            const on = tabIsActive(t.to, pathname, t.exact)
            return (
              <Link key={t.to} to={t.to} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                {tr(t.label)}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}

/* ─ Topbar ──────────────────────────────────────────────── */
function Topbar({ user, onToggleSidebar, call, onSupportCount }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [activeEmail, setActiveEmail] = useState(null)
  const menuRef = useRef()
  const notifRef = useRef()
  const { logout } = useAuth()

  const loadNotifications = useCallback(async () => {
    if (!call) return
    try {
      const res = await call('/notifications')
      const items = res?.notifications || []
      setNotifs(items)
      const unread = items.filter(n => !n.read_at).length
      setUnreadCount(unread)
      onSupportCount?.(Number(res?.support_unread) || 0)
    } catch {
      // quiet fallback
    }
  }, [call, onSupportCount])

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    // Help & Support asks for a refresh after a request is read or answered
    window.addEventListener('hb:support', loadNotifications)
    return () => { clearInterval(timer); window.removeEventListener('hb:support', loadNotifications) }
  }, [loadNotifications])

  useEffect(() => {
    const off = e => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
      if (!notifRef.current?.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [])

  const handleToggleNotif = () => {
    const nextState = !notifOpen
    setNotifOpen(nextState)
    if (nextState && unreadCount > 0) {
      call('/notifications/mark-read', { method: 'POST' }).catch(() => {})
      setUnreadCount(0)
    }
  }

  const type = TYPES.find(t => t.id === user.account_type)
  const label = user.role === 'admin' ? 'System Administrator' : type?.name || user.account_type
  const me = profileMeta(user)

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button style={{ background: 'none', border: 'none', alignItems: 'center', color: 'var(--muted)', cursor: 'pointer' }} onClick={onToggleSidebar} aria-label={tr('Open menu')} className="tb-menu">
          <IconMenu size={22} />
        </button>
      </div>
      <div className="topbar-right">
        {/* One primary action, and only where there is one. A worker already has Find Jobs
            in the sidebar, so the old duplicate button here is gone. */}
        {user.role !== 'admin' && (user.account_type === 'employer' || user.account_type === 'hirer') && (
          <Link to={user.account_type === 'hirer' ? '/dashboard/gigs/new' : '/dashboard/jobs/new'} className="btn btn-primary btn-sm tb-primary">
            <IconPlus size={14} /> <span>{user.account_type === 'hirer' ? tr('Post a gig') : tr('Post a job')}</span>
          </Link>
        )}

        {user.account_type === 'worker' && user.role !== 'admin' && <LangToggle />}

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="notif-btn"
            title={tr("Notifications & Emails")}
            onClick={handleToggleNotif}
            style={{ position: 'relative' }}
          >
            <IconBell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className="umenu-pop" style={{ width: 360, right: 0, padding: 0, maxHeight: 460, overflowY: 'auto', zIndex: 70, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b style={{ fontSize: 13, color: 'var(--navy-d)' }}>{tr("Notifications & Emails")}</b>
                  <span className="chip green" style={{ fontSize: 10, padding: '1px 6px' }}>{tr("Auto")}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{notifs.length} {tr("total")}</span>
              </div>
              <div style={{ padding: '4px 0' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <div style={{ marginBottom: 6, color: '#94a3b8' }}><IconBell size={24} /></div>
                    {tr("No notifications yet.")}
                  </div>
                ) : (
                  notifs.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        background: !n.read_at ? '#f0fdf4' : 'transparent',
                        transition: 'background .15s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-d)' }}>
                          {n.title}
                        </div>
                        {n.email_status && (
                          <span className="chip green" style={{ fontSize: 10, padding: '1px 5px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <IconMail size={11} /> {tr("Email")}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                        {n.body}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>
                          {days(n.created_at)}
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {n.email_html && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveEmail(n)
                                setNotifOpen(false)
                              }}
                              className="btn btn-light btn-xs"
                              style={{ fontSize: 11, padding: '2px 8px', borderColor: '#cbd5e1', color: 'var(--navy)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <IconMail size={11} /> {tr("Preview Email")}
                            </button>
                          )}
                          {n.link && (
                            <Link
                              to={n.link}
                              onClick={() => setNotifOpen(false)}
                              className="btn btn-light btn-xs"
                              style={{ fontSize: 11, padding: '2px 8px', textDecoration: 'none' }}
                            >
                              {tr("Open →")}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Link
                  to="/dashboard/settings"
                  onClick={() => setNotifOpen(false)}
                  style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600, textDecoration: 'none' }}
                >
                  {tr("Notification Settings →")}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Email Preview Modal */}
        {activeEmail && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setActiveEmail(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                width: '100%',
                maxWidth: 620,
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="chip green" style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconMail size={12} /> {tr("Official hanapbuhay Email")}
                    </span>
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCheck size={11} /> {tr("Live in Account")}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
                    {activeEmail.title}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveEmail(null)}
                  className="btn btn-light btn-sm"
                  style={{ fontSize: 14, width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label={tr("Close")}
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Meta bar */}
              <div style={{ padding: '10px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 12, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                <div>
                  <span><strong>{tr("To:")}</strong> {activeEmail.email_to || user.email}</span> &bull; <span><strong>{tr("From:")}</strong> {tr("hanapbuhay Oriental Mindoro")}</span>
                </div>
                <div>
                  <span>{days(activeEmail.created_at)}</span>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f8fafc' }}>
                {activeEmail.email_html ? (
                  // a sandboxed frame: the email is shown exactly as sent, and nothing in it can run
                  <iframe
                    title={activeEmail.title || 'Email'}
                    sandbox=""
                    srcDoc={activeEmail.email_html}
                    style={{ width: '100%', minHeight: 520, border: 0, borderRadius: 8, background: '#fff' }}
                  />
                ) : (
                  <div className="panel" style={{ padding: 24, background: '#fff' }}>
                    <h3 style={{ fontSize: 16, marginBottom: 8, color: 'var(--navy-d)' }}>{activeEmail.title}</h3>
                    <p style={{ fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{activeEmail.body}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {tr("hanapbuhay Automated Email System")}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveEmail(null)} className="btn btn-light btn-sm">{tr("Close")}</button>
                  {activeEmail.link && (
                    <Link
                      to={activeEmail.link}
                      onClick={() => setActiveEmail(null)}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 600 }}
                    >
                      {tr("Open in App →")}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Menu */}
        <div className="umenu" ref={menuRef}>
          <button className="umenu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            <UserAvatar user={user} size={36} />
            <span className="umenu-id">
              <b>{user.full_name || tr("Account")}</b>
              <small>{user.role === 'admin' ? tr('Administrator') : tr({ worker: 'Worker', employer: 'Employer', hirer: 'Client' }[user.account_type] || '')}</small>
            </span>
            <IconChevron size={15} className={menuOpen ? 'flip' : ''} />
          </button>
          {menuOpen && (
            <div className="umenu-pop" role="menu">
              <div className="umenu-who">
                <b>{user.full_name || tr("Your account")}</b>
                <small>{user.email}</small>
                <span className="chip navy">{tr(label)}</span>
              </div>
              <Link to={me.to} role="menuitem" onClick={() => setMenuOpen(false)}><me.icon size={16} />{tr(me.label)}</Link>
              {accountLinks(user).map(l => (
                <Link key={l.to} to={l.to} role="menuitem" onClick={() => setMenuOpen(false)}><l.icon size={16} />{tr(l.label)}</Link>
              ))}
              <Link to="/dashboard/settings" role="menuitem" onClick={() => setMenuOpen(false)}><IconSettings size={16} />{tr("Settings")}</Link>
              <button role="menuitem" onClick={logout}><IconLogout size={16} />{tr("Sign Out")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─ EN / FIL switch for workers (worker pages are translated: see lang/dash.js) ─ */
function LangToggle({ big = false }) {
  const { lang, setLang } = useLanguage()
  return (
    <div className={`lang-tg${big ? ' big' : ''}`} role="group" aria-label={tr("Language / Wika")}>
      {[['en', big ? 'English' : 'EN', 'English'], ['tl', big ? 'Filipino (Tagalog)' : 'FIL', 'Filipino']].map(([code, text, name]) => (
        <button key={code} type="button" aria-pressed={lang === code} title={name} lang={code === 'tl' ? 'fil' : 'en'} onClick={() => setLang(code)}>{text}</button>
      ))}
    </div>
  )
}

/* ─ Settings page ───────────────────────────────────────── */
function Settings({ user, call, updateUser }) {
  const { logout } = useAuth()
  const [delOpen, setDelOpen] = useState(false)
  const [delPass, setDelPass] = useState('')
  const [delConfirm, setDelConfirm] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState('')
  const deleteAccount = async (e) => {
    e.preventDefault()
    setDelErr('')
    if (delConfirm !== 'DELETE') { setDelErr(tr('Type DELETE to confirm.')); return }
    setDelBusy(true)
    try {
      await call('/auth/me', { method: 'DELETE', body: { confirm: delConfirm, password: delPass } })
      await logout()
      window.location.href = '/'
    } catch (err) {
      setDelErr(tr(err.message || 'Could not delete the account.'))
      setDelBusy(false)
    }
  }
  // SMS (Semaphore) is for workers only: hired, interview invite, interview reminder
  const isWorker = user?.account_type === 'worker' && user?.role !== 'admin'
  const initialPrefs = user?.notification_prefs || {}
  const EMAIL_KEYS = ['email', 'job_alerts', 'sms', 'email_applications', 'email_updates', 'email_invites', 'email_messages', 'email_reviews', 'email_social', 'email_posts']
  const readPrefs = pr => Object.fromEntries(EMAIL_KEYS.map(k => [k, pr?.[k] !== false]))
  const [notifs, setNotifs] = useState(readPrefs(initialPrefs))
  const isAdmin = user?.role === 'admin'
  const isHiring = !isAdmin && ['employer', 'hirer'].includes(user?.account_type)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  // Keep in sync when user data updates
  useEffect(() => {
    if (user?.notification_prefs) setNotifs(readPrefs(user.notification_prefs))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.notification_prefs])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setSaveErr('')
    try {
      const res = await call('/auth/me', {
        method: 'PATCH',
        body: { notification_prefs: notifs }
      })
      if (res?.user && updateUser) {
        updateUser(res.user)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveErr(tr(err.message || 'Failed to save preferences.'))
    } finally {
      setSaving(false)
    }
  }

  // each kind of email, worded for the person reading it
  const EMAILS = isHiring ? [
    ['email_applications', user?.account_type === 'hirer' ? 'A worker responds to your request' : 'Someone applies to your job', 'With their match score and a link to their Skills Passport.'],
    ['email_messages', 'New chat messages', 'Only a short notice, never the message text.'],
    ['email_posts', 'Your post is live', 'A confirmation each time a post goes up.'],
    ['email_reviews', 'A worker rates you', 'Ratings show on your public business page.'],
    ['email_social', 'Someone follows your business', ''],
  ] : [
    ['email_updates', 'Updates on my applications', 'Viewed, shortlisted or not selected, and certificate checks.'],
    ['email_invites', 'An employer invites me to apply', 'From employers who found your Skills Passport.'],
    ['email_messages', 'New chat messages', 'Only a short notice, never the message text.'],
    ['email_reviews', 'An employer rates me', ''],
    ['email_social', 'Someone follows me', ''],
  ]
  const Toggle = ({ k, title, sub, disabled }) => (
    <label className={`st-row${disabled ? ' off' : ''}`}>
      <span><b>{tr(title)}</b>{sub && <small>{tr(sub)}</small>}</span>
      <input type="checkbox" role="switch" checked={!!notifs[k] && !disabled} disabled={disabled} onChange={e => setNotifs({ ...notifs, [k]: e.target.checked })} />
    </label>
  )
  const SaveBar = () => (
    <div className="st-save">
      {saveErr && <p className="st-err">{saveErr}</p>}
      <button className={`btn btn-primary ${saved ? 'is-done' : ''}`} onClick={handleSave} disabled={saving}>
        {saving ? tr('Saving…') : saved ? <><IconCheck size={16} /> {tr('Saved')}</> : tr('Save')}
      </button>
    </div>
  )
  const roleText = isAdmin ? 'Administrator' : { worker: 'Worker — looking for jobs', employer: 'Employer — company hiring for long-term roles', hirer: 'Client — hiring for short-term jobs and gigs' }[user?.account_type] || 'Account'

  return (
    <div className="page-inner st">
      {/* ── worker: language first, in their words ── */}
      {isWorker && (
        <section className="panel" aria-labelledby="lang-title">
          <h2 id="lang-title"><IconGlobe size={18} /> {tr('Language / Wika')}</h2>
          <p className="st-sub">{tr('Choose the language of your dashboard. Job posts, messages, and your resume stay in the language they were written in.')}</p>
          <LangToggle big />
        </section>
      )}

      {/* ── emails (everyone except admins) ── */}
      {!isAdmin && (
        <section className="panel">
          <div className="st-hd">
            <div>
              <h2>{tr('Emails')}</h2>
              <p className="st-sub">{isHiring ? tr('Choose what we email you about. Everything also appears under the bell.')
                : tr('Choose what we email you about. Everything also appears under the bell.')}</p>
            </div>
            <label className="st-master">
              <input type="checkbox" role="switch" checked={notifs.email} onChange={e => setNotifs({ ...notifs, email: e.target.checked })} />
              <span>{notifs.email ? tr('On') : tr('All off')}</span>
            </label>
          </div>
          {EMAILS.map(([k, t, sub]) => <Toggle key={k} k={k} title={t} sub={sub} disabled={!notifs.email} />)}
          <p className="st-note"><IconCheck size={13} /> {isHiring
            ? tr('Payment receipts, plan changes and support replies are always emailed.')
            : tr('Interview invitations, hiring news and support replies are always emailed.')}</p>
          <SaveBar />
        </section>
      )}

      {/* ── worker: texts and new-job alerts ── */}
      {isWorker && (
        <section className="panel">
          <h2><IconPhone size={17} /> {tr('Text messages (SMS)')}</h2>
          <Toggle k="sms" title="Text me when I am hired or invited to an interview" sub="And a reminder the day before the interview. Free for you." />
          <p className="st-note" style={{ color: user?.phone ? 'var(--green)' : 'var(--amber)' }}>
            {user?.phone ? tr('Texts go to {phone}.', { phone: user.phone })
              : <>{tr('Add your mobile number in')} <Link to="/dashboard/profile">{tr('My Profile')}</Link> {tr('to get texts.')}</>}
          </p>
          <h2 style={{ marginTop: 18 }}>{tr('New job alerts')}</h2>
          <Toggle k="job_alerts" title="Tell me about new jobs that fit me" sub="Under the bell, as soon as a matching job is posted." />
          <SaveBar />
        </section>
      )}
      {isWorker && <JobAlertSettings user={user} call={call} updateUser={updateUser} alertsOn={notifs.job_alerts} />}
      {isWorker && (
        <section className="panel">
          <h2>{tr('Privacy')}</h2>
          <ul className="st-links">
            <li><Link to="/dashboard/profile">{tr('Who can find me')}</Link><small>{tr('While “Open to work” is on, employers can find your Skills Passport in Find Workers. Your phone and email stay hidden until they unlock them or you apply.')}</small></li>
            <li><Link to="/dashboard/passport">{tr('My public Skills Passport link')}</Link><small>{tr('Turn the share link on or off, or make a new one.')}</small></li>
          </ul>
        </section>
      )}

      {/* ── employer / client: the hiring account ── */}
      {isHiring && (
        <section className="panel">
          <h2>{user?.account_type === 'hirer' ? tr('Your client account') : tr('Your business account')}</h2>
          <ul className="st-links">
            <li><Link to="/dashboard/subscription">{user?.account_type === 'hirer' ? tr('Service Buyer Pass and receipts') : tr('Hiring package and receipts')}</Link>
              <small>{user?.subscription_expires_at && new Date(String(user.subscription_expires_at).replace(' ', 'T')) > new Date()
                ? tr('Paid plan until {date}. Plans never renew or charge you by themselves.', { date: new Date(String(user.subscription_expires_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) })
                : tr('On the free plan.')}</small></li>
            <li><Link to="/dashboard/profile">{tr('Business details and verification')}</Link>
              <small>{user?.is_verified ? tr('Verified business — the badge shows on your posts.') : tr('Upload a business permit to get the Verified business badge.')}</small></li>
            <li><Link to={`/dashboard/people/${user?.id}`}>{tr('Your public page')}</Link><small>{tr('What workers see: your open posts, ratings and followers.')}</small></li>
          </ul>
        </section>
      )}

      {/* ── admin: where the work arrives ── */}
      {isAdmin && (
        <section className="panel">
          <h2>{tr('Admin alerts')}</h2>
          <p className="st-sub">{tr('New support requests, payments, business documents and certificates arrive under the bell, and each queue shows a count in the sidebar.')}</p>
          <ul className="st-links">
            <li><Link to="/dashboard/support">{tr('Support inbox')}</Link><small>{tr('Requests from workers, employers and clients.')}</small></li>
            <li><Link to="/dashboard/verify">{tr('Verification')}</Link><small>{tr('Business documents and skill certificates to check.')}</small></li>
            <li><Link to="/dashboard/reports">{tr('Reported jobs')}</Link><small>{tr('Posts people flagged as fake or wrong.')}</small></li>
            <li><Link to="/dashboard/payments">{tr('Payments')}</Link><small>{tr('Every PayMongo payment and plan.')}</small></li>
          </ul>
        </section>
      )}

      <PasswordSettings user={user} />

      <section className="panel">
        <h2>{tr('Account')}</h2>
        <p className="st-sub">{tr('Signed in as')} <strong>{user?.email}</strong></p>
        <p className="st-sub">{tr('Account type:')} <strong>{tr(roleText)}</strong>
          {!isAdmin && <> · <Link to="/dashboard/support">{tr('Need a different account type? Ask support.')}</Link></>}</p>
      </section>

      {isAdmin ? (
        <section className="panel">
          <h2>{tr('Remove this account')}</h2>
          <p className="st-sub">{tr('Administrator accounts cannot delete themselves, so the system always keeps an admin. Another administrator can deactivate this account in Users.')}</p>
        </section>
      ) : (
        <section className="panel st-danger">
          <h2>{tr('Delete account')}</h2>
          <p className="st-sub">{isHiring
            ? tr('Permanently removes your name, email, phone, photo and sign-in, signs you out everywhere, and closes all your posts. Unused plan days and credits are lost. This cannot be undone.')
            : tr('Permanently removes your name, email, phone, photo, Skills Passport and sign-in, signs you out everywhere, and withdraws open applications. This cannot be undone.')}</p>
          {!delOpen ? (
            <button type="button" className="btn btn-light btn-sm st-del" onClick={() => setDelOpen(true)}>{tr('Delete my account…')}</button>
          ) : (
            <form onSubmit={deleteAccount} className="st-delform">
              {!user?.has_google && (
                <input type="password" className="input" placeholder={tr('Your current password')} value={delPass} onChange={e => setDelPass(e.target.value)} autoComplete="current-password" />
              )}
              <input type="text" className="input" placeholder={tr('Type DELETE to confirm')} value={delConfirm} onChange={e => setDelConfirm(e.target.value)} />
              {delErr && <p className="st-err">{delErr}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-danger btn-sm" disabled={delBusy}>{delBusy ? tr('Deleting…') : tr('Permanently delete')}</button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => { setDelOpen(false); setDelErr('') }}>{tr('Cancel')}</button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

/* ─ Settings: which new jobs to be alerted about (workers) ─ */
const ALERT_TYPES = [['full-time', 'Full-time'], ['part-time', 'Part-time'], ['contractual', 'Contractual'], ['freelance', 'Freelance'], ['gig', 'Gig / Raket']]

function JobAlertSettings({ user, call, updateUser, alertsOn }) {
  const p = user?.notification_prefs || {}
  const [towns, setTowns] = useState(p.alert_towns || [])
  const [types, setTypes] = useState(p.alert_types || [])
  const [minPay, setMinPay] = useState(p.alert_min_salary ? String(p.alert_min_salary) : '')
  const [skillsOnly, setSkillsOnly] = useState(!!p.alert_skills_only)
  const [email, setEmail] = useState(!!p.alert_email)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const toggle = (list, set, v) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: { notification_prefs: {
        alert_towns: towns, alert_types: types, alert_min_salary: Number(minPay) || 0, alert_skills_only: skillsOnly, alert_email: email,
      } } })
      if (res?.user) updateUser?.(res.user)
      setMsg({ ok: true, text: tr('Job alert settings saved.') })
    } catch (err) {
      setMsg({ ok: false, text: tr(err?.message || 'Could not save your job alerts.') })
    } finally {
      setBusy(false)
    }
  }

  const townHint = towns.length
    ? (towns.length === 1 ? tr('1 town selected') : tr('{n} towns selected', { n: towns.length }))
    : tr('None selected: alerts for {town} only', { town: user?.location || tr('your town') })
  return (
    <form className="panel ja" onSubmit={save} aria-labelledby="ja-title">
      <h2 id="ja-title" style={{ fontSize: 18, marginBottom: 6 }}>{tr("Job Alerts")}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        {tr("Choose which new job posts you hear about. Alerts appear under the bell")}{email ? tr(" and in your email") : ''}.
        {!alertsOn && <b style={{ color: 'var(--amber)' }}> {tr("Job Match Notifications are turned off above, so no alerts are sent.")}</b>}
      </p>

      <fieldset className="ja-set">
        <legend>{tr("Towns")} <span>{townHint}</span></legend>
        <div className="ja-towns">
          {TOWNS.map(t => (
            <label key={t} className="ja-check"><input type="checkbox" checked={towns.includes(t)} onChange={() => toggle(towns, setTowns, t)} /> {t}</label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          <button type="button" className="ja-link" onClick={() => setTowns([...TOWNS])}>{tr("Select all")}</button>
          <button type="button" className="ja-link" onClick={() => setTowns([])}>{tr("Clear")}</button>
        </div>
      </fieldset>

      <fieldset className="ja-set">
        <legend>{tr("Job types")} <span>{types.length ? tr('{n} selected', { n: types.length }) : tr("Any type")}</span></legend>
        <div className="ja-chips">
          {ALERT_TYPES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={types.includes(id)} onClick={() => toggle(types, setTypes, id)}>{tr(label)}</button>
          ))}
        </div>
      </fieldset>

      <label className="field" style={{ maxWidth: 260 }}>
        <span>{tr("Minimum monthly pay")} <em>{tr("Optional")}</em></span>
        <div className="in no-icon"><input type="number" inputMode="numeric" min="0" step="500" value={minPay} onChange={e => setMinPay(e.target.value)} placeholder={tr("e.g. 12000")} /></div>
      </label>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '-12px 0 14px' }}>{tr("Jobs that don't post a salary are still included.")}</p>

      <label className="ja-check" style={{ marginBottom: 8 }}><input type="checkbox" checked={skillsOnly} onChange={e => setSkillsOnly(e.target.checked)} /> {tr("Only jobs that need a skill I have")}</label>
      <label className="ja-check" style={{ marginBottom: 16 }}><input type="checkbox" checked={email} onChange={e => setEmail(e.target.checked)} /> {tr("Also send alerts to my email (")}{user?.email})</label>

      {msg && <p role={msg.ok ? 'status' : 'alert'} style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.ok ? 'var(--green-l)' : 'var(--red-l)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 170 }}>{busy ? <span className="spin" /> : tr("Save Job Alerts")}</button>
    </form>
  )
}

/* ─ Settings: change password ───────────────────────────── */
const PASSWORD_RULE = 'At least 8 characters, with at least one letter and one number.'
const passwordOk = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)

function PasswordSettings({ user }) {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }
  const [linkState, setLinkState] = useState('') // '' | sending | sent | error

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    if (!current) return setMsg({ ok: false, text: tr('Enter your current password.') })
    if (!passwordOk(next)) return setMsg({ ok: false, text: tr('New password: {rule}', { rule: tr(PASSWORD_RULE).toLowerCase() }) })
    if (next !== confirm) return setMsg({ ok: false, text: tr('The new passwords do not match.') })
    if (next === current) return setMsg({ ok: false, text: tr('Choose a new password that is different from your current one.') })
    setBusy(true)
    try {
      const r = await changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm('')
      setMsg({ ok: true, text: tr(r?.message || 'Password changed.') })
    } catch (err) {
      setMsg({ ok: false, text: tr(err?.message || 'Could not change the password. Please try again.') })
    } finally {
      setBusy(false)
    }
  }

  // Forgot the current password, or a Google account that never had one: email a link
  async function emailLink() {
    setLinkState('sending')
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: user.email } })
      setLinkState('sent')
    } catch {
      setLinkState('error')
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <section className="panel" style={{ marginBottom: 20 }} aria-labelledby="pw-title">
      <h2 id="pw-title" style={{ fontSize: 18, marginBottom: 6 }}>{tr("Change Password")}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        {user?.has_google
          ? tr("You sign in with Google. If you never set a hanapbuhay password, use the email link below to create one.")
          : tr("Changing your password signs you out on your other phones and computers.")}
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 0, maxWidth: 420 }} noValidate>
        <label className="field">
          <span>{tr("Current password")}</span>
          <div className="in no-icon"><input type={type} value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" disabled={busy} /></div>
        </label>
        <label className="field">
          <span>{tr("New password")}</span>
          <div className="in no-icon"><input type={type} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" aria-describedby="pw-rule" disabled={busy} /></div>
        </label>
        <p id="pw-rule" style={{ fontSize: 12, color: next && !passwordOk(next) ? 'var(--red)' : 'var(--muted)', margin: '-12px 0 14px' }}>{tr(PASSWORD_RULE)}</p>
        <label className="field">
          <span>{tr("Confirm new password")}</span>
          <div className="in no-icon"><input type={type} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" disabled={busy} /></div>
        </label>
        <label className="check" style={{ marginBottom: 14, fontSize: 13 }}>
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> {tr("Show passwords")}
        </label>

        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: msg.ok ? 'var(--green-l)' : 'var(--red-l)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>
            {msg.text}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 170 }}>
            {busy ? <span className="spin" /> : tr("Change Password")}
          </button>
          <button type="button" onClick={emailLink} disabled={linkState === 'sending' || linkState === 'sent'}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--navy)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            {linkState === 'sending' ? tr("Sending…") : user?.has_google ? tr("Email me a link to set a password") : tr("Forgot it? Email me a reset link")}
          </button>
        </div>
        {linkState === 'sent' && <p role="status" style={{ fontSize: 13, color: 'var(--green)', margin: '10px 0 0', fontWeight: 600 }}>{tr("Link sent to")} {user?.email}{tr(". It expires in 1 hour.")}</p>}
        {linkState === 'error' && <p role="alert" style={{ fontSize: 13, color: 'var(--red)', margin: '10px 0 0', fontWeight: 600 }}>{tr("Could not send the link. Please try again in a few minutes.")}</p>}
      </form>
    </section>
  )
}

/** Old links (/dashboard/messages?to=5, emails, notifications) open this role's own page. */
function RoleRedirect({ to }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

/**
 * The Terms of Service or Privacy Policy changed since this account last agreed: ask again
 * before anything else. The only other choice is to sign out.
 */
function TermsPrompt({ acceptTerms, logout }) {
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function agree() {
    setBusy(true); setErr('')
    try { await acceptTerms() } catch (e) { setErr(e.message || 'We couldn’t save that. Please try again.') } finally { setBusy(false) }
  }
  return (
    <Dialog tone="info" title="We updated our Terms and Privacy Policy" onClose={() => {}} busy={busy}
      actions={[{ label: busy ? 'Saving…' : 'Continue', primary: true, onClick: () => (ok ? agree() : setErr('Tick the box to continue, or sign out.')) }, { label: 'Sign out', onClick: logout }]}>
      <p>Please read what changed, then agree to keep using hanapbuhay.</p>
      <div className="pf-consent"><label><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} />
        <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label></div>
      {err && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{err}</p>}
    </Dialog>
  )
}

/* ─ Main Dashboard shell ────────────────────────────────── */
export default function Dashboard() {
  const { user, logout, tokens, updateUser, call, acceptTerms } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [supportCount, setSupportCount] = useState(0)
  const { pathname } = useLocation()

  const role = user.role === 'admin' ? 'admin' : user.account_type

  // Filipino for workers: the dictionary downloads the first time, then the pages remount
  // in the new language (lang/dash.js). Employer and admin pages stay in English.
  const { lang } = useLanguage()
  const wantTl = lang === 'tl' && role === 'worker'
  const [tlState, setTlState] = useState(() => (tagalogLoaded() ? 'ready' : 'idle'))
  useEffect(() => {
    if (!wantTl || tagalogLoaded()) return
    setTlState('loading')
    loadTagalog().then(() => setTlState('ready')).catch(() => setTlState('failed'))
  }, [wantTl])
  setTagalog(wantTl)
  useEffect(() => () => setTagalog(false), []) // public pages (job list, job page) stay in their own language
  const tlWaiting = wantTl && !tagalogLoaded() && tlState !== 'failed'

  let Overview
  if (role === 'admin')         Overview = <AdminOverview call={call} />
  else if (role === 'hirer')    Overview = <ClientOverview user={user} call={call} />
  else if (role === 'employer') Overview = <EmployerOverview user={user} call={call} />
  else                          Overview = <WorkerOverview user={user} call={call} />

  if (tlWaiting) return <div className="sidebar-layout"><div className="dash-content"><PageLoading /></div></div>

  return (
    <div className="sidebar-layout" style={{ position: 'relative' }} key={`${user.id}-${role}-${wantTl && tagalogLoaded() ? 'tl' : 'en'}`} lang={wantTl && tagalogLoaded() ? 'fil' : 'en'}>
      {user.needs_terms && <TermsPrompt acceptTerms={acceptTerms} logout={logout} />}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 55, display: 'none' }}
          className="mob-overlay" />
      )}

      <Sidebar user={user} logout={logout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} badges={{ support: supportCount }} />

      <div className="dash-content">
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} call={call} onSupportCount={setSupportCount} />
        <InstallApp />
        <PageHeader user={user} />

        {/* a page that can't load shows a message here; the sidebar keeps working */}
        <PageErrorBoundary key={pathname}>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Universal root dashboard overview */}
          <Route index element={Overview} />

          {/* The public pages, inside this shell. Every role gets them: an admin can look at
              the live job board and the map without signing out, which is how they check
              what people actually see. */}
          <Route path="browse"      element={<JobSearch embedded basePath="/dashboard/browse" />} />
          <Route path="browse/:id"  element={<JobView  embedded basePath="/dashboard/browse" />} />
          <Route path="map"         element={<JobMapPage embedded basePath="/dashboard/browse" />} />
          <Route path="training"    element={<TrainingBrowser embedded heading={false} />} />

          {/* People: following, connections and the profile behind every name */}
          <Route path="network"     element={<Network call={call} user={user} />} />
          <Route path="people/:id"  element={<PublicProfile call={call} user={user} />} />
          <Route path="reviews"     element={<Reviews call={call} user={user} />} />

          {/* Communication & settings. Messages has one address per role; the old address forwards. */}
          <Route path="messages" element={<RoleRedirect to={MESSAGES_PATH[roleOf(user)]} />} />
          <Route path="support" element={role === 'admin' ? <AdminSupport call={call} /> : <HelpSupport call={call} user={user} />} />
          <Route path="subscription" element={PLAN_PATH[role] ? <RoleRedirect to={PLAN_PATH[role]} /> : <Navigate to="/dashboard" replace />} />
          <Route path="settings" element={<Settings user={user} call={call} updateUser={updateUser} />} />

          {/* ── WORKER SPECIFIC PAGES (Worker / Jobseeker Only) ── */}
          {(role !== 'employer' && role !== 'hirer' && role !== 'admin') && (
            <>
              <Route path="profile"  element={<WorkerProfile user={user} call={call} tokens={tokens} updateUser={updateUser} />} />
              <Route path="resume"   element={<ResumeBuilder user={user} call={call} />} />
              <Route path="passport" element={<SkillsPassport call={call} tokens={tokens} user={user} updateUser={updateUser} />} />
              <Route path="passport/certificates" element={<SkillsPassport tab="certificates" call={call} tokens={tokens} user={user} updateUser={updateUser} />} />
              <Route path="passport/work" element={<SkillsPassport tab="work" call={call} tokens={tokens} user={user} updateUser={updateUser} />} />
              <Route path="matches"  element={<JobMatches call={call} user={user} />} />
              <Route path="applied"  element={<MyApplications call={call} />} />
              <Route path="saved"    element={<SavedJobs call={call} user={user} />} />
              <Route path="worker/messages" element={<WorkerMessages key={user.id} call={call} user={user} />} />
              <Route path="gigs"              element={<WorkerGigBoard call={call} user={user} />} />
              <Route path="gigs/proposals"    element={<WorkerProposals call={call} />} />
              <Route path="gigs/contracts"    element={<WorkerContracts call={call} />} />
              <Route path="gigs/contracts/:id" element={<WorkerContract call={call} />} />
              <Route path="gigs/services"     element={<WorkerServices call={call} user={user} />} />
              <Route path="gigs/services/:id" element={<ServiceDetail call={call} role="worker" />} />
              <Route path="verification"      element={<WorkerVerification call={call} user={user} updateUser={updateUser} />} />
            </>
          )}

          {/* ── CLIENT (SERVICE BUYER) PAGES ── */}
          {role === 'hirer' && (
            <>
              <Route path="profile"            element={<ClientProfile user={user} call={call} updateUser={updateUser} />} />
              <Route path="gigs"               element={<ClientGigs call={call} />} />
              <Route path="gigs/new"           element={<ClientPostGig call={call} user={user} />} />
              <Route path="gigs/:id/edit"      element={<ClientPostGig call={call} user={user} />} />
              <Route path="proposals"          element={<ClientProposals call={call} />} />
              <Route path="contracts"          element={<ClientContracts call={call} />} />
              <Route path="contracts/:id"      element={<ClientContract call={call} />} />
              <Route path="talent"             element={<ClientFindWorkers call={call} />} />
              <Route path="talent/services"    element={<ClientServices call={call} />} />
              <Route path="talent/services/:id" element={<ServiceDetail call={call} role="hirer" />} />
              <Route path="talent/saved"       element={<ClientSavedWorkers call={call} />} />
              <Route path="talent/:id"         element={<ClientTalentProfile call={call} />} />
              <Route path="client/messages"    element={<ClientMessages key={user.id} call={call} user={user} />} />
              <Route path="pass"               element={<ClientPass call={call} updateUser={updateUser} />} />
              <Route path="verification"       element={<ClientVerification call={call} user={user} updateUser={updateUser} />} />
              {/* old client links */}
              <Route path="jobs"               element={<Navigate to="/dashboard/gigs" replace />} />
              <Route path="jobs/new"           element={<Navigate to="/dashboard/gigs/new" replace />} />
              <Route path="applicants"         element={<Navigate to="/dashboard/proposals" replace />} />
            </>
          )}

          {/* ── EMPLOYER PAGES ── */}
          {role === 'employer' && (
            <>
              <Route path="profile"           element={<EmployerProfile user={user} call={call} updateUser={updateUser} />} />
              <Route path="jobs"              element={<EmployerJobs call={call} user={user} />} />
              <Route path="jobs/new"          element={<PostJob call={call} />} />
              <Route path="jobs/:id/edit"     element={<PostJobEdit call={call} />} />
              <Route path="applicants"        element={<EmployerApplicants call={call} />} />
              <Route path="applicants/:jobId" element={<EmployerApplicants call={call} />} />
              <Route path="talent"            element={<FindWorkers call={call} />} />
              <Route path="talent/saved"      element={<SavedWorkers call={call} />} />
              <Route path="talent/:id"        element={<TalentProfile call={call} />} />
              <Route path="employer/messages" element={<EmployerMessages key={user.id} call={call} user={user} />} />
              <Route path="plans"             element={<EmployerPlans call={call} updateUser={updateUser} />} />
              <Route path="verification"      element={<EmployerVerification call={call} user={user} updateUser={updateUser} />} />
            </>
          )}

          {/* ── ADMIN SPECIFIC PAGES (Admin Only) ── */}
          {role === 'admin' && (
            <>
              <Route path="profile"  element={<AdminProfile user={user} call={call} updateUser={updateUser} />} />
              <Route path="users"    element={<AdminUsers call={call} />} />
              <Route path="jobs"     element={<AdminPosts call={call} />} />
              <Route path="reports"  element={<AdminReports call={call} />} />
              <Route path="verify"   element={<AdminVerificationHub call={call} />} />
              <Route path="payments" element={<AdminPaymentsPage call={call} />} />
              <Route path="disputes" element={<AdminDisputes call={call} />} />
              <Route path="gig-contracts"  element={<AdminGigContracts call={call} />} />
              <Route path="hiring-monitor" element={<AdminHiringMonitor call={call} />} />
              <Route path="admin/messages" element={<AdminMessages key={user.id} call={call} user={user} />} />
            </>
          )}

          {/* Catch-all: If user tries to access a page outside their role, redirect safely to /dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        </PageErrorBoundary>
      </div>
    </div>
  )
}
