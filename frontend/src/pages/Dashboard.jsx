import { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation, useParams, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { api } from '../api.js'
import {
  Logo, IconUser, IconBriefcase, IconShield, IconFile, IconBook,
  IconUsers, IconHome, IconPin, IconMail, IconCheck, IconSpark,
  IconChevron, IconLogout, IconMap, IconBell, IconMsgCircle,
  IconSearch, IconPlus, IconTrend, IconSettings, IconMenu, IconX,
  IconClock, IconArrow, IconCalendar, IconBuilding, IconEdit, IconTrash,
  IconSend, IconFilter, IconStar, IconPhone, IconWrench, IconAlert, IconEye
} from '../components/icons.jsx'
import { Avatar, TYPES, TOWNS } from '../components/art.jsx'
import ImageCropModal from '../components/ImageCropModal.jsx'
import { getJobImage } from '../utils/jobImages.js'
import { db, firebaseConfigured } from '../firebase.js'
import {
  ref as dbRef, push, onValue, off, serverTimestamp, query,
  orderByChild, limitToLast, get, set, update
} from 'firebase/database'

import Subscription from '../components/Subscription.jsx'

/* ─ Time greeting ───────────────────────────────────────── */
const GREET = ['Magandang umaga', 'Magandang tanghali', 'Magandang hapon', 'Magandang gabi']
const greet = () => { const h = new Date().getHours(); return GREET[h < 11 ? 0 : h < 14 ? 1 : h < 18 ? 2 : 3] }
const fmt = (n, max) => { if (!n && !max) return 'Negotiable'; const f = v => '₱'+Number(v).toLocaleString(); return n && max ? `${f(n)}–${f(max)}/mo` : n ? `From ${f(n)}/mo` : `Up to ${f(max)}/mo` }
const days = dt => { const d = Math.floor((Date.now()-new Date(dt))/86400000); return d===0?'Today':d===1?'1 day ago':`${d}d ago` }

const DEMO_FEATURED_JOBS = [
  { id: 1, title: 'Civil Engineer (Site)', company: 'DMC Major Construction', location: 'Calapan City, Oriental Mindoro', job_type: 'full-time', salary_min: 25000, salary_max: 35000, match_pct: 95, is_featured: 1, description: 'Looking for a licensed or experienced Civil Engineer for infrastructure and commercial building projects across Oriental Mindoro.' },
  { id: 2, title: 'Construction Worker', company: 'Vicor Construction Services', location: 'Calapan City, Oriental Mindoro', job_type: 'full-time', salary_min: 15000, salary_max: 20000, match_pct: 92, is_featured: 1, description: 'Skilled carpenters, masons, and general construction workers needed for immediate deployment on ongoing municipal developments.' },
  { id: 3, title: 'Electrician (Commercial)', company: 'Calapan Power Solutions', location: 'Calapan City, Oriental Mindoro', job_type: 'contractual', salary_min: 14000, salary_max: 22000, match_pct: 88, is_featured: 1, description: 'Certified NC II Electricians for commercial wiring, transformer maintenance, and solar rooftop installations in Calapan City.' },
  { id: 4, title: 'Graphic Designer', company: 'Mindoro Creative Studio', location: 'Naujan, Oriental Mindoro', job_type: 'freelance', salary_min: 15000, salary_max: null, match_pct: 85, is_featured: 1, description: 'Creative graphic designer for local brand marketing, MSME packaging, social media promotional campaigns, and print materials.' },
  { id: 5, title: 'Welder (SMAW / GTAW)', company: 'Mindoro Metal Works', location: 'Bongabong, Oriental Mindoro', job_type: 'contractual', salary_min: 12000, salary_max: 18000, match_pct: 80, is_featured: 1, description: 'Structural welders with TESDA NC II certification for metal fabrication, gate construction, and agricultural machinery repair.' },
  { id: 6, title: 'Service Crew & Barista', company: 'Oriental Food Corp', location: 'Calapan City, Oriental Mindoro', job_type: 'part-time', salary_min: 8000, salary_max: 12000, match_pct: 78, is_featured: 1, description: 'Customer-oriented service crew and beverage specialists for busy food establishment in Calapan City.' }
]

/* ─ Sidebar nav config ──────────────────────────────────── */
const WORKER_NAV = [
  { to: '/dashboard',           icon: IconHome,      label: 'Dashboard' },
  { to: '/dashboard/profile',   icon: IconUser,      label: 'My Profile' },
  { to: '/dashboard/passport',  icon: IconShield,    label: 'Skills Passport' },
  { to: '/dashboard/featured',  icon: IconStar,      label: 'Featured Jobs' },
  { to: '/dashboard/matches',   icon: IconSpark,     label: 'Job Matches' },
  { to: '/dashboard/applied',   icon: IconBriefcase, label: 'Applications' },
  { to: '/dashboard/training',  icon: IconBook,      label: 'Training & Courses' },
  { to: '/dashboard/messages',  icon: IconMsgCircle, label: 'Messages' },
  { to: '/dashboard/settings',  icon: IconSettings,  label: 'Settings' },
]
const EMPLOYER_NAV = [
  { to: '/dashboard',           icon: IconHome,      label: 'Dashboard' },
  { to: '/dashboard/profile',   icon: IconBuilding,  label: 'Business Profile' },
  { to: '/dashboard/jobs',      icon: IconBriefcase, label: 'My Job Posts' },
  { to: '/dashboard/applicants',icon: IconUsers,     label: 'Applicants' },
  { to: '/dashboard/subscription',icon: IconSpark,   label: 'Hiring Packages' },
  { to: '/dashboard/messages',  icon: IconMsgCircle, label: 'Messages' },
  { to: '/dashboard/settings',  icon: IconSettings,  label: 'Settings' },
]
const HIRER_NAV = [
  { to: '/dashboard',           icon: IconHome,      label: 'Dashboard' },
  { to: '/dashboard/profile',   icon: IconBuilding,  label: 'Client Profile' },
  { to: '/dashboard/jobs',      icon: IconBriefcase, label: 'My Service Requests' },
  { to: '/dashboard/applicants',icon: IconUsers,     label: 'Worker Quotes' },
  { to: '/dashboard/subscription',icon: IconSpark,   label: 'Service Buyer Pass' },
  { to: '/dashboard/messages',  icon: IconMsgCircle, label: 'Messages' },
  { to: '/dashboard/settings',  icon: IconSettings,  label: 'Settings' },
]
const ADMIN_NAV = [
  { to: '/dashboard',           icon: IconHome,      label: 'Overview' },
  { to: '/dashboard/profile',   icon: IconUser,      label: 'Admin Profile' },
  { to: '/dashboard/users',     icon: IconUsers,     label: 'User Management' },
  { to: '/dashboard/jobs',      icon: IconBriefcase, label: 'Job Moderation' },
  { to: '/dashboard/payments',  icon: IconSpark,     label: 'Payments & Revenue' },
  { to: '/dashboard/verify',    icon: IconShield,    label: 'Verification' },
  { to: '/dashboard/messages',  icon: IconMsgCircle, label: 'Messages' },
  { to: '/dashboard/settings',  icon: IconSettings,  label: 'Settings' },
]

/* ─ Sidebar ─────────────────────────────────────────────── */
function Sidebar({ user, logout, nav, open, onClose }) {
  const location = useLocation()
  const role = user.role === 'admin' ? 'admin' : user.account_type
  const navItems = nav || (role === 'admin' ? ADMIN_NAV : role === 'hirer' ? HIRER_NAV : role === 'employer' ? EMPLOYER_NAV : WORKER_NAV)

  return (
    <aside className={`sidebar ${open ? 'mob-open' : ''}`}>
      <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo light to="/dashboard" />
        <button onClick={onClose} style={{ display: 'none', background: 'none', border: 0, color: 'rgba(255,255,255,.6)', cursor: 'pointer' }} className="mob-close-btn">
          <IconX size={20} />
        </button>
      </div>

      {/* User chip */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar avatar-gold" style={{ overflow: 'hidden' }}>
            <img src={user.picture || '/images/avatar.jpg'} alt={user.full_name || 'User'} onError={e => { e.currentTarget.style.display = 'none' }} />
            <span>{(user.full_name || user.email)[0].toUpperCase()}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.full_name || 'Your Account'}
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'capitalize' }}>
              {user.role === 'admin' ? 'Administrator' : (user.account_type || 'No type set')}
            </p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Dashboard navigation">
        {navItems.map(({ to, icon: Ic, label }) => (
          <Link key={to} to={to}
            className={location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to)) ? 'active' : ''}
            onClick={onClose}>
            <Ic size={18} />{label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {role === 'worker' && (
          <>
            <Link to="/jobs" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.6)', transition: '.2s' }}>
              <IconSearch size={18} />Browse Jobs
            </Link>
            <Link to="/map" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>
              <IconMap size={18} />Job Map
            </Link>
          </>
        )}
        <button style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.55)', background: 'none', border: 0, cursor: 'pointer', width: '100%' }} onClick={logout}>
          <IconLogout size={18} />Sign Out
        </button>
      </div>
    </aside>
  )
}

/* ─ Topbar ──────────────────────────────────────────────── */
function Topbar({ user, onToggleSidebar, call }) {
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
    } catch {
      // quiet fallback
    }
  }, [call])

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => clearInterval(timer)
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

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', color: 'var(--muted)', cursor: 'pointer' }} onClick={onToggleSidebar}>
          <IconMenu size={22} />
        </button>
      </div>
      <div className="topbar-right">
        {(user.account_type === 'employer' || user.account_type === 'hirer') ? (
          <Link to="/dashboard/jobs/new" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPlus size={14} /> Post Job
          </Link>
        ) : (user.role !== 'admin' && (
          <Link to="/jobs" className="btn btn-light btn-sm"><IconSearch size={15} />Find Jobs</Link>
        ))}

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="notif-btn"
            title="Notifications & Emails"
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
                  <b style={{ fontSize: 13, color: 'var(--navy-d)' }}>Notifications &amp; Emails</b>
                  <span className="chip green" style={{ fontSize: 10, padding: '1px 6px' }}>Auto</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{notifs.length} total</span>
              </div>
              <div style={{ padding: '4px 0' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <div style={{ marginBottom: 6, color: '#94a3b8' }}><IconBell size={24} /></div>
                    No notifications yet.
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
                            <IconMail size={11} /> Email
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
                              <IconMail size={11} /> Preview Email
                            </button>
                          )}
                          {n.link && (
                            <Link
                              to={n.link}
                              onClick={() => setNotifOpen(false)}
                              className="btn btn-light btn-xs"
                              style={{ fontSize: 11, padding: '2px 8px', textDecoration: 'none' }}
                            >
                              Open &rarr;
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
                  Notification Settings &rarr;
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
                      <IconMail size={12} /> Official HanapBuhay Email
                    </span>
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <IconCheck size={11} /> Live in Account
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
                  aria-label="Close"
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Meta bar */}
              <div style={{ padding: '10px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 12, color: '#475569', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                <div>
                  <span><strong>To:</strong> {activeEmail.email_to || user.email}</span> &bull; <span><strong>From:</strong> HanapBuhay Oriental Mindoro</span>
                </div>
                <div>
                  <span>{days(activeEmail.created_at)}</span>
                </div>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f8fafc' }}>
                {activeEmail.email_html ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: activeEmail.email_html }}
                    style={{ borderRadius: 8, overflow: 'hidden' }}
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
                  HanapBuhay Automated Email System
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveEmail(null)} className="btn btn-light btn-sm">Close</button>
                  {activeEmail.link && (
                    <Link
                      to={activeEmail.link}
                      onClick={() => setActiveEmail(null)}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 600 }}
                    >
                      Open in App &rarr;
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
            <div className="avatar" style={{ overflow: 'hidden' }}>
              <img src={user.picture || '/images/avatar.jpg'} alt={user.full_name || 'Account'} onError={e => { e.currentTarget.style.display = 'none' }} />
              <span>{(user.full_name || user.email)[0].toUpperCase()}</span>
            </div>
            <span className="umenu-name">{user.full_name?.split(' ')[0] || 'Account'}</span>
            <IconChevron size={15} className={menuOpen ? 'flip' : ''} />
          </button>
          {menuOpen && (
            <div className="umenu-pop" role="menu">
              <div className="umenu-who">
                <b>{user.full_name || 'Your account'}</b>
                <small>{user.email}</small>
                <span className="chip navy">{label}</span>
              </div>
              <Link to="/dashboard/profile" role="menuitem"><IconUser size={16} />My Profile</Link>
              <Link to="/dashboard/settings" role="menuitem"><IconSettings size={16} />Settings</Link>
              <button role="menuitem" onClick={logout}><IconLogout size={16} />Sign Out</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─ Worker Overview ─────────────────────────────────────── */
function WorkerOverview({ user, call }) {
  const [stats, setStats]       = useState({ matches: 0, applied: 0, training: 3, gaps: 2 })
  const [jobs, setJobs]         = useState([])
  const [apps, setApps]         = useState([])
  const [passport, setPassport] = useState({ score: 0, skills_count: 0 })
  const [activity, setActivity] = useState([])
  const [featuredJobs, setFeaturedJobs] = useState([])
  const [loadingFeatured, setLoadingFeatured] = useState(true)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [applying, setApplying] = useState(null)
  const [applySuccess, setApplySuccess] = useState({})

  useEffect(() => {
    Promise.allSettled([
      call('/skills/passport-score').then(r => setPassport(r)),
      call('/applications/my').then(r => {
        const arr = r.applications || []
        setApps(arr.slice(0, 4))
        setStats(s => ({ ...s, applied: arr.length }))
        setAppliedIds(new Set(arr.map(a => Number(a.job_id))))
        setActivity(arr.slice(0, 3).map(a => ({
          text: `You applied for ${a.job_title || 'a job'}`,
          when: days(a.created_at), type: 'blue'
        })))
      }),
      call('/jobs?limit=50').then(r => {
        const list = r.data || r.jobs || []
        setJobs(list.slice(0, 3))
        setStats(s => ({ ...s, matches: list.length }))
      }),
      call('/jobs/featured').then(r => {
        const list = r?.jobs || []
        if (list.length > 0) {
          setFeaturedJobs(list)
        } else {
          setFeaturedJobs(DEMO_FEATURED_JOBS)
        }
      }).catch(() => {
        setFeaturedJobs(DEMO_FEATURED_JOBS)
      }).finally(() => {
        setLoadingFeatured(false)
      })
    ])
  }, [call])

  const handleQuickApply = async (job) => {
    setApplying(job.id)
    try {
      await call('/applications', {
        method: 'POST',
        body: {
          job_id: job.id,
          cover_note: `Hello! I would like to apply for the ${job.title} position at ${job.company || job.employer_name || 'your company'}. My profile and skills match this opportunity.`
        }
      })
      setApplySuccess(prev => ({ ...prev, [job.id]: true }))
      setAppliedIds(prev => new Set([...prev, Number(job.id)]))
      setStats(s => ({ ...s, applied: s.applied + 1 }))
    } catch (err) {
      if (err?.status === 401 || err?.message === 'Unauthorized') {
        alert('Your session has expired. Please sign in again.')
        window.location.href = '/login'
      } else {
        alert(err?.message || 'Failed to submit application.')
      }
    } finally {
      setApplying(null)
    }
  }

  const type = TYPES.find(t => t.id === user.account_type)
  const first = user.full_name?.split(' ')[0] || 'there'

  return (
    <div className="page-inner">
      {/* Welcome banner */}
      <div className="welcome-banner rise">
        <div className="banner-glow" aria-hidden="true" />
        <div className="welcome-banner-copy">
          <p className="eyebrow light">{type?.name || 'Worker'}</p>
          <h1>{greet()}, {first}!</h1>
          <p>Here's your progress and opportunities.</p>
          <Link to="/dashboard/passport" className="btn btn-primary" style={{ marginTop: 18, width: 'fit-content' }}>
            {passport.score < 100 ? 'Complete Profile' : 'View Passport'}
          </Link>
        </div>
        <div className="welcome-banner-art" aria-hidden="true" style={{ width: 88, height: 88, borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          <img src={user.picture || '/images/avatar.jpg'} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        {[
          { icon: IconSpark, bg: 'var(--navy-soft)', color: 'var(--navy)', val: stats.matches, label: 'Job Matches', sub: 'New opportunities' },
          { icon: IconBriefcase, bg: 'var(--blue-l)', color: 'var(--blue)', val: stats.applied, label: 'Applications', sub: 'In progress' },
          { icon: IconBook, bg: 'var(--gold-l)', color: 'var(--amber)', val: stats.training, label: 'Training Programs', sub: 'Recommended' },
          { icon: IconShield, bg: 'var(--red-l)', color: 'var(--red)', val: stats.gaps, label: 'Skill Gaps', sub: 'Needs improvement' },
        ].map(({ icon: Ic, bg, color, val, label, sub }, i) => (
          <div key={label} className="dstat rise" style={{ '--d': `${i * 0.06}s` }}>
            <div className="dstat-icon" style={{ background: bg, color }}><Ic size={22} /></div>
            <div>
              <div className="dstat-val">{val}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
              <div className="dstat-label">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ⭐ Featured Jobs Showcase */}
      <div className="panel rise" style={{
        '--d': '.08s',
        padding: '24px 26px',
        marginBottom: 24,
        borderRadius: 18,
        border: '1px solid #fde047',
        background: 'linear-gradient(180deg, #fffdf0 0%, #ffffff 45%)',
        boxShadow: '0 4px 20px -2px rgba(234,179,8,0.12)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)',
              color: '#b45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              boxShadow: '0 4px 12px rgba(234,179,8,0.3)',
              flexShrink: 0
            }}>
              ⭐
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--navy-d)', letterSpacing: '-0.3px' }}>
                  Featured Jobs in Oriental Mindoro
                </h2>
                <span className="chip gold" style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', letterSpacing: '.4px' }}>
                  ⭐ PRIORITY HIRING
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                Verified job openings from top employers & local MSMEs actively hiring local talent
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/dashboard/featured" className="btn btn-light btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconStar size={14} /> View All Featured ({featuredJobs.length || DEMO_FEATURED_JOBS.length})
            </Link>
            <Link to="/jobs" className="btn btn-primary btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconBriefcase size={14} /> Browse All Jobs
            </Link>
          </div>
        </div>

        {loadingFeatured ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="skel" style={{ height: 190, borderRadius: 14 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {(featuredJobs.length > 0 ? featuredJobs : DEMO_FEATURED_JOBS).slice(0, 3).map((job, idx) => {
              const isApplied = appliedIds.has(Number(job.id)) || applySuccess[job.id]
              const isBusy = applying === job.id

              return (
                <div
                  key={job.id || idx}
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    border: '1px solid #f1f5f9',
                    borderTop: '3px solid var(--gold)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    padding: '18px 18px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'all .2s ease'
                  }}
                  className="featured-job-card"
                >
                  <div>
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: '#f8fafc',
                          border: '1px solid var(--line)',
                          flexShrink: 0,
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <img
                            src={getJobImage(job)}
                            alt={job.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { e.currentTarget.style.display = 'none' }}
                          />
                          <span style={{ position: 'absolute', fontWeight: 800, color: 'var(--navy)', fontSize: 16 }}>
                            {(job.company || job.employer_name || job.title || 'J')[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--navy-d)', lineHeight: 1.3 }}>
                            {job.title}
                          </h3>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{job.company || job.employer_name || 'Oriental Mindoro MSME'}</span>
                            <span title="Verified Employer" style={{ color: '#0284c7', fontSize: 12, fontWeight: 700 }}>● Verified</span>
                          </div>
                        </div>
                      </div>
                      <span className="chip gold" style={{ fontSize: 10, padding: '2px 7px', fontWeight: 700, flexShrink: 0 }}>
                        ⭐ Featured
                      </span>
                    </div>

                    {/* Meta chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconPin size={13} /> {job.location || 'Oriental Mindoro'}
                      </span>
                      <span className={`chip ${job.job_type === 'full-time' ? 'navy' : job.job_type === 'part-time' ? 'blue' : 'gray'}`} style={{ fontSize: 11, padding: '2px 8px', textTransform: 'capitalize' }}>
                        {(job.job_type || 'Full-time').replace('-', ' ')}
                      </span>
                      {job.match_pct && (
                        <span className="chip green" style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>
                          {job.match_pct}% Match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom offer & actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f1f5f9', marginTop: 4 }}>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '.4px' }}>
                        Salary Offer
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy-d)' }}>
                        {fmt(job.salary_min, job.salary_max)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Link
                        to={`/jobs/${job.id}`}
                        className="btn btn-light btn-sm"
                        style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
                      >
                        Details
                      </Link>
                      {isApplied ? (
                        <span className="chip green" style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconCheck size={13} /> Applied
                        </span>
                      ) : (
                        <button
                          className="btn btn-navy btn-sm"
                          disabled={isBusy}
                          onClick={() => handleQuickApply(job)}
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {isBusy ? 'Applying…' : 'Quick Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="dash-grid">
        {/* Main col */}
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Skills Passport */}
          <div className="panel rise" style={{ '--d': '.1s' }}>
            <div className="panel-hd">
              <h2>Your Skills Passport</h2>
              <Link to="/dashboard/passport" className="btn btn-light btn-sm">View All</Link>
            </div>
            <div className="passport-score">
              <div className="ring ring-gold ring-lg" style={{ '--p': passport.score }}>
                <span>{passport.score}%</span>
              </div>
              <div className="passport-score-text">
                <b>Profile Completion</b>
                <small style={{ display: 'block', marginTop: 4 }}>Keep updating your skills and experience</small>
                <div className="bar bar-gold" style={{ marginTop: 10, width: 200 }}>
                  <i style={{ '--w': `${passport.score}%` }} />
                </div>
              </div>
            </div>
            <Link to="/dashboard/passport" className="btn btn-navy btn-sm" style={{ width: 'fit-content' }}>Update Passport</Link>
          </div>

          {/* Recent Applications */}
          <div className="panel rise" style={{ '--d': '.15s' }}>
            <div className="panel-hd">
              <h2>Applications</h2>
              <Link to="/dashboard/applied" className="btn btn-light btn-sm">View All</Link>
            </div>
            {apps.length === 0
              ? <p style={{ color: 'var(--muted)', fontSize: 14 }}>No applications yet. <Link to="/jobs" style={{ color: 'var(--navy)', fontWeight: 600 }}>Browse jobs →</Link></p>
              : <div className="app-list">
                  {apps.map(a => (
                    <div key={a.id} className="app-item">
                      <div className="dstat-icon" style={{ background: 'var(--navy-soft)', color: 'var(--navy)', width: 42, height: 42 }}>
                        <IconBriefcase size={18} />
                      </div>
                      <div>
                        <b>{a.job_title || 'Job Application'}</b>
                        <p>{a.company || a.employer_name} · {a.job_location}</p>
                      </div>
                      <span className={`app-status ${a.status}`}>{a.status}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Side col */}
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Recommended Jobs */}
          <div className="panel rise" style={{ '--d': '.2s' }}>
            <div className="panel-hd">
              <h3>Recommended Jobs</h3>
              <Link to="/jobs" className="btn btn-light btn-sm">View All</Link>
            </div>
            <div className="rec-list">
              {jobs.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading recommendations…</p>
                : jobs.map((j, i) => (
                  <Link key={j.id || i} to={`/jobs/${j.id}`} className="rec-job">
                    <div className="rec-job-logo" style={{ overflow: 'hidden', position: 'relative' }}>
                      <img src={getJobImage(j)} alt={j.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                      <span>{(j.company || j.title || 'J')[0]}</span>
                    </div>
                    <div>
                      <b>{j.title}</b>
                      <small>{j.company || j.employer_name} · {j.location}</small>
                    </div>
                    <div className="rec-job-match">
                      {j.match_pct && <span className="chip green">{j.match_pct}%</span>}
                    </div>
                  </Link>
                ))
              }
            </div>
          </div>

          {/* Need help */}
          <div style={{ background: 'linear-gradient(135deg, var(--navy), var(--navy-l))', borderRadius: 'var(--r-xl)', padding: 22, color: '#fff' }}>
            <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Need Help?</h3>
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>Contact our support team for job placement assistance.</p>
            <Link to="/dashboard/messages" className="btn btn-primary btn-sm">Get Help</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─ Employer Overview ───────────────────────────────────── */
function EmployerOverview({ user, call }) {
  const [stats, setStats] = useState({ jobs: 0, applicants: 0, hired: 0, views: 0 })
  const [jobs, setJobs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      call('/jobs/my').catch(e => { console.error('[EmployerOverview] jobs error:', e); return { jobs: [] } }),
      call('/applications/employer').catch(() => ({ applications: [] }))
    ]).then(([jobsRes, appsRes]) => {
      const arr = jobsRes.jobs || []
      const apps = appsRes.applications || []
      setJobs(arr.slice(0, 5))
      setStats({
        jobs: arr.length,
        applicants: apps.length,
        hired: apps.filter(a => a.status === 'hired').length,
        views: arr.reduce((a, j) => a + (j.views || 0), 0)
      })
    }).catch(e => {
      setError(e.message || 'Failed to load dashboard data.')
    }).finally(() => setLoading(false))
  }, [call])

  const first = user.full_name?.split(' ')[0] || 'there'

  return (
    <div className="page-inner">
      <div className="welcome-banner rise">
        <div className="banner-glow" />
        <div className="welcome-banner-copy">
          <p className="eyebrow light">Employer Dashboard</p>
          <h1>Good morning, {first}!</h1>
          <p>Here's your progress and opportunities.</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <Link to="/dashboard/jobs/new" className="btn btn-primary" style={{ width: 'fit-content' }}>
              <IconPlus size={16} /> Post a Job
            </Link>
            <Link to="/dashboard/subscription" className="btn" style={{ width: 'fit-content', background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <IconSpark size={16} color="var(--gold)" /> {user.account_type === 'hirer' ? 'Service Buyer Pass' : 'Hiring Subscription'}
            </Link>
          </div>
        </div>
      </div>

      <div className="dash-stats">
        {[
          { icon: IconBriefcase, bg: 'var(--navy-soft)', color: 'var(--navy)', val: stats.jobs, label: 'Active Jobs' },
          { icon: IconUsers, bg: 'var(--blue-l)', color: 'var(--blue)', val: stats.applicants, label: 'Applicants' },
          { icon: IconCheck, bg: 'var(--green-l)', color: 'var(--green)', val: stats.hired, label: 'Hired' },
          { icon: IconTrend, bg: 'var(--gold-l)', color: 'var(--amber)', val: stats.views, label: 'Total Views' },
        ].map(({ icon: Ic, bg, color, val, label }) => (
          <div key={label} className="dstat">
            <div className="dstat-icon" style={{ background: bg, color }}><Ic size={22} /></div>
            <div>
              <div className="dstat-val">{val}</div>
              <div className="dstat-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-hd">
          <h2>My Job Posts</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/dashboard/jobs/new" className="btn btn-primary btn-sm"><IconPlus size={14} /> Post Job</Link>
            <Link to="/dashboard/jobs" className="btn btn-light btn-sm">View All</Link>
          </div>
        </div>
        {loading
          ? <p style={{ color: 'var(--muted)', fontSize: 14, padding: '24px 0', textAlign: 'center' }}>Loading your job posts…</p>
          : error
          ? <div style={{ padding: '20px 0', color: '#c0392b', fontSize: 14 }}>
              <b>Error:</b> {error}
              <br /><small style={{ color: 'var(--muted)' }}>Check the browser console (F12) for details.</small>
            </div>
          : jobs.length === 0
          ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <IconBriefcase size={36} style={{ margin: '0 auto 12px', opacity: .4 }} />
              <p style={{ marginBottom: 14 }}>No job posts yet. Start by posting your first job.</p>
              <Link to="/dashboard/jobs/new" className="btn btn-navy">Post a Job <IconArrow /></Link>
            </div>
          : <div className="table-wrap"><table>
              <thead><tr><th>Title</th><th>Location</th><th>Type</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td style={{ fontWeight: 600 }}>{j.title}</td>
                    <td>{j.location}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(j.job_type||'').replace('-',' ')}</td>
                    <td><span className={`status-badge ${j.status}`}>{j.status}</span></td>
                    <td>{j.views || 0}</td>
                    <td>
                      <div className="actions-row">
                        <Link to={`/dashboard/applicants/${j.id}`} className="btn btn-light btn-sm">Applicants</Link>
                        <Link to={`/dashboard/jobs/${j.id}/edit`} className="btn btn-light btn-sm"><IconEdit size={14} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
        }
      </div>
    </div>
  )
}

/* ─ My Job Posts (Employer) ────────────────────────────── */
function EmployerJobs({ call, tokens }) {
  const navigate = useNavigate()
  const [jobs, setJobs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    call('/jobs/my')
      .then(r => {
        console.log('[EmployerJobs] jobs:', r)
        setJobs(r.jobs || [])
      })
      .catch(e => {
        console.error('[EmployerJobs] error:', e)
        setError(e.message || 'Failed to load jobs.')
      })
      .finally(() => setLoading(false))
  }, [call])

  useEffect(() => { load() }, [load])

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await api(`/jobs/${id}`, { method: 'DELETE', token: tokens?.access_token })
      setJobs(j => j.filter(x => x.id !== id))
    } catch (e) { alert('Delete failed: ' + e.message) }
    setDeleting(null)
  }

  const STATUS_COLOR = { active: '#22c55e', archived: '#94a3b8', draft: '#f59e0b' }

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow">Employer</p>
          <h1 style={{ fontSize: 28, letterSpacing: '-.04em', marginTop: 4 }}>My Job Posts</h1>
        </div>
        <Link to="/dashboard/jobs/new" className="btn btn-primary">
          <IconPlus size={16} /> Post a Job
        </Link>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#c0392b', fontSize: 14 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
          <span className="spin" style={{ display: 'inline-block', marginBottom: 12 }} />
          <p>Loading your job posts…</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '56px 0', color: 'var(--muted)' }}>
          <IconBriefcase size={44} style={{ margin: '0 auto 16px', opacity: .35 }} />
          <h2 style={{ fontSize: 20, marginBottom: 8, color: 'var(--ink)' }}>No job posts yet</h2>
          <p style={{ marginBottom: 24 }}>Post your first job and start finding local talent.</p>
          <Link to="/dashboard/jobs/new" className="btn btn-primary">
            <IconPlus size={16} /> Post a Job
          </Link>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  {['Job Title', 'Type', 'Location', 'Salary', 'Status', 'Views', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((j, i) => (
                  <tr key={j.id} style={{ borderBottom: i < jobs.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>{j.title}</div>
                      {j.company && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{j.company}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, background: 'var(--navy-soft)', color: 'var(--navy)', padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {(j.job_type || '').replace('-', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {j.location || '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                      {fmt(j.salary_min, j.salary_max)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: STATUS_COLOR[j.status] || 'var(--muted)', textTransform: 'capitalize' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[j.status] || 'var(--muted)', display: 'inline-block' }} />
                        {j.status || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                      {j.views || 0}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Link to={`/dashboard/applicants/${j.id}`} className="btn btn-light btn-sm" style={{ whiteSpace: 'nowrap' }}>
                          <IconUsers size={13} /> Applicants
                        </Link>
                        <Link to={`/dashboard/jobs/${j.id}/edit`} className="btn btn-light btn-sm" title="Edit">
                          <IconEdit size={13} />
                        </Link>
                        <button
                          className="btn btn-light btn-sm"
                          title="Delete"
                          disabled={deleting === j.id}
                          onClick={() => handleDelete(j.id, j.title)}
                          style={{ color: '#e74c3c' }}
                        >
                          {deleting === j.id ? <span className="spin" style={{ width: 12, height: 12 }} /> : <IconTrash size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{jobs.length} job post{jobs.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-light btn-sm" onClick={load}>↻ Refresh</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─ Post / Edit Job ─────────────────────────────────────── */
function PostJob({ call, tokens, editId = null }) {
  const navigate = useNavigate()
  const TOWNS_LIST = [
    'Baco','Bansud','Bongabong','Bulalacao','Calapan City','Gloria',
    'Mansalay','Naujan','Pinamalayan','Pola','Puerto Galera','Roxas',
    'San Teodoro','Socorro','Victoria',
  ]
  const TYPES_LIST = ['full-time','part-time','contractual','freelance','gig']

  const blank = { title:'', company:'', job_type:'full-time', location:'', salary_min:'', salary_max:'', description:'', requirements:'', skills_needed:'' }
  const [form, setForm]     = useState(blank)
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState(null)
  const [loaded, setLoaded] = useState(!editId)

  useEffect(() => {
    if (!editId) return
    call(`/jobs/${editId}`).then(r => {
      const j = r.job || {}
      setForm({
        title:         j.title || '',
        company:       j.company || '',
        job_type:      j.job_type || 'full-time',
        location:      j.location || '',
        salary_min:    j.salary_min ?? '',
        salary_max:    j.salary_max ?? '',
        description:   j.description || '',
        requirements:  j.requirements || '',
        skills_needed: j.skills_needed || '',
      })
      setLoaded(true)
    }).catch(e => { setErr(e.message); setLoaded(true) })
  }, [editId, call])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setSaving(true)
    try {
      const body = {
        ...form,
        salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
      }
      if (editId) {
        await api(`/jobs/${editId}`, { method: 'PUT', token: tokens?.access_token, body })
      } else {
        const res = await api('/jobs', { method: 'POST', token: tokens?.access_token, body })
        console.log('[PostJob] Created job response:', res)
      }
      navigate('/dashboard')
    } catch (e) {
      console.error('[PostJob] error:', e)
      setErr(e.message || 'Failed to save job.')
    }
    setSaving(false)
  }

  if (!loaded) return <div className="page-inner"><p style={{ color: 'var(--muted)' }}>Loading…</p></div>

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 24 }}>
        <div>
          <p className="eyebrow">{editId ? 'Edit Job Post' : 'New Job Post'}</p>
          <h1 style={{ fontSize: 28, letterSpacing: '-.04em', marginTop: 4 }}>
            {editId ? 'Edit Job' : 'Post a Job'}
          </h1>
        </div>
        <button className="btn btn-light" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {err && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#c0392b', fontSize: 14 }}>
          <b>Error:</b> {err}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--navy)' }}>Basic Information</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <span>Job Title <b style={{ color: '#e74c3c' }}>*</b></span>
              <div className="in no-icon">
                <input id="job-title" placeholder="e.g., Carpenter, Office Staff, Driver"
                  value={form.title} onChange={e => set('title', e.target.value)} required />
              </div>
            </div>

            <div className="field">
              <span>Company / Business Name</span>
              <div className="in no-icon">
                <input id="job-company" placeholder="Your company name"
                  value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
            </div>

            <div className="field">
              <span>Job Type <b style={{ color: '#e74c3c' }}>*</b></span>
              <div className="in no-icon">
                <select id="job-type" value={form.job_type} onChange={e => set('job_type', e.target.value)} required>
                  {TYPES_LIST.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <span>Location (Town)</span>
              <div className="in no-icon">
                <select id="job-location" value={form.location} onChange={e => set('location', e.target.value)}>
                  <option value="">— Select town —</option>
                  {TOWNS_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <span>Salary Min (₱/month)</span>
              <div className="in no-icon">
                <input id="job-salary-min" type="number" min="0" placeholder="e.g., 12000"
                  value={form.salary_min} onChange={e => set('salary_min', e.target.value)} />
              </div>
            </div>

            <div className="field">
              <span>Salary Max (₱/month)</span>
              <div className="in no-icon">
                <input id="job-salary-max" type="number" min="0" placeholder="e.g., 18000"
                  value={form.salary_max} onChange={e => set('salary_max', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--navy)' }}>Job Details</h2>
          <div style={{ display: 'grid', gap: 16 }}>

            <div className="field">
              <span>Job Description <b style={{ color: '#e74c3c' }}>*</b></span>
              <div className="in no-icon">
                <textarea id="job-description" rows={5}
                  placeholder="Describe the job role, responsibilities, and what the candidate will do day-to-day…"
                  value={form.description} onChange={e => set('description', e.target.value)}
                  required style={{ resize: 'vertical', minHeight: 120 }} />
              </div>
            </div>

            <div className="field">
              <span>Requirements / Qualifications</span>
              <div className="in no-icon">
                <textarea id="job-requirements" rows={4}
                  placeholder="e.g., At least 2 years experience, TESDA NC II certified, must be a local resident…"
                  value={form.requirements} onChange={e => set('requirements', e.target.value)}
                  style={{ resize: 'vertical', minHeight: 100 }} />
              </div>
            </div>

            <div className="field">
              <span>Skills Needed <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(comma-separated)</span></span>
              <div className="in no-icon">
                <input id="job-skills" placeholder="e.g., welding, electrical, carpentry, driving"
                  value={form.skills_needed} onChange={e => set('skills_needed', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-light" onClick={() => navigate(-1)}>Cancel</button>
          <button id="submit-job-post" type="submit" className="btn btn-primary"
            disabled={saving} style={{ minWidth: 140, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? <><span className="spin" /> Saving…</> : (editId ? 'Save Changes' : <><IconPlus size={14} /> Post Job</>)}
          </button>
        </div>
      </form>
    </div>
  )
}

/* wrapper so react-router can supply the :id param */
function PostJobEdit({ call, tokens }) {
  const { id } = useParams()
  return <PostJob call={call} tokens={tokens} editId={id || null} />
}

/* ─ Admin Overview (Analytics Dashboard) ────────────────── */
function AdminOverview({ call }) {
  const [stats, setStats] = useState({ users: 0, jobs: 0, applications: 0, messages: 0, active_users: 0, inactive_users: 0, users_by_role: {}, registrations_30d: [], users_by_location: [] })
  const [recentUsers, setRecentUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      call('/admin/stats').catch(() => ({})),
      call('/admin/users?limit=8').catch(() => ({ users: [] })),
    ]).then(([s, u]) => {
      setStats(prev => ({ ...prev, ...s }))
      setRecentUsers(u.users || [])
    }).finally(() => setLoading(false))
  }, [call])

  const roleData = stats.users_by_role || {}
  const roleColors = { worker: '#3b82f6', employer: '#f59e0b', admin: '#8b5cf6' }
  const roleLabels = { worker: 'Workers', employer: 'Employers', admin: 'Admins' }

  function DonutChart({ data, colors, size = 110 }) {
    const total = Object.values(data).reduce((a, b) => Number(a) + Number(b), 0)
    if (!total) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b' }}>No data</div>
    const r = 40; const cx = 55; const cy = 55
    let cumulative = 0
    const circ = 2 * Math.PI * r
    const slices = Object.entries(data).map(([key, val]) => {
      const pct = Number(val) / total
      const dash = pct * circ
      const gap = circ - dash
      const offset = -(cumulative / total) * circ - (circ * 0.25)
      cumulative += Number(val)
      return <circle key={key} r={r} cx={cx} cy={cy} fill="none" stroke={colors[key] || '#cbd5e1'} strokeWidth={18} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={offset} style={{ transition: 'all .5s' }} />
    })
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle r={r} cx={cx} cy={cy} fill="none" stroke="#f1f5f9" strokeWidth={18} />
        {slices}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="#64748b">users</text>
      </svg>
    )
  }

  function BarChart({ data, height = 80 }) {
    if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>No data yet</div>
    const last14 = data.slice(-14)
    const max = Math.max(...last14.map(d => Number(d.count)), 1)
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, paddingTop: 8 }}>
        {last14.map((d, i) => {
          const h = Math.max(3, (Number(d.count) / max) * (height - 8))
          return <div key={i} title={`${d.reg_date}: ${d.count}`} style={{ flex: 1, height: h, background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)', borderRadius: '3px 3px 0 0', minWidth: 4 }} />
        })}
      </div>
    )
  }

  const activeRate = stats.users > 0 ? Math.round((Number(stats.active_users) / Number(stats.users)) * 100) : 0
  const totalReg30 = (stats.registrations_30d || []).reduce((s, d) => s + Number(d.count), 0)

  return (
    <div className="page-inner">
      <div className="admin-banner rise" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginBottom: 4 }}>Administration</p>
          <h1 style={{ fontSize: 28, margin: 0 }}>Admin Dashboard</h1>
          <p style={{ margin: '6px 0 0', opacity: .75, fontSize: 14 }}>Overview of all platform activity on HanapBuhay Mindoro.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/dashboard/payments" className="btn btn-sm" style={{ background: '#10b981', color: '#fff', border: '1px solid #059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>
            <IconSpark size={15} /> ₱ Payments &amp; Revenue
          </Link>
          <Link to="/dashboard/users" className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconUsers size={15} /> Manage Users
          </Link>
          <Link to="/dashboard/jobs" className="btn btn-sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconBriefcase size={15} /> Moderate Jobs
          </Link>
        </div>
      </div>

      <div className="dash-stats" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {[
          { icon: IconUsers,     bg: '#eff6ff', color: '#2563eb', val: loading ? '…' : stats.users,       label: 'Total Users',   sub: `${stats.active_users || 0} active` },
          { icon: IconBriefcase, bg: '#fffbeb', color: '#d97706', val: loading ? '…' : stats.jobs,        label: 'Active Jobs',   sub: 'Live listings' },
          { icon: IconFile,      bg: '#f0fdf4', color: '#16a34a', val: loading ? '…' : stats.applications,label: 'Applications',  sub: 'All time' },
          { icon: IconSpark,     bg: '#ecfdf5', color: '#059669', val: loading ? '…' : `₱${Number(stats.total_revenue || 0).toLocaleString()}`, label: 'Sub Revenue', sub: `${stats.active_subscribers || 0} subscribers` },
          { icon: IconMsgCircle, bg: '#faf5ff', color: '#7c3aed', val: loading ? '…' : stats.messages,    label: 'Messages',      sub: 'Platform total' },
        ].map(({ icon: Ic, bg, color, val, label, sub }) => (
          <div key={label} className="dstat">
            <div className="dstat-icon" style={{ background: bg, color }}><Ic size={22} /></div>
            <div>
              <div className="dstat-val">{val}</div>
              <div className="dstat-label">{label}</div>
              {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 20 }}>
        <div className="panel rise" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>User Breakdown</h3>
            <span className="chip navy" style={{ fontSize: 11 }}>{stats.users} total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {loading ? <div className="skel" style={{ width: 110, height: 110, borderRadius: '50%' }} /> : <DonutChart data={roleData} colors={roleColors} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {Object.entries(roleLabels).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: roleColors[key], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{roleData[key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel rise" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Account Status</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{loading ? '…' : stats.active_users}</div>
              <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>Active</div>
            </div>
            <div style={{ flex: 1, background: '#fef2f2', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{loading ? '…' : stats.inactive_users}</div>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>Deactivated</div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Active Rate</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: activeRate > 80 ? '#16a34a' : '#f59e0b' }}>{activeRate}%</span>
            </div>
            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${activeRate}%`, background: activeRate > 80 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#fbbf24,#d97706)', borderRadius: 99, transition: 'width .5s' }} />
            </div>
          </div>
          <Link to="/dashboard/users" className="btn btn-light btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12 }}>
            <IconAlert size={13} /> View Disabled Accounts
          </Link>
        </div>

        <div className="panel rise" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>New Registrations</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Last 14 days</span>
          </div>
          {loading ? <div className="skel" style={{ height: 80 }} /> : <BarChart data={stats.registrations_30d} height={80} />}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{totalReg30} registrations in last 30 days</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, marginBottom: 20 }}>
        <div className="panel rise">
          <div className="panel-hd" style={{ marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><IconPin size={14} />Top Municipalities</h2>
          </div>
          {loading ? <div className="skel" style={{ height: 160 }} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(stats.users_by_location || []).slice(0, 7).map((loc, i) => {
                const maxV = Number((stats.users_by_location[0] || {}).count) || 1
                const pct = Math.round((Number(loc.count) / maxV) * 100)
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{loc.location || 'Unknown'}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{loc.count}</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#3b82f6,#1d4ed8)', borderRadius: 99 }} />
                    </div>
                  </div>
                )
              })}
              {(!stats.users_by_location || stats.users_by_location.length === 0) && <p style={{ fontSize: 13, color: 'var(--muted)' }}>No location data yet.</p>}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-hd">
            <h2 style={{ fontSize: 15 }}>Recently Registered</h2>
            <Link to="/dashboard/users" className="btn btn-light btn-sm">View All</Link>
          </div>
          {loading ? <div className="skel" style={{ height: 200 }} /> : (
            <div className="table-wrap"><table style={{ margin: 0 }}>
              <thead><tr><th>User</th><th>Role</th><th>Location</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div className="avatar" style={{ width: 30, height: 30, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={u.picture || '/images/avatar.jpg'} alt={u.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                          <span style={{ fontSize: 11 }}>{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{u.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`chip ${u.role === 'admin' ? 'navy' : u.role === 'employer' ? 'gold' : ''}`} style={{ fontSize: 11 }}>{u.role}</span></td>
                    <td style={{ fontSize: 12 }}>{u.location || '—'}</td>
                    <td><span className={`status-badge ${Number(u.is_active) ? 'active' : 'archived'}`} style={{ fontSize: 11 }}>{Number(u.is_active) ? 'Active' : 'Disabled'}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { to: '/dashboard/users',    icon: IconUsers,     label: 'User Management', desc: 'Manage all accounts', color: '#2563eb', bg: '#eff6ff' },
          { to: '/dashboard/jobs',     icon: IconBriefcase, label: 'Job Moderation',  desc: 'Review job listings', color: '#d97706', bg: '#fffbeb' },
          { to: '/dashboard/verify',   icon: IconShield,    label: 'Verification',    desc: 'Approve credentials', color: '#7c3aed', bg: '#faf5ff' },
          { to: '/dashboard/payments', icon: IconSpark,     label: 'Payments',        desc: 'Revenue & PayMongo', color: '#059669', bg: '#ecfdf5' },
        ].map(({ to, icon: Ic, label, desc, color, bg }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer', transition: 'border-color .2s', border: '1.5px solid transparent' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={20} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ─ Admin Profile page ──────────────────────────────────── */
function AdminProfile({ user, call, updateUser }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', location: user.location || '', bio: user.bio || '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: form })
      if (res?.user) { updateUser(res.user); setMsg({ ok: true, text: 'Profile updated successfully.' }) }
      else setMsg({ ok: false, text: 'Failed to update profile.' })
      setEditing(false)
    } catch (err) {
      setMsg({ ok: false, text: err?.message || 'Something went wrong.' })
    }
    setSaving(false)
  }

  return (
    <div className="page-inner">
      <div className="section-title">
        <div><p className="eyebrow">Administrator</p><h1 style={{ fontSize: 28, marginTop: 4 }}>Admin Profile</h1></div>
        <button className="btn btn-primary" onClick={() => setEditing(v => !v)}>
          {editing ? <><IconX size={15} /> Cancel</> : <><IconEdit size={15} /> Edit Profile</>}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#16a34a' : '#dc2626', fontSize: 14, border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          {msg.ok ? <IconCheck size={15} /> : <IconAlert size={15} />} {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', opacity: .6 }}><IconX size={14} /></button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        <div className="panel rise" style={{ textAlign: 'center', padding: 28 }}>
          <div className="avatar avatar-gold" style={{ width: 84, height: 84, margin: '0 auto 14px', overflow: 'hidden' }}>
            <img src={user.picture || '/images/avatar.jpg'} alt={user.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
            <span style={{ fontSize: 26 }}>{(user.full_name || user.email || 'A')[0].toUpperCase()}</span>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{user.full_name || 'Administrator'}</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{user.email}</p>
          <span className="chip navy" style={{ fontSize: 12 }}><IconShield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Administrator</span>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)', textAlign: 'left' }}>
            {[{ icon: IconMail, val: user.email }, { icon: IconPhone, val: user.phone || 'Not set' }, { icon: IconPin, val: user.location || 'Not set' }].map(({ icon: Ic, val }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, color: 'var(--muted)' }}>
                <Ic size={13} style={{ flexShrink: 0, color: 'var(--navy)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--line)', textAlign: 'left', fontSize: 12, color: 'var(--muted)' }}>
            <p>Member since</p>
            <p style={{ fontWeight: 700, color: 'var(--navy-d)', marginTop: 2 }}>{user.created_at ? new Date(user.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }) : '—'}</p>
          </div>
        </div>

        <div>
          {editing ? (
            <div className="panel rise">
              <h3 style={{ marginBottom: 18 }}>Edit Profile</h3>
              <form onSubmit={save} style={{ display: 'grid', gap: 16 }}>
                <div className="field"><span>Full Name</span><div className="in"><IconUser size={16} /><input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" /></div></div>
                <div className="field"><span>Phone</span><div className="in"><IconPhone size={16} /><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+63 9XX XXX XXXX" /></div></div>
                <div className="field"><span>Location</span><div className="in"><IconPin size={16} /><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g., Calapan City" /></div></div>
                <div className="field"><span>Bio / Notes</span><div className="in no-icon"><textarea value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={4} style={{ resize: 'vertical' }} placeholder="Admin notes…" /></div></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spin" /> : <><IconCheck size={15} /> Save</>}</button>
                  <button type="button" className="btn btn-light" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="panel rise">
              <h3 style={{ marginBottom: 16 }}>Profile Details</h3>
              {[['Full Name', user.full_name || '—'], ['Email', user.email], ['Phone', user.phone || '—'], ['Location', user.location || '—'], ['Role', 'Administrator'], ['Bio', user.bio || '—']].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 14, borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ width: 120, flexShrink: 0, fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 14, color: 'var(--navy-d)', flex: 1, wordBreak: 'break-all' }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          <div className="panel" style={{ marginTop: 18, background: 'linear-gradient(135deg,#f8faff,#eef3ff)', border: '1px solid #c7d2fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4338ca' }}><IconShield size={18} /></div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-d)' }}>Admin Access Level</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Full platform access</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: '#4338ca' }}>
              {[{ icon: IconUsers, text: 'Manage all user accounts' }, { icon: IconBriefcase, text: 'Moderate job listings' }, { icon: IconShield, text: 'Verify businesses & workers' }, { icon: IconTrend, text: 'View platform analytics' }].map(({ icon: Ic, text }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Ic size={14} /><span>{text}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─ Skills Passport sub-page ────────────────────────────── */
function SkillsPassport({ call, tokens }) {
  const [skills, setSkills]   = useState([])
  const [score, setScore]     = useState(0)
  const [name, setName]       = useState('')
  const [level, setLevel]     = useState('')
  const [source, setSource]   = useState('self')
  const [adding, setAdding]   = useState(false)
  const [showForm, setShowForm]= useState(false)

  const load = useCallback(() => {
    call('/skills/my').then(r => setSkills(r.skills || [])).catch(() => {})
    call('/skills/passport-score').then(r => setScore(r.score || 0)).catch(() => {})
  }, [call])

  useEffect(() => { load() }, [load])

  async function addSkill(e) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      await api('/skills', { method: 'POST', token: tokens?.access_token, body: { skill_name: name.trim(), level, source } })
      setName(''); setLevel(''); setSource('self'); setShowForm(false); load()
    } catch {}
    setAdding(false)
  }

  async function deleteSkill(id) {
    if (!confirm('Remove this skill?')) return
    try { await api(`/skills/${id}`, { method: 'DELETE', token: tokens?.access_token }); load() } catch {}
  }

  const LEVELS = ['beginner','intermediate','advanced','expert']
  const SOURCES = ['self','tesda','employer','training','other']

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">My Portfolio</p>
          <h1 style={{ fontSize: 28, letterSpacing: '-.04em', marginTop: 4 }}>Skills Passport</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <IconPlus size={16} /> Add Skill
        </button>
      </div>

      {/* Score */}
      <div className="panel rise" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div className="ring ring-gold" style={{ '--p': score, width: 80, height: 80 }}>
            <span style={{ width: 62, height: 62, fontSize: 17 }}>{score}%</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Passport Completion</h2>
            <div className="bar bar-gold" style={{ marginBottom: 8 }}><i style={{ '--w': `${score}%` }} /></div>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {score < 50 ? 'Add more skills and fill in your profile to improve your match score.' :
               score < 80 ? 'Great progress! Add certifications to reach 100%.' :
               'Excellent! Your passport is nearly complete.'}
            </p>
          </div>
          <Link to="/dashboard/profile" className="btn btn-navy btn-sm">Update Profile</Link>
        </div>
      </div>

      {/* Add skill form */}
      {showForm && (
        <div className="panel rise" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 16 }}>Add a New Skill</h3>
          <form onSubmit={addSkill} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <span>Skill Name *</span>
              <div className="in no-icon"><input placeholder="e.g., Electrical Wiring" value={name} onChange={e => setName(e.target.value)} required /></div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span>Level</span>
              <div className="in no-icon">
                <select value={level} onChange={e => setLevel(e.target.value)}>
                  <option value="">Select level</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase()+l.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <span>Source</span>
              <div className="in no-icon">
                <select value={source} onChange={e => setSource(e.target.value)}>
                  {SOURCES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: 50 }}>
              {adding ? <span className="spin" /> : 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Skills grid */}
      <div className="panel">
        <div className="panel-hd">
          <h2>My Skills ({skills.length})</h2>
        </div>
        {skills.length === 0
          ? <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
              <IconShield size={40} style={{ margin: '0 auto 12px', opacity: .3 }} />
              <p style={{ marginBottom: 14 }}>No skills added yet.</p>
              <button className="btn btn-navy" onClick={() => setShowForm(true)}><IconPlus size={16} /> Add Your First Skill</button>
            </div>
          : <div className="skill-chips" style={{ gap: 10 }}>
              {skills.map(s => (
                <div key={s.id} className="skill-chip" style={{ padding: '8px 14px' }}>
                  <span>{s.skill_name}</span>
                  {s.level && <span className="chip navy" style={{ fontSize: 11 }}>{s.level}</span>}
                  {s.verified ? <IconCheck size={14} style={{ color: 'var(--green)' }} /> : null}
                  <button onClick={() => deleteSkill(s.id)} title="Remove"><IconX size={14} /></button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

/* ─ Application Stepper Tracker ─────────────────────────── */
function ApplicationTracker({ status, interviewDate, interviewNotes }) {
  const isRejected = status === 'rejected'

  let currentStep = 1
  if (status === 'reviewed') currentStep = 1
  else if (status === 'shortlisted') currentStep = 2
  else if (status === 'for_interview') currentStep = 3
  else if (status === 'hired') currentStep = 4

  const steps = [
    { num: 1, label: 'Applied' },
    { num: 2, label: 'Shortlisted' },
    { num: 3, label: 'For Interview' },
    { num: 4, label: isRejected ? 'Decision' : 'Hired' },
  ]

  return (
    <div style={{ marginTop: 14 }}>
      <div className="app-tracker">
        {steps.map((st, i) => {
          const isDone = !isRejected && currentStep > st.num
          const isActive = !isRejected && currentStep === st.num
          const isStepRejected = isRejected && st.num === 4

          return (
            <div key={st.num} style={{ display: 'contents' }}>
              <div className="tracker-step">
                <div className={`tracker-circle ${isDone ? 'done' : ''} ${isActive ? 'active' : ''} ${isStepRejected ? 'rejected' : ''}`}>
                  {isDone ? <IconCheck size={14} /> : isStepRejected ? <IconX size={14} /> : st.num}
                </div>
                <span className={`tracker-label ${isActive ? 'active' : ''}`}>
                  {isStepRejected ? 'Not Selected' : st.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`tracker-line ${!isRejected && currentStep > st.num ? 'done' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Stage-specific callout / guidance */}
      {status === 'for_interview' && (
        <div style={{ marginTop: 12, background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '12px 16px', color: '#4c1d95' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <IconCalendar size={18} style={{ color: '#7c3aed' }} />
            For Interview &mdash; Congratulations!
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#5b21b6' }}>
            The employer has selected your application for an interview. Please prepare and review the schedule/instructions below.
          </p>
          {interviewDate && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffffff', border: '1px solid #ddd6fe', padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#6d28d9' }}>
              <IconClock size={14} />
              Schedule: {new Date(interviewDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          )}
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#334155', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <strong>Interview Notes / Instructions:</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}

      {status === 'shortlisted' && (
        <div style={{ marginTop: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconStar size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <span>You have been shortlisted! The employer is reviewing candidate profiles for interview scheduling.</span>
          </div>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#1e40af', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
              <strong>Screening Note:</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}

      {status === 'hired' && (
        <div style={{ marginTop: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '12px 16px', color: '#065f46' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <IconCheck size={18} style={{ color: '#059669' }} />
            Congratulations! You are Hired!
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#047857' }}>
            The employer has officially accepted your application. Check your email or messages for your employment onboarding instructions.
          </p>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#065f46', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
              <strong>Onboarding Note:</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}

      {status === 'rejected' && (
        <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconX size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span>This application was not selected. Keep going and explore other openings across Oriental Mindoro!</span>
          </div>
          {interviewNotes && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#991b1b', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
              <strong>Employer Feedback:</strong> {interviewNotes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─ Applications list ───────────────────────────────────── */
function MyApplications({ call }) {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    call('/applications/my').then(r => setApps(r.applications || [])).catch(() => {}).finally(() => setLoading(false))
  }, [call])

  const renderStatusBadge = s => {
    const map = {
      pending:       { icon: IconClock, text: 'Pending Review', cls: 'pending' },
      reviewed:      { icon: IconSearch, text: 'Under Review', cls: 'reviewed' },
      shortlisted:   { icon: IconStar, text: 'Shortlisted', cls: 'shortlisted' },
      for_interview: { icon: IconCalendar, text: 'For Interview', cls: 'for_interview' },
      rejected:      { icon: IconX, text: 'Not Selected', cls: 'rejected' },
      hired:         { icon: IconCheck, text: 'Hired', cls: 'hired' },
    }
    const item = map[s] || { icon: IconFile, text: s || 'Submitted', cls: 'pending' }
    const Ic = item.icon
    return (
      <span className={`app-status ${item.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'capitalize' }}>
        <Ic size={12} /> {item.text}
      </span>
    )
  }

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === 'pending' || a.status === 'reviewed').length,
    shortlisted: apps.filter(a => a.status === 'shortlisted').length,
    for_interview: apps.filter(a => a.status === 'for_interview').length,
    hired: apps.filter(a => a.status === 'hired').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const filtered = apps.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.status === 'pending' || a.status === 'reviewed'
    return a.status === filter
  })

  return (
    <div className="page-inner">
      <div className="section-title">
        <div><p className="eyebrow">Track Progress</p><h1 style={{ fontSize: 28, marginTop: 4 }}>My Applications</h1></div>
        <Link to="/jobs" className="btn btn-primary"><IconSearch size={16} /> Find More Jobs</Link>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 12, overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'In Review' },
          { id: 'shortlisted', label: 'Shortlisted' },
          { id: 'for_interview', label: 'For Interview' },
          { id: 'hired', label: 'Hired' },
          { id: 'rejected', label: 'Not Selected' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`btn btn-sm ${filter === tab.id ? 'btn-primary' : 'btn-light'}`}
            style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {tab.label} ({counts[tab.id] || 0})
          </button>
        ))}
      </div>

      {loading
        ? <div className="panel"><div className="skel" style={{ height: 200 }} /></div>
        : filtered.length === 0
          ? <div className="panel" style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
                {filter === 'all' ? "You haven't applied to any jobs yet." : `No applications under "${filter.replace('_', ' ')}".`}
              </p>
              <Link to="/jobs" className="btn btn-navy">Browse Jobs <IconArrow /></Link>
            </div>
          : <div style={{ display: 'grid', gap: 14 }}>
              {filtered.map(a => (
                <div key={a.id} className="panel" style={{ borderLeft: a.status === 'for_interview' ? '4px solid #7c3aed' : a.status === 'hired' ? '4px solid #10b981' : a.status === 'shortlisted' ? '4px solid #3b82f6' : a.status === 'rejected' ? '4px solid #ef4444' : '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 18, margin: 0 }}>{a.job_title || 'Job Application'}</h2>
                        {renderStatusBadge(a.status)}
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>{a.company || a.employer_name} · {a.job_location}</p>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {a.match_score && <span className="chip green">{a.match_score}% Match</span>}
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Applied {days(a.created_at)}</span>
                        {a.salary_min && <span style={{ fontSize: 13, color: 'var(--muted)' }}>₱{Number(a.salary_min).toLocaleString()}/mo</span>}
                      </div>

                      {/* Application Timeline Tracker */}
                      <ApplicationTracker
                        status={a.status}
                        interviewDate={a.interview_date}
                        interviewNotes={a.interview_notes}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link to={`/jobs/${a.job_id}`} className="btn btn-light btn-sm">View Job</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      }
    </div>
  )
}

/* ─ Training & Courses ──────────────────────────────────── */
function Training({ call }) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    call('/training').then(r => setCourses(r.courses || [])).catch(() => setCourses(DEMO_COURSES)).finally(() => setLoading(false))
  }, [call])

  const DEMO_COURSES = [
    { id:1, title:'Basic Welding NC II', provider:'TESDA Calapan',     location:'Calapan City', duration:'3 months', is_free:1, category:'Welding' },
    { id:2, title:'Computer Hardware Servicing NC II', provider:'TESDA', location:'Calapan City', duration:'3 months', is_free:1, category:'Technology' },
    { id:3, title:'Computing NC II',    provider:'TESDA Pinamalayan',   location:'Pinamalayan',   duration:'3 months', is_free:1, category:'Technology' },
    { id:4, title:'Bread & Pastry Production', provider:'TESDA Naujan', location:'Naujan',        duration:'2 months', is_free:1, category:'Food' },
    { id:5, title:'Solar PV Basics',    provider:'Mindoro Solar Inc.',  location:'Calapan City', duration:'2 weeks', cost:1500, is_free:0, category:'Energy' },
  ]

  return (
    <div className="page-inner">
      <div className="section-title">
        <div><p className="eyebrow">Learn & Grow</p><h1 style={{ fontSize: 28, marginTop: 4 }}>Training & Courses</h1></div>
      </div>
      {loading
        ? <div className="panel"><div className="skel" style={{ height: 300 }} /></div>
        : <div style={{ display: 'grid', gap: 14 }}>
            {courses.map(c => (
              <div key={c.id} className="panel" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div className="training-icon"><IconBook size={20} /></div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 3 }}>{c.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>{c.provider} · <IconPin size={12} style={{ display: 'inline' }} /> {c.location} · {c.duration}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {c.is_free ? <span className="free-badge">Free</span> : <span style={{ fontSize: 14, fontWeight: 700 }}>₱{Number(c.cost).toLocaleString()}</span>}
                  <button className="btn btn-navy btn-sm">Enroll</button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

/* ─ Messages page ───────────────────────────────────────── */
// Helper: stable thread key from two user IDs (always same order)
function threadKey(a, b) { return [Number(a), Number(b)].sort((x,y) => x-y).join('_') }

function Messages({ call, user }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const toUserId = searchParams.get('to') || searchParams.get('userId')
  const [threads,   setThreads]  = useState([])
  const [active,    setActive]   = useState(null)   // partner user object
  const [msgs,      setMsgs]     = useState([])
  const [text,      setText]     = useState('')
  const [sending,   setSending]  = useState(false)
  const [loading,   setLoading]  = useState(false)
  const [searching, setSearching] = useState(false)
  const [search,    setSearch]   = useState('')
  const [results,   setResults]  = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  // ── Load thread list from backend API ─────────────────────
  const loadThreads = useCallback(async () => {
    try {
      const r = await call('/messages/threads')
      if (r?.threads) {
        setThreads(r.threads.map(t => ({
          partner_id: t.partner_id,
          partner_name: t.partner_name,
          partner_avatar: t.partner_avatar || '',
          partner_type: t.partner_type || '',
          body: t.body || '',
          last_ts: t.created_at ? new Date(t.created_at).getTime() : (t.last_ts || Date.now()),
          unread: Number(t.unread) || 0,
        })))
      }
    } catch (e) {
      // non-fatal
    }
  }, [call])

  // Polling threads
  useEffect(() => {
    loadThreads()
    const t = setInterval(loadThreads, 4000)
    return () => clearInterval(t)
  }, [loadThreads])

  // Real-time Firebase threads (when configured)
  useEffect(() => {
    if (!firebaseConfigured || !db || !user?.id) return
    const tRef = dbRef(db, `threads/${user.id}`)
    const unsub = onValue(tRef, snap => {
      const data = snap.val() || {}
      const arr = Object.values(data).sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0))
      if (arr.length > 0) setThreads(arr)
    })
    return () => off(tRef)
  }, [user?.id])

  // ── Auto-open conversation when ?to= is present in URL ────
  useEffect(() => {
    if (!toUserId || !user?.id) return
    const pid = Number(toUserId)
    if (isNaN(pid) || pid === user.id) return

    // 1. Check if thread already exists in current threads
    const found = threads.find(t => Number(t.partner_id) === pid)
    if (found) {
      setActive({
        id: found.partner_id,
        full_name: found.partner_name,
        picture: found.partner_avatar,
        account_type: found.partner_type || ''
      })
      return
    }

    // 2. Otherwise fetch conversation & partner profile from API
    call(`/messages/${pid}`)
      .then(r => {
        if (r?.partner) {
          setActive(r.partner)
        }
      })
      .catch(() => {})
  }, [toUserId, user?.id, threads, call])

  // ── Load messages for active thread ───────────────────────
  const loadMessages = useCallback(async (pid) => {
    if (!pid) return
    try {
      const r = await call(`/messages/${pid}`)
      if (r?.messages) {
        setMsgs(r.messages.map(m => ({
          _id: m.id,
          sender_id: m.sender_id,
          sender_name: m.sender_id === user?.id ? (user?.full_name || user?.email) : (active?.full_name || ''),
          body: m.body,
          ts: m.created_at ? new Date(m.created_at).getTime() : Date.now()
        })))
      }
    } catch (e) {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [call, user?.id, user?.full_name, user?.email, active?.full_name])

  useEffect(() => {
    if (!active?.id || !user?.id) { setMsgs([]); return }
    setLoading(true)
    loadMessages(active.id)

    // Polling every 3 seconds for active conversation
    const t = setInterval(() => {
      loadMessages(active.id)
    }, 3000)

    // Firebase real-time listener if configured
    let unsub = null
    if (firebaseConfigured && db) {
      const tKey = threadKey(user.id, active.id)
      const mRef = query(dbRef(db, `messages/${tKey}/msgs`), orderByChild('ts'), limitToLast(100))
      unsub = onValue(mRef, snap => {
        const data = snap.val() || {}
        const arr = Object.entries(data).map(([id, m]) => ({ ...m, _id: id }))
          .sort((a, b) => (a.ts || 0) - (b.ts || 0))
        if (arr.length > 0) {
          setMsgs(arr)
          setLoading(false)
        }
        update(dbRef(db, `threads/${user.id}/${tKey}`), { unread: 0 }).catch(() => {})
      })
    }

    return () => {
      clearInterval(t)
      if (unsub && db) {
        const tKey = threadKey(user.id, active.id)
        off(dbRef(db, `messages/${tKey}/msgs`))
      }
    }
  }, [active?.id, user?.id, loadMessages])

  // ── Auto-scroll to bottom ─────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // ── Search & suggested contacts ───────────────────────────
  useEffect(() => {
    if (!searching) return
    setContactsLoading(true)
    const q = search.trim()
    const timer = setTimeout(async () => {
      try {
        const r = await call(`/auth/search-users?q=${encodeURIComponent(q)}`)
        setResults((r?.users || []).filter(u => u.id !== user?.id))
      } catch {
        setResults([])
      } finally {
        setContactsLoading(false)
      }
    }, q ? 300 : 0)

    return () => clearTimeout(timer)
  }, [searching, search, call, user?.id])

  // ── Send message ──────────────────────────────────────────
  async function send(e) {
    e.preventDefault()
    const clean = text.trim()
    if (!clean || !active || sending) return
    setSending(true)

    const localTs = Date.now()
    const tempMsg = {
      _id: 'tmp_' + localTs,
      sender_id: user.id,
      sender_name: user.full_name || user.email,
      body: clean,
      ts: localTs,
    }

    // Optimistic UI updates
    setMsgs(prev => [...prev, tempMsg])
    setText('')
    inputRef.current?.focus()

    // Optimistically update threads list
    setThreads(prev => {
      const idx = prev.findIndex(t => String(t.partner_id) === String(active.id))
      const updated = {
        partner_id: active.id,
        partner_name: active.full_name,
        partner_avatar: active.picture || '',
        partner_type: active.account_type || '',
        body: clean,
        last_ts: localTs,
        unread: 0
      }
      if (idx >= 0) {
        const next = [...prev]
        next.splice(idx, 1)
        return [updated, ...next]
      }
      return [updated, ...prev]
    })

    try {
      // 1. Persist in MySQL database & trigger notifications
      await call('/messages', {
        method: 'POST',
        body: { receiver_id: active.id, body: clean }
      })

      // 2. If Firebase is active, broadcast immediately
      if (firebaseConfigured && db) {
        const tKey = threadKey(user.id, active.id)
        const msg = {
          sender_id: user.id,
          sender_name: user.full_name || user.email,
          body: clean,
          ts: localTs,
        }
        await push(dbRef(db, `messages/${tKey}/msgs`), msg)
        const threadMeta = {
          partner_id: active.id,
          partner_name: active.full_name || active.email,
          partner_avatar: active.picture || '',
          body: clean.slice(0, 80),
          last_ts: localTs,
        }
        await Promise.all([
          update(dbRef(db, `threads/${user.id}/${tKey}`), { ...threadMeta, unread: 0 }),
          update(dbRef(db, `threads/${active.id}/${tKey}`), {
            ...threadMeta,
            partner_id: user.id,
            partner_name: user.full_name || user.email,
            partner_avatar: user.picture || '',
            unread: 1,
          }),
        ])
      }
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      setSending(false)
      loadThreads()
    }
  }

  function openThread(partner) {
    setActive(partner)
    setSearch('')
    setResults([])
    setSearching(false)
    if (searchParams.get('to')) {
      setSearchParams({})
    }
  }

  const fmt12 = ts => {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts)
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Main chat UI ──────────────────────────────────────────
  return (
    <div style={{ padding: '0 28px 28px' }}>
      <div className="section-title" style={{ padding: '28px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Messages</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip green" style={{ fontSize: 11, padding: '3px 10px', fontWeight: 700 }}>
            {firebaseConfigured ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconSpark size={12} /> Firebase Real-time
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <IconCheck size={11} /> Live Messages
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="messages-layout">
        {/* ── Thread sidebar ──────────────────────────────── */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-hd">
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Conversations</h3>
            <button
              className="btn btn-light btn-xs"
              style={{ fontSize: 12, padding: '4px 10px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => setSearching(s => !s)}
              title="Start new conversation"
            >
              {searching ? <><IconX size={12} /> Cancel</> : <><IconEdit size={12} /> New Chat</>}
            </button>
          </div>

          {/* New conversation search & suggested contacts */}
          {searching && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', background: '#f8fafc' }}>
              <input
                autoFocus
                type="text"
                placeholder="Search user or select below…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{search.trim() ? 'Search Results' : 'Suggested Contacts'}</span>
                  {contactsLoading && <span className="spin" style={{ width: 12, height: 12 }} />}
                </div>

                {results.length > 0 ? (
                  <div style={{ maxHeight: 250, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
                    {results.map(u => (
                      <div
                        key={u.id}
                        onClick={() => openThread(u)}
                        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        <div className="avatar" style={{ width: 34, height: 34, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={u.picture || '/images/avatar.jpg'} alt={u.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                          <span style={{ fontSize: 13 }}>{(u.full_name || '?')[0]}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-d)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
                            {u.account_type || 'User'}{u.location ? ` · ${u.location}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !contactsLoading ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0', textAlign: 'center' }}>
                    {search.trim() ? 'No users matching your search.' : 'No other users found.'}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          <div className="msg-threads">
            {threads.length === 0 ? (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}>
                  <IconMsgCircle size={40} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy-d)', margin: '0 0 6px' }}>Walang conversations pa</p>
                <p style={{ fontSize: 13, margin: '0 0 16px', color: 'var(--muted)' }}>Mag-chat sa mga aplikante o employers para mag-usap!</p>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setSearching(true)}
                >
                  <IconEdit size={13} /> Start New Chat
                </button>
              </div>
            ) : threads.map(t => (
              <div
                key={t.partner_id}
                className={`msg-thread-item ${active?.id == t.partner_id ? 'active' : ''}`}
                onClick={() => openThread({ id: t.partner_id, full_name: t.partner_name, picture: t.partner_avatar, account_type: '' })}
              >
                <div className="avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                  <img src={t.partner_avatar || '/images/avatar.jpg'} alt={t.partner_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <span>{(t.partner_name || '?')[0]}</span>
                </div>
                <div className="msg-thread-meta">
                  <div className="msg-thread-name">{t.partner_name}</div>
                  <div className="msg-thread-preview">{t.body}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <div className="msg-thread-time">{t.last_ts ? fmt12(t.last_ts) : ''}</div>
                  {t.unread > 0 && <span className="notif-badge" style={{ position: 'static' }}>{t.unread}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat area ───────────────────────────────────── */}
        <div className="msg-chat">
          {!active ? (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--muted)', padding: 32 }}>
              <div style={{ textAlign: 'center', maxWidth: 360 }}>
                <div style={{ marginBottom: 14, opacity: .4, display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}>
                  <IconMsgCircle size={52} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--navy-d)', margin: '0 0 6px' }}>Select a conversation</h3>
                <p style={{ fontSize: 14, margin: '0 0 18px', color: 'var(--muted)' }}>
                  Pumili ng kausap sa kaliwa o magsimula ng bagong chat gamit ang button sa ibaba.
                </p>
                <button
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setSearching(true)}
                >
                  <IconEdit size={14} /> Start a Conversation
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="msg-chat-hd">
                <div className="avatar" style={{ overflow: 'hidden' }}>
                  <img src={active.picture || '/images/avatar.jpg'} alt={active.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <span>{(active.full_name || '?')[0]}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 15 }}>{active.full_name}</b>
                  <small style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12, marginTop: 1 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Online · Real-time
                  </small>
                </div>
              </div>

              {/* Messages body */}
              <div className="msg-chat-body">
                {loading && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <span className="spin" style={{ display: 'inline-block', marginRight: 8 }} />Loading messages…
                  </div>
                )}
                {!loading && msgs.length === 0 && (
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <div>
                      <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--gold)' }}><IconSpark size={36} /></div>
                      Start the conversation with <strong>{active.full_name}</strong>!
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => {
                  const mine = String(m.sender_id) === String(user.id)
                  const showDate = i === 0 || (
                    new Date(msgs[i-1].ts).toDateString() !== new Date(m.ts).toDateString()
                  )
                  return (
                    <div key={m._id || i}>
                      {showDate && (
                        <div style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', margin: '10px 0', fontWeight: 600 }}>
                          {new Date(m.ts).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div className={`bubble ${mine ? 'mine' : 'theirs'}`} style={{ maxWidth: '72%', wordBreak: 'break-word' }}>{m.body}</div>
                        <div className="bubble-time">{fmt12(m.ts)}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Chat footer / input */}
              <form className="msg-chat-footer" onSubmit={send}>
                <div className="msg-input-wrap">
                  <textarea
                    ref={inputRef}
                    placeholder={`Message ${active.full_name?.split(' ')[0] || 'them'}…`}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={1}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
                  />
                </div>
                <button type="submit" className="btn btn-navy" disabled={!text.trim() || sending}>
                  {sending ? <span className="spin" /> : <IconSend size={18} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


/* ─ Worker Profile page ─────────────────────────────────── */
function WorkerProfile({ user, call, tokens, updateUser }) {
  const fileInputRef = useRef(null)
  const resumeInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || ''
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoMsg, setPhotoMsg] = useState({ type: '', text: '' })
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [cropModalSrc, setCropModalSrc] = useState(null)

  // Resume upload states
  const [resumeState, setResumeState] = useState('idle') // idle | scanning | parsed | error
  const [resumeMsg, setResumeMsg] = useState('')
  const [resumeParsed, setResumeParsed] = useState(null)
  const [resumeFile, setResumeFile] = useState(null)

  const currentPhoto = previewPhoto || user?.picture || (user?.id ? localStorage.getItem(`hb_avatar_${user.id}`) : null) || '/images/avatar.jpg'

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        location: user.location || '',
        bio: user.bio || ''
      })
    }
  }, [user?.full_name, user?.phone, user?.location, user?.bio])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: form })
      if (res?.user && updateUser) {
        updateUser(res.user)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err?.message || 'Failed to save profile changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Resume scan & auto-fill
  async function handleResumeUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResumeFile(file)
    setResumeState('scanning')
    setResumeMsg('')
    setResumeParsed(null)
    // Reset input so same file can be re-selected
    if (resumeInputRef.current) resumeInputRef.current.value = ''
    try {
      const fd = new FormData()
      fd.append('resume', file)
      const res = await call('/auth/resume-parse', { method: 'POST', body: fd })
      if (res?.parsed) {
        setResumeParsed(res.parsed)
        setResumeState('parsed')
      } else {
        throw new Error('No data returned')
      }
    } catch (err) {
      setResumeState('error')
      setResumeMsg(err?.message || 'Could not scan resume. Please try a TXT or DOCX file.')
    }
  }

  function applyParsed() {
    if (!resumeParsed) return
    const p = resumeParsed
    setForm(f => ({
      ...f,
      full_name: p.full_name || f.full_name,
      phone:     p.phone     || f.phone,
      location:  p.location  || f.location,
      bio:       p.bio       || f.bio,
    }))
    setResumeMsg('Profile fields auto-filled! Review and save your changes below.')
    setResumeState('idle')
    setResumeParsed(null)
    // Auto-add detected skills to Skills Passport
    if (p.skills?.length && tokens?.access_token) {
      Promise.allSettled(p.skills.map(sk =>
        call('/skills', { method: 'POST', body: { skill_name: sk, level: '', source: 'resume' } })
      ))
    }
  }

  // Handle Photo File Selection -> Opens Crop Modal
  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Clear input value so same file can be re-selected if cancelled
    e.target.value = ''

    // Validate type
    if (!file.type.startsWith('image/')) {
      setPhotoMsg({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WEBP).' })
      return
    }

    // Validate size (max 8MB for cropping)
    if (file.size > 8 * 1024 * 1024) {
      setPhotoMsg({ type: 'error', text: 'Image file is too large. Please choose an image under 8MB.' })
      return
    }

    setPhotoMsg({ type: '', text: '' })

    // Read and open crop modal
    const reader = new FileReader()
    reader.onload = (evt) => {
      setCropModalSrc(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Handle Cropped Image Save
  async function handleCroppedPhoto(croppedBlob, croppedDataUrl) {
    setUploadingPhoto(true)
    setPreviewPhoto(croppedDataUrl)
    setPhotoMsg({ type: '', text: '' })

    try {
      const formData = new FormData()
      formData.append('avatar', croppedBlob, 'avatar.jpg')

      const res = await call('/auth/avatar', {
        method: 'POST',
        body: formData,
      })

      if (res?.picture && updateUser) {
        updateUser({ ...user, picture: res.picture })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, res.picture)
      } else if (res?.user && updateUser) {
        updateUser(res.user)
      }

      setCropModalSrc(null)
      setPhotoMsg({ type: 'success', text: 'Profile photo updated successfully!' })
      setTimeout(() => setPhotoMsg({ type: '', text: '' }), 4000)
    } catch (err) {
      // Fallback: update via base64 data URI in /auth/me
      try {
        const fallbackRes = await call('/auth/me', {
          method: 'PATCH',
          body: { picture: croppedDataUrl },
        })
        if (fallbackRes?.user && updateUser) {
          updateUser(fallbackRes.user)
        } else if (updateUser) {
          updateUser({ ...user, picture: croppedDataUrl })
        }
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, croppedDataUrl)
        setCropModalSrc(null)
        setPhotoMsg({ type: 'success', text: 'Profile photo updated successfully!' })
        setTimeout(() => setPhotoMsg({ type: '', text: '' }), 4000)
      } catch (fbErr) {
        setPhotoMsg({ type: 'error', text: err?.message || 'Failed to upload photo. Please try again.' })
        setPreviewPhoto(null)
      }
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Handle Remove Photo
  async function handleRemovePhoto() {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return
    setUploadingPhoto(true)
    setPhotoMsg({ type: '', text: '' })
    try {
      const res = await call('/auth/me', {
        method: 'PATCH',
        body: { picture: '' },
      })
      if (res?.user && updateUser) {
        updateUser(res.user)
      } else if (updateUser) {
        updateUser({ ...user, picture: null })
      }
      setPreviewPhoto(null)
      if (user?.id) localStorage.removeItem(`hb_avatar_${user.id}`)
      setPhotoMsg({ type: 'success', text: 'Profile photo reset to default.' })
      setTimeout(() => setPhotoMsg({ type: '', text: '' }), 3000)
    } catch (err) {
      setPhotoMsg({ type: 'error', text: 'Failed to remove photo.' })
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28 }}>My Profile</h1>
      </div>

      {/* ─── Resume Upload Banner ──────────────────────────────── */}
      <div className="panel rise" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, #0a2557 0%, #1a3a8f 60%, #0f52ba 100%)',
        border: 'none',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-30, left:'40%', width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,.04)', pointerEvents:'none' }} />

        <input type="file" ref={resumeInputRef} onChange={handleResumeUpload}
          accept=".pdf,.docx,.doc,.txt,.rtf" style={{ display:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap', position:'relative', zIndex:1 }}>
          {/* Icon */}
          <div style={{
            width:60, height:60, borderRadius:16, flexShrink:0,
            background:'rgba(255,255,255,.12)', backdropFilter:'blur(8px)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'#fff', boxShadow:'0 4px 16px rgba(0,0,0,.2)'
          }}><IconFile size={28} /></div>

          <div style={{ flex:1, minWidth:180 }}>
            <p style={{ color:'rgba(255,255,255,.6)', fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:3 }}>Smart Auto-Fill</p>
            <h2 style={{ color:'#fff', fontSize:18, fontWeight:800, marginBottom:4, letterSpacing:'-.02em' }}>Upload Your Resume</h2>
            <p style={{ color:'rgba(255,255,255,.7)', fontSize:13, lineHeight:1.5, margin:0 }}>
              Upload PDF, DOCX, or TXT — we'll scan it and auto-fill your profile &amp; skills.
            </p>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
            {resumeState === 'scanning' && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,.8)', fontSize:13 }}>
                <span className="spin" style={{ width:20, height:20, borderColor:'rgba(255,255,255,.3)', borderTopColor:'#fff' }} />
                <span>Scanning resume…</span>
              </div>
            )}
            {resumeState === 'parsed' && resumeParsed && (
              <button className="btn btn-primary" onClick={applyParsed} style={{ fontSize:13, padding:'10px 20px', fontWeight:700, display:'inline-flex', alignItems:'center', gap:6 }}>
                <IconSpark size={15} /> Apply Auto-Fill
              </button>
            )}
            {resumeState !== 'scanning' && (
              <button
                className="btn"
                onClick={() => resumeInputRef.current?.click()}
                disabled={resumeState === 'scanning'}
                style={{
                  background:'rgba(255,255,255,.15)', backdropFilter:'blur(6px)',
                  color:'#fff', border:'1px solid rgba(255,255,255,.25)',
                  fontSize:13, padding:'10px 20px', fontWeight:600,
                  borderRadius:10, cursor:'pointer', transition:'.2s',
                  display:'inline-flex', alignItems:'center', gap:6
                }}
              >
                <IconFile size={15} />
                {resumeFile ? 'Re-Upload' : 'Browse File'}
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        {(resumeMsg || (resumeState === 'parsed' && resumeParsed)) && (
          <div style={{
            marginTop:16, padding:'12px 16px', borderRadius:10, position:'relative', zIndex:1,
            background: resumeState === 'error' ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.1)',
            border: `1px solid ${resumeState === 'error' ? 'rgba(239,68,68,.4)' : 'rgba(255,255,255,.2)'}`,
          }}>
            {resumeState === 'parsed' && resumeParsed && !resumeMsg && (
              <div>
                <p style={{ color:'rgba(255,255,255,.95)', fontSize:12, fontWeight:700, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', background:'#10b981', color:'#fff' }}>
                    <IconCheck size={11} sw={2.6} />
                  </span>
                  <span>Resume scanned! Found the following data:</span>
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {resumeParsed.full_name && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconUser size={13} /> {resumeParsed.full_name}
                    </span>
                  )}
                  {resumeParsed.phone && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconPhone size={13} /> {resumeParsed.phone}
                    </span>
                  )}
                  {resumeParsed.location && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.16)', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconPin size={13} /> {resumeParsed.location}
                    </span>
                  )}
                  {resumeParsed.skills?.slice(0,5).map(s => (
                    <span key={s} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(245,166,35,.2)', color:'#F5A623', border:'1px solid rgba(245,166,35,.35)', borderRadius:6, padding:'4px 10px', fontSize:12, fontWeight:600 }}>
                      <IconWrench size={13} /> {s}
                    </span>
                  ))}
                  {resumeParsed.skills?.length > 5 && (
                    <span style={{ display:'inline-flex', alignItems:'center', color:'rgba(255,255,255,.7)', fontSize:12, padding:'4px 6px', fontWeight:600 }}>
                      +{resumeParsed.skills.length-5} more skills
                    </span>
                  )}
                </div>
              </div>
            )}
            {resumeMsg && (
              <p style={{ color: resumeState === 'error' ? '#fca5a5' : 'rgba(255,255,255,.9)', fontSize:13, margin:0 }}>{resumeMsg}</p>
            )}
          </div>
        )}

        {/* Scanning animation overlay */}
        {resumeState === 'scanning' && (
          <div style={{ marginTop:14, position:'relative', zIndex:1 }}>
            <div style={{ height:3, background:'rgba(255,255,255,.1)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'linear-gradient(90deg, transparent, #FFD700, transparent)', animation:'resumeScan 1.4s ease-in-out infinite', width:'40%', borderRadius:2 }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <form onSubmit={save} className="panel">
          <h2 style={{ marginBottom: 20, fontSize: 18 }}>Personal Information</h2>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', marginBottom: 16, fontSize: 13, border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div className="field">
            <span>Full Name</span>
            <div className="in"><IconUser size={17} /><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" /></div>
          </div>
          <div className="field">
            <span>Email</span>
            <div className="in"><IconMail size={17} /><input type="email" value={user.email} disabled style={{ opacity: .6 }} /></div>
          </div>
          <div className="field">
            <span>Phone</span>
            <div className="in"><IconPin size={17} /><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXXX" /></div>
          </div>
          <div className="field">
            <span>Town / Location</span>
            <div className="in">
              <IconPin size={17} />
              <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                <option value="">Choose your town</option>
                {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <span>Bio / About Me <em>Optional</em></span>
            <div className="in no-icon">
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Brief description of your skills and experience…" style={{ minHeight: 100 }} />
            </div>
          </div>
          <button type="submit" className={`btn btn-primary ${saved ? 'is-done' : ''}`} disabled={saving}>
            {saving ? <span className="spin" /> : saved ? <><IconCheck size={16} /> Saved</> : 'Save Changes'}
          </button>
        </form>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="panel" style={{ textAlign: 'center', padding: '28px 20px' }}>
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />

            {/* Avatar Circle with Camera Overlay */}
            <div style={{ position: 'relative', width: 114, height: 114, margin: '0 auto 16px' }}>
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                title="Click to upload profile photo"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '3.5px solid var(--gold)',
                  boxShadow: '0 8px 20px rgba(10,37,87,0.15)',
                  cursor: uploadingPhoto ? 'wait' : 'pointer',
                  position: 'relative',
                  background: '#E2E8F0',
                  transition: 'transform .2s'
                }}
              >
                <img
                  src={currentPhoto}
                  alt={user?.full_name || 'Profile'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.src = '/images/avatar.jpg' }}
                />

                {/* Uploading Spinner Overlay */}
                {uploadingPhoto && (
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(10, 37, 87, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    <span className="spin" style={{ width: 22, height: 22, marginBottom: 4 }} />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Photo Feedback Message */}
            {photoMsg.text && (
              <div style={{
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
                background: photoMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: photoMsg.type === 'error' ? '#b91c1c' : '#15803d',
                border: `1px solid ${photoMsg.type === 'error' ? '#fca5a5' : '#86efac'}`,
                animation: 'fadeIn .2s'
              }}>
                {photoMsg.text}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <IconUser size={14} />
                <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
              </button>

              {(user?.picture || previewPhoto) && (
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  style={{ fontSize: 12, color: '#DC2626' }}
                >
                  Remove
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.4 }}>
              JPG, PNG, or WEBP up to 5MB.<br/>Clear face photo recommended for faster hiring.
            </p>

            <h3 style={{ fontSize: 18, marginBottom: 2 }}>{user.full_name || 'Worker'}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, textTransform: 'capitalize' }}>{user.account_type || 'Skilled Worker'} · {user.location || 'Oriental Mindoro'}</p>
            <span className="chip green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={12} /> Verified Profile</span>
          </div>
          <div className="panel">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>Account Details</h3>
            <dl className="facts">
              <div><dt>Email</dt><dd style={{ fontSize: 13 }}>{user.email}</dd></div>
              <div><dt>Role</dt><dd><span className="chip navy">{user.role}</span></dd></div>
              <div><dt>Type</dt><dd style={{ textTransform: 'capitalize' }}>{user.account_type || '—'}</dd></div>
              <div><dt>Google</dt><dd>{user.has_google ? <span className="chip green">Connected</span> : '—'}</dd></div>
            </dl>
          </div>
        </div>
      </div>

      {cropModalSrc && (
        <ImageCropModal
          imageSrc={cropModalSrc}
          title="Crop & Adjust Profile Photo"
          cropShape="circle"
          saving={uploadingPhoto}
          onCrop={handleCroppedPhoto}
          onCancel={() => setCropModalSrc(null)}
        />
      )}
    </div>
  )
}

/* ─ Employer / Business Profile page ─────────────────────── */
function EmployerProfile({ user, call, updateUser }) {
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone:     user?.phone || '',
    location:  user?.location || '',
    bio:       user?.bio || '',
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoMsg, setLogoMsg] = useState({ type: '', text: '' })
  const [previewLogo, setPreviewLogo] = useState(null)
  const [cropModalSrc, setCropModalSrc] = useState(null)

  const currentLogo = previewLogo || user?.picture || (user?.id ? localStorage.getItem(`hb_avatar_${user.id}`) : null) || '/images/avatar.jpg'

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || '',
        phone:     user.phone || '',
        location:  user.location || '',
        bio:       user.bio || '',
      })
    }
  }, [user?.full_name, user?.phone, user?.location, user?.bio])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await call('/auth/me', { method: 'PATCH', body: form })
      if (res?.user && updateUser) updateUser(res.user)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err?.message || 'Failed to save business profile.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Logo File Selection -> Opens Crop Modal
  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      setLogoMsg({ type: 'error', text: 'Please select a valid image file (JPG, PNG, WEBP).' })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'Logo image must be under 8MB.' })
      return
    }
    setLogoMsg({ type: '', text: '' })

    const reader = new FileReader()
    reader.onload = (evt) => {
      setCropModalSrc(evt.target.result)
    }
    reader.readAsDataURL(file)
  }

  // Handle Cropped Logo Save
  async function handleCroppedLogo(croppedBlob, croppedDataUrl) {
    setUploadingLogo(true)
    setPreviewLogo(croppedDataUrl)
    setLogoMsg({ type: '', text: '' })

    try {
      const fd = new FormData()
      fd.append('avatar', croppedBlob, 'logo.jpg')
      const res = await call('/auth/avatar', { method: 'POST', body: fd })
      if (res?.picture && updateUser) {
        updateUser({ ...user, picture: res.picture })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, res.picture)
      } else if (res?.user && updateUser) {
        updateUser(res.user)
      }
      setCropModalSrc(null)
      setLogoMsg({ type: 'success', text: 'Company logo updated!' })
      setTimeout(() => setLogoMsg({ type: '', text: '' }), 4000)
    } catch (err) {
      try {
        const fb = await call('/auth/me', { method: 'PATCH', body: { picture: croppedDataUrl } })
        if (fb?.user && updateUser) updateUser(fb.user)
        else if (updateUser) updateUser({ ...user, picture: croppedDataUrl })
        if (user?.id) localStorage.setItem(`hb_avatar_${user.id}`, croppedDataUrl)
        setCropModalSrc(null)
        setLogoMsg({ type: 'success', text: 'Company logo updated!' })
        setTimeout(() => setLogoMsg({ type: '', text: '' }), 4000)
      } catch {
        setLogoMsg({ type: 'error', text: 'Failed to upload company logo.' })
        setPreviewLogo(null)
      }
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBuilding size={26} /> Business Profile
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Manage your company information, hiring contact, and company presence in Oriental Mindoro.
          </p>
        </div>
        <Link to="/dashboard/jobs/new" className="btn btn-primary btn-sm" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus size={14} /> Post a Job
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        <form onSubmit={save} className="panel">
          <h2 style={{ marginBottom: 20, fontSize: 18, color: 'var(--navy-d)' }}>Company Information</h2>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#b91c1c', marginBottom: 16, fontSize: 13, border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          <div className="field">
            <span>Company / Business Name</span>
            <div className="in">
              <IconBuilding size={17} />
              <input
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g. Mindoro Agro-Ventures Corp."
                required
              />
            </div>
          </div>

          <div className="field">
            <span>Hiring Contact Email</span>
            <div className="in">
              <IconMail size={17} />
              <input type="email" value={user.email} disabled style={{ opacity: .6 }} />
            </div>
          </div>

          <div className="field">
            <span>Hiring Contact Phone</span>
            <div className="in">
              <IconPin size={17} />
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          <div className="field">
            <span>Headquarters / Business Municipality</span>
            <div className="in">
              <IconPin size={17} />
              <select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                <option value="">Select Municipality in Oriental Mindoro</option>
                {TOWNS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <span>About the Company / Business Description</span>
            <div className="in no-icon">
              <textarea
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="Describe your company, products/services offered, work environment, and what makes your business great to work for…"
                style={{ minHeight: 120 }}
              />
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${saved ? 'is-done' : ''}`} disabled={saving}>
            {saving ? <span className="spin" /> : saved ? <><IconCheck size={16} /> Business Profile Saved</> : 'Save Business Profile'}
          </button>
        </form>

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Logo panel */}
          <div className="panel" style={{ textAlign: 'center', padding: '28px 20px' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
            />

            <div style={{ position: 'relative', width: 114, height: 114, margin: '0 auto 16px' }}>
              <div
                onClick={() => !uploadingLogo && fileInputRef.current?.click()}
                title="Click to upload company logo"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '3.5px solid var(--gold)',
                  boxShadow: '0 8px 20px rgba(10,37,87,0.15)',
                  cursor: uploadingLogo ? 'wait' : 'pointer',
                  position: 'relative',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={currentLogo}
                  alt={user?.full_name || 'Company Logo'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onError={e => { e.currentTarget.src = '/images/avatar.jpg' }}
                />
                {uploadingLogo && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,37,87,.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                    <span className="spin" style={{ width: 22, height: 22, marginBottom: 4 }} />
                    <span>Uploading...</span>
                  </div>
                )}
              </div>
            </div>

            {logoMsg.text && (
              <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, marginBottom: 12, background: logoMsg.type === 'error' ? '#fee2e2' : '#dcfce7', color: logoMsg.type === 'error' ? '#b91c1c' : '#15803d' }}>
                {logoMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-navy btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconBuilding size={14} /> Upload Company Logo
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.4 }}>
              JPG or PNG up to 5MB.<br/>Recommended square ratio for display on job postings.
            </p>

            <h3 style={{ fontSize: 17, marginBottom: 2, color: 'var(--navy-d)' }}>{user.full_name || 'Company'}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <IconBuilding size={14} /> Employer · {user.location || 'Oriental Mindoro'}
            </p>
            <span className="chip green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={12} /> Registered Employer</span>
          </div>

          {/* Quick links card */}
          <div className="panel">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>Employer Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/dashboard/jobs/new" className="btn btn-primary btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconPlus size={14} /> Post a New Vacancy
              </Link>
              <Link to="/dashboard/jobs" className="btn btn-light btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconBriefcase size={14} /> Manage Active Postings
              </Link>
              <Link to="/dashboard/applicants" className="btn btn-light btn-sm" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <IconUsers size={14} /> Review Job Applicants
              </Link>
            </div>
          </div>
        </div>
      </div>

      {cropModalSrc && (
        <ImageCropModal
          imageSrc={cropModalSrc}
          title="Crop & Adjust Company Logo"
          cropShape="round-rect"
          saving={uploadingLogo}
          onCrop={handleCroppedLogo}
          onCancel={() => setCropModalSrc(null)}
        />
      )}
    </div>
  )
}



/* ─ Job Matches page ────────────────────────────────────── */
function JobMatches({ call, user }) {
  const [matches, setMatches] = useState([])
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null)
  const [appliedSuccess, setAppliedSuccess] = useState({})

  useEffect(() => {
    Promise.all([
      call('/jobs?limit=50').catch(() => ({ data: [] })),
      call('/skills/my').catch(() => ({ skills: [] })),
      call('/applications/my').catch(() => ({ applications: [] })),
    ]).then(([jobsRes, skillsRes, appsRes]) => {
      const allJobs = jobsRes.data || jobsRes.jobs || []
      const userSkills = (skillsRes.skills || []).map(s => (s.skill_name || '').toLowerCase())
      const userLocation = (user?.location || '').toLowerCase()
      const appliedSet = new Set((appsRes.applications || []).map(a => Number(a.job_id)))
      setAppliedIds(appliedSet)

      const scored = allJobs.map(j => {
        const needed = (j.skills_needed || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        const matched = needed.filter(n => userSkills.some(us => us.includes(n) || n.includes(us)))
        const missing = needed.filter(n => !userSkills.some(us => us.includes(n) || n.includes(us)))

        let score = needed.length > 0 ? Math.round((matched.length / needed.length) * 80) + 15 : 75
        if (userLocation && (j.location || '').toLowerCase() === userLocation) {
          score = Math.min(100, score + 10)
        }
        score = Math.max(45, Math.min(98, score))

        return {
          ...j,
          matchScore: score,
          matchedSkills: matched,
          missingSkills: missing,
          isApplied: appliedSet.has(Number(j.id))
        }
      })

      scored.sort((a, b) => b.matchScore - a.matchScore)
      setMatches(scored)
    }).finally(() => setLoading(false))
  }, [call, user?.location])

  async function handleApply(job) {
    setApplying(job.id)
    try {
      await call('/applications', {
        method: 'POST',
        body: {
          job_id: job.id,
          cover_note: `Hello! I am very interested in this ${job.title} position in ${job.location}. My skills match this role well.`
        }
      })
      setAppliedSuccess(prev => ({ ...prev, [job.id]: true }))
      setAppliedIds(prev => new Set([...prev, Number(job.id)]))
    } catch (err) {
      if (err?.status === 401 || err?.message === 'Unauthorized') {
        alert('Your session has expired. Please sign in again.')
        window.location.href = '/login'
      } else {
        alert(err?.message || 'Failed to submit application.')
      }
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="page-inner">
      <div className="section-title">
        <div>
          <p className="eyebrow">Smart Matchmaking</p>
          <h1 style={{ fontSize: 28, marginTop: 4 }}>Job Matches for You</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Ranked based on your Skills Passport and Oriental Mindoro location.
          </p>
        </div>
        <Link to="/dashboard/passport" className="btn btn-light btn-sm">
          <IconShield size={16} /> Update Skills
        </Link>
      </div>

      {loading ? (
        <div className="panel"><div className="skel" style={{ height: 200 }} /></div>
      ) : matches.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>No matching jobs found right now.</p>
          <Link to="/jobs" className="btn btn-navy">Browse All Jobs <IconArrow /></Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {matches.map(j => {
            const hasApplied = appliedIds.has(Number(j.id)) || appliedSuccess[j.id]
            const isHigh = j.matchScore >= 80

            return (
              <div key={j.id} className="panel" style={{ borderLeft: isHigh ? '4px solid #10b981' : '4px solid var(--gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 19 }}>{j.title}</h2>
                      <span className={`chip ${isHigh ? 'green' : 'gold'}`} style={{ fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconStar size={13} /> {j.matchScore}% Match
                      </span>
                      <span className="chip" style={{ background: '#f3f4f6', textTransform: 'capitalize' }}>
                        {j.job_type}
                      </span>
                    </div>

                    <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span><strong>{j.company || j.employer_name}</strong></span>
                      <span><IconPin size={14} style={{ verticalAlign: -2 }} /> {j.location}</span>
                      {j.salary_min && (
                        <span style={{ color: 'var(--navy)', fontWeight: 600 }}>
                          ₱{Number(j.salary_min).toLocaleString()}–₱{Number(j.salary_max).toLocaleString()}/mo
                        </span>
                      )}
                    </p>

                    <p style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.5 }}>
                      {j.description}
                    </p>

                    {/* Skill Breakdown */}
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                        Required Skills:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {j.matchedSkills.map(s => (
                          <span key={s} className="chip green" style={{ fontSize: 12, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <IconCheck size={11} /> {s}
                          </span>
                        ))}
                        {j.missingSkills.map(s => (
                          <span key={s} className="chip" style={{ fontSize: 12, padding: '3px 9px', background: '#e5e7eb', color: '#4b5563' }}>
                            + {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    {hasApplied ? (
                      <span className="chip green" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
                        <IconCheck size={16} /> Applied
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApply(j)}
                        disabled={applying === j.id}
                      >
                        {applying === j.id ? <span className="spin" /> : '1-Click Apply'}
                      </button>
                    )}
                    <Link to={`/jobs/${j.id}`} className="btn btn-light btn-sm" style={{ width: '100%', textAlign: 'center' }}>
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─ Featured Jobs page (Worker view) ────────────────────── */
function FeaturedJobsPage({ call, user }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTown, setSelectedTown] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [applying, setApplying] = useState(null)
  const [appliedIds, setAppliedIds] = useState(new Set())
  const [appliedSuccess, setAppliedSuccess] = useState({})

  useEffect(() => {
    Promise.all([
      call('/jobs/featured').catch(() => ({ jobs: [] })),
      call('/applications/my').catch(() => ({ applications: [] })),
    ]).then(([featRes, appsRes]) => {
      const arr = featRes.jobs && featRes.jobs.length > 0 ? featRes.jobs : DEMO_FEATURED_JOBS
      setJobs(arr)
      const apps = appsRes.applications || []
      setAppliedIds(new Set(apps.map(a => Number(a.job_id))))
    }).finally(() => setLoading(false))
  }, [call])

  const handleApply = async (job) => {
    setApplying(job.id)
    try {
      await call('/applications', {
        method: 'POST',
        body: {
          job_id: job.id,
          cover_note: `Hello! I would like to apply for the ${job.title} position at ${job.company || job.employer_name || 'your company'}. My profile and skills match this opportunity.`
        }
      })
      setAppliedSuccess(prev => ({ ...prev, [job.id]: true }))
      setAppliedIds(prev => new Set([...prev, Number(job.id)]))
    } catch (err) {
      if (err?.status === 401 || err?.message === 'Unauthorized') {
        alert('Your session has expired. Please sign in again.')
        window.location.href = '/login'
      } else {
        alert(err?.message || 'Failed to submit application.')
      }
    } finally {
      setApplying(null)
    }
  }

  const filtered = jobs.filter(j => {
    const q = search.trim().toLowerCase()
    if (q) {
      const matchTitle = (j.title || '').toLowerCase().includes(q)
      const matchComp = (j.company || j.employer_name || '').toLowerCase().includes(q)
      const matchLoc = (j.location || '').toLowerCase().includes(q)
      if (!matchTitle && !matchComp && !matchLoc) return false
    }
    if (selectedTown && !(j.location || '').toLowerCase().includes(selectedTown.toLowerCase())) {
      return false
    }
    if (selectedType && j.job_type !== selectedType) {
      return false
    }
    return true
  })

  return (
    <div className="dash-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <p className="eyebrow" style={{ color: 'var(--gold)', fontWeight: 700 }}>Priority Opportunities</p>
          <h1 style={{ fontSize: 28, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#eab308' }}>⭐</span> Featured Jobs in Oriental Mindoro
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Handpicked, verified job postings with priority hiring from accredited employers and local MSMEs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/dashboard/matches" className="btn btn-light btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconSpark size={14} /> My Matches
          </Link>
          <Link to="/jobs" className="btn btn-navy btn-sm" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconBriefcase size={14} /> All Jobs Directory
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by job title, company, or keyword…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 34 }}
          />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>
            <IconSearch size={15} />
          </span>
        </div>
        <select
          className="input"
          value={selectedTown}
          onChange={e => setSelectedTown(e.target.value)}
          style={{ width: 190 }}
        >
          <option value="">All Municipalities</option>
          {TOWNS.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="input"
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="">All Job Types</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contractual">Contractual</option>
          <option value="freelance">Freelance</option>
          <option value="gig">Gig / Project</option>
        </select>
        {(search || selectedTown || selectedType) && (
          <button
            className="btn btn-light btn-sm"
            onClick={() => { setSearch(''); setSelectedTown(''); setSelectedType('') }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Jobs list */}
      {loading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="panel"><div className="skel" style={{ height: 160 }} /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '48px 20px' }}>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 16 }}>No featured jobs match your current filter.</p>
          <button
            className="btn btn-light"
            onClick={() => { setSearch(''); setSelectedTown(''); setSelectedType('') }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(j => {
            const hasApplied = appliedIds.has(Number(j.id)) || appliedSuccess[j.id]
            const isBusy = applying === j.id

            return (
              <div
                key={j.id}
                className="panel"
                style={{
                  borderLeft: '4px solid var(--gold)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  transition: 'transform .15s ease',
                  padding: '22px 24px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 16, flex: 1, minWidth: 260 }}>
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: '#f8fafc',
                      border: '1px solid var(--line)',
                      flexShrink: 0,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={getJobImage(j)}
                        alt={j.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                      <span style={{ position: 'absolute', fontWeight: 800, color: 'var(--navy)', fontSize: 20 }}>
                        {(j.company || j.employer_name || j.title || 'J')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>{j.title}</h2>
                        <span className="chip gold" style={{ fontSize: 10, padding: '2px 8px', fontWeight: 700 }}>⭐ Featured</span>
                        {j.match_pct && (
                          <span className="chip green" style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>
                            {j.match_pct}% Match
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{j.company || j.employer_name || 'Oriental Mindoro MSME'}</span>
                        <span style={{ color: '#0284c7', fontSize: 12, fontWeight: 700 }}>● Verified Employer</span>
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconPin size={14} /> {j.location || 'Oriental Mindoro'}
                        </span>
                        <span className="chip navy" style={{ textTransform: 'capitalize', fontSize: 11, padding: '2px 8px' }}>
                          {(j.job_type || 'Full-time').replace('-', ' ')}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy-d)' }}>
                          💰 {fmt(j.salary_min, j.salary_max)}
                        </span>
                      </div>
                      {j.description && (
                        <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0, maxWidth: 650 }}>
                          {j.description.length > 180 ? j.description.slice(0, 180) + '…' : j.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140, alignItems: 'stretch' }}>
                    {hasApplied ? (
                      <span className="chip green" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <IconCheck size={15} /> Applied
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApply(j)}
                        disabled={isBusy}
                        style={{ fontWeight: 600 }}
                      >
                        {isBusy ? 'Applying…' : 'Quick Apply'}
                      </button>
                    )}
                    <Link
                      to={`/jobs/${j.id}`}
                      className="btn btn-light btn-sm"
                      style={{ textAlign: 'center', fontWeight: 600 }}
                    >
                      View Details →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─ Settings page ───────────────────────────────────────── */
function Settings({ user, call, updateUser }) {
  const initialPrefs = user?.notification_prefs || {}
  const [notifs, setNotifs] = useState({
    email: initialPrefs.email !== false,
    job_alerts: initialPrefs.job_alerts !== false,
    sms: initialPrefs.sms === true,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // Keep in sync when user data updates
  useEffect(() => {
    if (user?.notification_prefs) {
      const p = user.notification_prefs
      setNotifs({
        email: p.email !== false,
        job_alerts: p.job_alerts !== false,
        sms: p.sms === true,
      })
    }
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
      setSaveErr(err.message || 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const handleSendTest = async () => {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await call('/notifications/test-email', { method: 'POST' })
      const r = res?.result || {}
      if (r?.success && r?.mode === 'brevo') {
        setTestResult({
          ok: true,
          text: `Nai-send na sa totoong Gmail inbox ni ${res.email || user.email} sa pamamagitan ng Brevo! Pakitingnan ang iyong Inbox o Spam folder.`
        })
      } else if (r?.success && r?.mode === 'logged') {
        setTestResult({
          ok: false,
          text: `Nai-save ang notification pero HINDI naipadala sa Gmail: walang BREVO_API_KEY na naka-set sa server (.env / Render). Na-log lang ito sa runtime/logs/mail.log.`
        })
      } else {
        setTestResult({
          ok: false,
          text: `HINDI naipadala ang email: ${r?.error || 'Unknown error'}`
        })
      }
    } catch (err) {
      setTestResult({
        ok: false,
        text: err.message || 'Hindi maipadala ang test email. Pakitingnan ang server configuration.'
      })
    } finally {
      setTestSending(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="section-title">
        <div>
          <p className="eyebrow">Preferences</p>
          <h1 style={{ fontSize: 28, marginTop: 4 }}>Account Settings</h1>
        </div>
      </div>

      <div style={{ maxWidth: 680 }}>
        {/* Main Notifications Card */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Notifications &amp; Alerts</h2>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 9999,
                background: notifs.email ? '#ecfdf5' : '#fef3c7',
                color: notifs.email ? '#065f46' : '#92400e',
              }}
            >
              {notifs.email ? '● Email Alerts Active' : '○ Email Alerts Paused'}
            </span>
          </div>

          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
            Configure how you receive updates about applications, job matches in Oriental Mindoro, and direct messages.
          </p>

          {/* Toggle: Email Notifications */}
          <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
            <div style={{ paddingRight: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-d)' }}>Email Notifications</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                Receive emails when an employer reviews your application, updates your status (Shortlisted, Hired), or sends a message.
              </div>
            </div>
            <input
              type="checkbox"
              style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
              checked={notifs.email}
              onChange={e => setNotifs({ ...notifs, email: e.target.checked })}
            />
          </label>

          {/* Toggle: Job Match Alerts */}
          <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
            <div style={{ paddingRight: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-d)' }}>Job Match Notifications</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                Receive instant email alerts whenever new jobs matching your skills or location are posted.
              </div>
            </div>
            <input
              type="checkbox"
              style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
              checked={notifs.job_alerts}
              onChange={e => setNotifs({ ...notifs, job_alerts: e.target.checked })}
            />
          </label>

          {/* Toggle: SMS Updates */}
          <label style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', cursor: 'pointer' }}>
            <div style={{ paddingRight: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy-d)' }}>SMS Updates</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
                Get urgent text message alerts for interviews and hiring offers on your phone ({user?.phone || 'No phone registered'}).
              </div>
            </div>
            <input
              type="checkbox"
              style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 2 }}
              checked={notifs.sms}
              onChange={e => setNotifs({ ...notifs, sms: e.target.checked })}
            />
          </label>

          {saveErr && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              {saveErr}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
            <button
              className={`btn btn-primary ${saved ? 'is-done' : ''}`}
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 150 }}
            >
              {saving ? 'Saving...' : saved ? <><IconCheck size={16} /> Preferences Saved</> : 'Save Preferences'}
            </button>
          </div>
        </div>

        {/* Test Notification Card */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Test Email Notification</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            Dispatch a test email to verify that your account receives alerts at <strong>{user?.email}</strong>.
          </p>

          <button
            className="btn btn-light"
            onClick={handleSendTest}
            disabled={testSending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <IconMail size={16} />
            {testSending ? 'Sending Test Email...' : `Send Test Notification to ${user?.email}`}
          </button>

          {testResult && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 16px',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5,
                background: testResult.ok ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${testResult.ok ? '#a7f3d0' : '#fecaca'}`,
                color: testResult.ok ? '#065f46' : '#991b1b',
              }}
            >
              <strong>
                {testResult.ok ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconCheck size={14} /> Success:{' '}
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <IconAlert size={14} /> Notice:{' '}
                  </span>
                )}
              </strong>
              {testResult.text}
            </div>
          )}
        </div>

        {/* Account Details Card */}
        <div className="panel">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Account Details</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            Signed in as <strong>{user?.email}</strong> &middot; Account role: <strong>{user?.role === 'admin' ? 'Administrator' : user?.account_type || 'worker'}</strong>
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            HanapBuhay Phase 1 &middot; Oriental Mindoro Skills Passport &amp; Employment Portal
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─ Employer Applicants Management ──────────────────────── */
const STATUS_OPTIONS = [
  {
    id: 'pending',
    label: 'Pending Review',
    desc: 'Candidate is in initial screening queue.',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fde68a',
    chipClass: 'gold',
    icon: IconClock
  },
  {
    id: 'shortlisted',
    label: 'Shortlisted',
    desc: 'Candidate meets qualifications and is shortlisted for next steps.',
    color: '#1d4ed8',
    bg: '#dbeafe',
    border: '#bfdbfe',
    chipClass: 'navy',
    icon: IconStar
  },
  {
    id: 'for_interview',
    label: 'For Interview',
    desc: 'Candidate is scheduled or invited for an interview.',
    color: '#7c3aed',
    bg: '#ede9fe',
    border: '#ddd6fe',
    chipClass: '',
    icon: IconCalendar
  },
  {
    id: 'hired',
    label: 'Hired / Accepted',
    desc: 'Candidate has been officially selected and offered the position!',
    color: '#047857',
    bg: '#d1fae5',
    border: '#a7f3d0',
    chipClass: 'green',
    icon: IconCheck
  },
  {
    id: 'rejected',
    label: 'Rejection / Not Selected',
    desc: 'Candidate is not selected for this opening.',
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    chipClass: '',
    icon: IconX
  }
]

function EmployerApplicants({ call }) {
  const { jobId } = useParams()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackOk, setFeedbackOk] = useState(true)
  const [statusModal, setStatusModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const endpoint = jobId ? `/applications/job/${jobId}` : `/applications/employer`
      const res = await call(endpoint)
      setApps(res?.applications || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [call, jobId])

  useEffect(() => { load() }, [load])

  const handleUpdate = async (id, status, applicantName, interviewDate = null, interviewNotes = null) => {
    setUpdatingId(id)
    setFeedback('')
    try {
      const body = { status }
      if (interviewDate !== null) body.interview_date = interviewDate
      if (interviewNotes !== null) body.interview_notes = interviewNotes

      const res = await call(`/applications/${id}/status`, {
        method: 'PATCH',
        body
      })
      const opt = STATUS_OPTIONS.find(o => o.id === status)
      const label = opt ? opt.label.toUpperCase() : status.toUpperCase()
      const email = res?.email || {}
      const who = applicantName || 'Candidate'
      let msg
      let ok = true
      if (email.success && email.mode === 'brevo') {
        msg = `${who} marked as ${label}! Email notification sent to ${email.to || 'the applicant'} via Brevo. Ask them to check Inbox or Spam.`
      } else if (email.success && email.mode === 'logged') {
        msg = `${who} marked as ${label}. In-app notification saved, but email was only LOGGED (BREVO_API_KEY is not set on the server). No Gmail was sent.`
        ok = false
      } else if (email.mode === 'skipped') {
        msg = `${who} marked as ${label}. In-app notification saved; email skipped because the applicant turned off email alerts.`
        ok = false
      } else {
        msg = `${who} marked as ${label}. In-app notification saved, but the email FAILED: ${email.error || 'unknown error'}`
        ok = false
      }
      setFeedbackOk(ok)
      setFeedback(msg)
      setTimeout(() => setFeedback(''), ok ? 6000 : 12000)
      load()
    } catch (err) {
      alert('Error updating status: ' + (err.message || 'Server error'))
    } finally {
      setUpdatingId(null)
    }
  }

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === 'pending' || a.status === 'reviewed').length,
    shortlisted: apps.filter(a => a.status === 'shortlisted').length,
    for_interview: apps.filter(a => a.status === 'for_interview').length,
    hired: apps.filter(a => a.status === 'hired').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  }

  const filtered = apps.filter(a => {
    if (filter === 'all') return true
    if (filter === 'pending') return a.status === 'pending' || a.status === 'reviewed'
    return a.status === filter
  })

  return (
    <div className="page-inner">
      <div className="section-title">
        <div>
          <p className="eyebrow">Recruitment &amp; Candidates</p>
          <h1 style={{ fontSize: 28, marginTop: 4 }}>Job Applicants</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            Review applicants, customize recruitment statuses, schedule interviews, and track candidate progress.
          </p>
        </div>
        <button className="btn btn-light btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* Stats Summary */}
      <div className="dash-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 20 }}>
        {[
          { label: 'Total Applicants', val: counts.all, color: 'var(--navy)', bg: 'var(--navy-soft)' },
          { label: 'Pending Review', val: counts.pending, color: '#b45309', bg: '#fef3c7' },
          { label: 'Shortlisted', val: counts.shortlisted, color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'For Interview', val: counts.for_interview, color: '#7c3aed', bg: '#ede9fe' },
          { label: 'Hired / Accepted', val: counts.hired, color: '#047857', bg: '#d1fae5' },
          { label: 'Rejected', val: counts.rejected, color: '#dc2626', bg: '#fee2e2' },
        ].map((s) => (
          <div key={s.label} className="dstat">
            <div className="dstat-icon" style={{ background: s.bg, color: s.color, fontWeight: 800, fontSize: 16 }}>
              {s.val}
            </div>
            <div>
              <div className="dstat-val">{s.val}</div>
              <div className="dstat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {feedback && (
        <div style={{ padding: '12px 18px', background: feedbackOk ? '#ecfdf5' : '#fffbeb', border: `1px solid ${feedbackOk ? '#a7f3d0' : '#fde68a'}`, borderRadius: 10, color: feedbackOk ? '#065f46' : '#92400e', fontSize: 14, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          {feedbackOk ? <IconCheck size={18} /> : <IconAlert size={18} />} {feedback}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 12, overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'shortlisted', label: 'Shortlisted' },
          { id: 'for_interview', label: 'For Interview' },
          { id: 'hired', label: 'Hired' },
          { id: 'rejected', label: 'Rejected' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`btn btn-sm ${filter === tab.id ? 'btn-primary' : 'btn-light'}`}
            style={{ fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {tab.label} ({counts[tab.id] || 0})
          </button>
        ))}
      </div>

      {/* Applicants List */}
      {loading ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <span className="spin" style={{ width: 28, height: 28 }} />
          <p style={{ marginTop: 12, color: 'var(--muted)' }}>Loading applicants…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
          <IconUsers size={36} style={{ color: '#cbd5e1', marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, color: 'var(--navy-d)', marginBottom: 6 }}>No applicants found</h3>
          <p style={{ fontSize: 13, margin: 0 }}>
            {filter === 'all'
              ? 'No one has applied to your job postings yet. When workers apply, they will appear here.'
              : `No applicants currently under "${filter.replace('_', ' ')}" status.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(a => {
            const currentStatus = a.status === 'reviewed' ? 'pending' : a.status
            const isHired = currentStatus === 'hired'
            const isInterview = currentStatus === 'for_interview'
            const isShortlisted = currentStatus === 'shortlisted'
            const isRejected = currentStatus === 'rejected'
            const isPending = currentStatus === 'pending'

            const statusObj = STATUS_OPTIONS.find(o => o.id === currentStatus) || STATUS_OPTIONS[0]

            return (
              <div
                key={a.id}
                className="panel"
                style={{
                  padding: 20,
                  borderLeft: `4px solid ${statusObj.color}`,
                  transition: 'box-shadow .2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  {/* Candidate Profile */}
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1, minWidth: 280 }}>
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                      <img src={a.applicant_picture || '/images/avatar.jpg'} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />
                      <span>{(a.applicant_name || a.full_name || 'A')[0].toUpperCase()}</span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
                          {a.applicant_name || a.full_name || 'Candidate'}
                        </h3>
                        {a.match_score && (
                          <span className="chip" style={{ background: '#ecfdf5', color: '#065f46', fontWeight: 700, fontSize: 11 }}>
                            {a.match_score}% Match
                          </span>
                        )}

                        {/* Interactive Status Chip with Click-to-Edit */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className="chip"
                            style={{
                              fontSize: 11,
                              background: statusObj.bg,
                              color: statusObj.color,
                              border: `1px solid ${statusObj.border}`,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}
                          >
                            ● {statusObj.label}
                          </span>
                          <button
                            type="button"
                            className="btn btn-light btn-xs"
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4, height: 22 }}
                            onClick={() => setStatusModal({
                              app: a,
                              status: currentStatus,
                              date: a.interview_date ? a.interview_date.replace(' ', 'T').slice(0, 16) : '',
                              notes: a.interview_notes || ''
                            })}
                            title="Edit or customize recruitment status"
                          >
                            <IconEdit size={11} /> Edit Status
                          </button>
                        </div>
                      </div>

                      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>Applied for: <strong style={{ color: 'var(--ink)' }}>{a.job_title}</strong></span>
                        {a.applicant_location && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPin size={13} /> {a.applicant_location}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconMail size={13} /> {a.applicant_email || a.email}</span>
                        {a.applicant_phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconPhone size={13} /> {a.applicant_phone}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconClock size={13} /> {days(a.created_at)}</span>
                      </div>

                      {/* Cover Note */}
                      {a.cover_note && (
                        <div style={{ marginTop: 12, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#334155', borderLeft: '3px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Applicant Note:</span>
                          "{a.cover_note}"
                        </div>
                      )}

                      {/* Application Pipeline Tracker for Employer */}
                      <ApplicationTracker
                        status={a.status}
                        interviewDate={a.interview_date}
                        interviewNotes={a.interview_notes}
                      />
                    </div>
                  </div>

                  {/* Action Buttons: Status Customizer & Quick Actions */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Primary Status Customizer Button */}
                    <button
                      className="btn btn-sm"
                      style={{
                        background: 'var(--navy)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      disabled={updatingId === a.id}
                      onClick={() => setStatusModal({
                        app: a,
                        status: currentStatus,
                        date: a.interview_date ? a.interview_date.replace(' ', 'T').slice(0, 16) : '',
                        notes: a.interview_notes || ''
                      })}
                      title="Customize applicant status"
                    >
                      <IconEdit size={13} /> Customize Status
                    </button>

                    {/* Quick 1-click Shortlist */}
                    {!isShortlisted && !isHired && (
                      <button
                        className="btn btn-light btn-sm"
                        disabled={updatingId === a.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        onClick={() => handleUpdate(a.id, 'shortlisted', a.applicant_name || a.full_name)}
                        title="Shortlist candidate"
                      >
                        <IconStar size={13} /> Shortlist
                      </button>
                    )}

                    {/* Quick 1-click For Interview */}
                    {!isInterview && !isHired && (
                      <button
                        className="btn btn-sm"
                        style={{
                          background: '#7c3aed',
                          color: '#fff',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12
                        }}
                        disabled={updatingId === a.id}
                        onClick={() => setStatusModal({
                          app: a,
                          status: 'for_interview',
                          date: a.interview_date ? a.interview_date.replace(' ', 'T').slice(0, 16) : '',
                          notes: a.interview_notes || ''
                        })}
                        title="Schedule an interview"
                      >
                        <IconCalendar size={13} /> For Interview
                      </button>
                    )}

                    {/* Quick 1-click Hire / Accept */}
                    {!isHired && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#059669', color: '#fff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        disabled={updatingId === a.id}
                        onClick={() => handleUpdate(a.id, 'hired', a.applicant_name || a.full_name)}
                        title="Officially hire candidate"
                      >
                        {updatingId === a.id ? 'Updating…' : <><IconCheck size={13} /> Hire</>}
                      </button>
                    )}

                    {/* Quick 1-click Reject */}
                    {!isRejected && !isHired && (
                      <button
                        className="btn btn-light btn-sm"
                        style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        disabled={updatingId === a.id}
                        onClick={() => setStatusModal({
                          app: a,
                          status: 'rejected',
                          date: '',
                          notes: a.interview_notes || ''
                        })}
                        title="Mark as not selected"
                      >
                        <IconX size={13} /> Reject
                      </button>
                    )}

                    {/* Re-open / Reconsider for Hired or Rejected candidates */}
                    {(isHired || isRejected) && (
                      <button
                        className="btn btn-light btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                        disabled={updatingId === a.id}
                        onClick={() => handleUpdate(a.id, 'pending', a.applicant_name || a.full_name)}
                        title="Revert back to Pending Review"
                      >
                        <IconClock size={13} /> Re-open (Pending)
                      </button>
                    )}

                    {/* Chat with candidate */}
                    {a.worker_id && (
                      <Link
                        to={`/dashboard/messages?to=${a.worker_id}`}
                        className="btn btn-light btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                      >
                        <IconMsgCircle size={13} /> Message
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Status Customizer Modal (Pending / Shortlisted / For Interview / Hired / Rejected) ─── */}
      {statusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10, 15, 29, 0.7)', backdropFilter: 'blur(3px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="panel" style={{ width: '100%', maxWidth: 540, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--navy-d)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconEdit size={20} style={{ color: 'var(--gold)' }} />
                Customize Candidate Status
              </h3>
              <button
                onClick={() => setStatusModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4 }}
              >
                <IconX size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Candidate: <strong style={{ color: 'var(--ink)' }}>{statusModal.app.applicant_name || statusModal.app.full_name}</strong><br />
              Position: <strong style={{ color: 'var(--ink)' }}>{statusModal.app.job_title}</strong>
            </p>

            {/* 5 Selectable Status Cards */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
                Select Application Status
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                {STATUS_OPTIONS.map(opt => {
                  const isSelected = statusModal.status === opt.id
                  const OptIcon = opt.icon
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setStatusModal(m => ({ ...m, status: opt.id }))}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: isSelected ? `2px solid ${opt.color}` : '1.5px solid var(--line)',
                        background: isSelected ? opt.bg : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all .15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: isSelected ? opt.color : '#f1f5f9',
                            color: isSelected ? '#ffffff' : opt.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <OptIcon size={14} />
                        </span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? opt.color : 'var(--navy-d)' }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 12, color: isSelected ? opt.color : 'var(--muted)', marginTop: 1, opacity: isSelected ? 0.9 : 0.8 }}>
                            {opt.desc}
                          </div>
                        </div>
                      </div>

                      <input
                        type="radio"
                        name="candidate_status"
                        checked={isSelected}
                        onChange={() => setStatusModal(m => ({ ...m, status: opt.id }))}
                        style={{ accentColor: opt.color, width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Conditional Fields based on status */}
            {statusModal.status === 'for_interview' && (
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px 0', color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCalendar size={15} /> Interview Schedule &amp; Instructions
                </h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#4c1d95' }}>
                    Interview Date &amp; Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={statusModal.date}
                    onChange={e => setStatusModal(m => ({ ...m, date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: 13, background: '#fff' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#4c1d95' }}>
                    Venue / Meeting Link / Notes for Candidate (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. In-person interview at Calapan City Office or Google Meet link. Please bring printed resume and 1 valid ID."
                    value={statusModal.notes}
                    onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #c4b5fd', fontSize: 13, resize: 'vertical', background: '#fff' }}
                  />
                </div>
              </div>
            )}

            {statusModal.status === 'rejected' && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px 0', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconX size={15} /> Constructive Feedback / Reason (Optional)
                </h4>
                <p style={{ fontSize: 12, color: '#991b1b', margin: '0 0 8px 0' }}>
                  Provide helpful feedback for the applicant (e.g. position filled, specific skill certification needed).
                </p>
                <textarea
                  rows={2}
                  placeholder="e.g. Thank you for your application. We have decided to proceed with candidates with specialized NC II certification."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 13, resize: 'vertical', background: '#fff' }}
                />
              </div>
            )}

            {statusModal.status === 'hired' && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px 0', color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={15} /> Onboarding Instructions &amp; Next Steps (Optional)
                </h4>
                <textarea
                  rows={2}
                  placeholder="e.g. Congratulations! Please report to HR on Monday 8:00 AM with 2 valid IDs and SSS/PhilHealth."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #86efac', fontSize: 13, resize: 'vertical', background: '#fff' }}
                />
              </div>
            )}

            {(statusModal.status === 'shortlisted' || statusModal.status === 'pending') && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--navy-d)' }}>
                  Screening Remarks / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Strong experience in electrical installations, follow up next week."
                  value={statusModal.notes}
                  onChange={e => setStatusModal(m => ({ ...m, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line)', fontSize: 13, resize: 'vertical' }}
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button
                className="btn btn-light"
                onClick={() => setStatusModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  const { app, status, date, notes } = statusModal
                  setStatusModal(null)
                  handleUpdate(app.id, status, app.applicant_name || app.full_name, date || null, notes || null)
                }}
              >
                <IconCheck size={14} /> Save Status &amp; Notify Candidate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─ Admin User Management page ──────────────────────────── */
function AdminUsers({ call }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'inactive'
  const [togglingId, setTogglingId] = useState(null)
  const [selected, setSelected] = useState(null) // user detail panel

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const q = search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''
      const rf = roleFilter !== 'all' ? `&role=${roleFilter}` : ''
      const sf = statusFilter !== 'all' ? `&status=${statusFilter}` : ''
      const res = await call(`/admin/users?limit=200${q}${rf}${sf}`)
      setUsers(res?.users || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [call, search, roleFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(loadUsers, 300)
    return () => clearTimeout(t)
  }, [loadUsers])

  async function toggleUser(id, currentStatus) {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'disable/ban' : 'activate'} this user account?`)) return
    setTogglingId(id)
    try {
      const res = await call(`/admin/users/${id}/toggle`, { method: 'PATCH' })
      if (res?.success) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.is_active } : u))
        if (selected?.id === id) setSelected(prev => ({ ...prev, is_active: res.is_active }))
      }
    } catch (err) {
      alert(err?.message || 'Failed to toggle user status.')
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount   = users.filter(u => Number(u.is_active) === 1).length
  const inactiveCount = users.filter(u => Number(u.is_active) === 0).length

  return (
    <div className="page-inner" style={{ position: 'relative' }}>
      {/* User Detail Slide-over */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: '#fff', zIndex: 201, boxShadow: '-8px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>Account Details</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><IconX size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* Avatar + name */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div className="avatar" style={{ width: 72, height: 72, margin: '0 auto 12px', overflow: 'hidden', border: `3px solid ${Number(selected.is_active) ? '#22c55e' : '#ef4444'}` }}>
                  <img src={selected.picture || '/images/avatar.jpg'} alt={selected.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                  <span style={{ fontSize: 22 }}>{(selected.full_name || selected.email || '?')[0].toUpperCase()}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--navy-d)' }}>{selected.full_name || '—'}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{selected.email}</p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span className={`chip ${selected.role === 'admin' ? 'navy' : selected.role === 'employer' ? 'gold' : ''}`} style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{selected.role}</span>
                  <span className={`status-badge ${Number(selected.is_active) ? 'active' : 'archived'}`} style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {Number(selected.is_active) ? <><IconCheck size={10} />Active</> : <><IconX size={10} />Disabled</>}
                  </span>
                </div>
              </div>

              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                {[
                  { icon: IconMail, label: 'Email', val: selected.email },
                  { icon: IconPhone, label: 'Phone', val: selected.phone || 'Not set' },
                  { icon: IconPin, label: 'Location', val: selected.location || 'Not set' },
                  { icon: IconUser, label: 'Account Type', val: selected.account_type ? selected.account_type.charAt(0).toUpperCase() + selected.account_type.slice(1) : '—' },
                  { icon: IconCalendar, label: 'Registered', val: selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { icon: IconClock, label: 'Last Updated', val: selected.updated_at ? new Date(selected.updated_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                ].map(({ icon: Ic, label, val }, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < 5 ? '1px solid var(--line)' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--navy-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', flexShrink: 0 }}>
                      <Ic size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
                      <div style={{ fontSize: 13, color: 'var(--navy-d)', fontWeight: 500, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bio */}
              {selected.bio && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>Bio</div>
                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{selected.bio}</p>
                </div>
              )}

              {/* User ID */}
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 20 }}>
                Account ID: <strong style={{ color: 'var(--navy-d)' }}>#{selected.id}</strong>
              </div>

              {/* Action */}
              <button
                className={`btn btn-sm ${Number(selected.is_active) ? 'btn-light' : 'btn-primary'}`}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 700, color: Number(selected.is_active) ? '#dc2626' : undefined }}
                disabled={togglingId === selected.id}
                onClick={() => toggleUser(selected.id, Number(selected.is_active) === 1)}
              >
                {togglingId === selected.id ? <><span className="spin" style={{ marginRight: 6 }} /> Updating…</>
                  : Number(selected.is_active) ? <><IconX size={15} /> Disable / Ban Account</> : <><IconCheck size={15} /> Activate Account</>}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Page header */}
      <div className="section-title" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconUsers size={26} /> User Management
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Search, moderate, and manage all user accounts on HanapBuhay.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip navy" style={{ fontWeight: 700, padding: '6px 14px' }}>{users.length} Loaded</span>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#f1f5f9', borderRadius: 10, padding: 4, alignSelf: 'flex-start', width: 'fit-content' }}>
        {[
          { id: 'all',      label: 'All Users',    count: users.length },
          { id: 'active',   label: 'Active',        count: activeCount },
          { id: 'inactive', label: 'Deactivated',   count: inactiveCount },
        ].map(tab => (
          <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              background: statusFilter === tab.id ? '#fff' : 'transparent',
              color: statusFilter === tab.id ? 'var(--navy-d)' : 'var(--muted)',
              boxShadow: statusFilter === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
            {tab.label}
            <span style={{ marginLeft: 6, fontSize: 11, background: statusFilter === tab.id ? (tab.id === 'inactive' ? '#fef2f2' : '#eff6ff') : 'transparent', color: tab.id === 'inactive' ? '#dc2626' : 'var(--navy)', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="panel" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input type="text" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ id: 'all', label: 'All Roles' }, { id: 'worker', label: 'Workers' }, { id: 'employer', label: 'Employers' }, { id: 'admin', label: 'Admins' }].map(f => (
            <button key={f.id} onClick={() => setRoleFilter(f.id)}
              className={`btn btn-xs ${roleFilter === f.id ? 'btn-navy' : 'btn-light'}`}
              style={{ fontWeight: 600, padding: '6px 12px' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span className="spin" style={{ display: 'inline-block', marginRight: 8 }} /> Loading users…
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><IconSearch size={34} /></div>
            <p style={{ fontSize: 14 }}>No users found matching your filters.</p>
            <button className="btn btn-light btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}>Clear Filters</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isActive = Number(u.is_active) === 1
                  return (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 34, height: 34, overflow: 'hidden', flexShrink: 0, border: `2px solid ${isActive ? '#22c55e' : '#ef4444'}` }}>
                            <img src={u.picture || '/images/avatar.jpg'} alt={u.full_name} onError={e => { e.currentTarget.style.display = 'none' }} />
                            <span style={{ fontSize: 12 }}>{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-d)' }}>{u.full_name || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${u.role === 'admin' ? 'navy' : u.role === 'employer' ? 'gold' : ''}`} style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{u.role}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{u.location || '—'}</td>
                      <td>
                        <span className={`status-badge ${isActive ? 'active' : 'archived'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          {isActive ? <><IconCheck size={10} /> Active</> : <><IconX size={10} /> Disabled</>}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-PH') : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-light btn-xs" style={{ fontSize: 11 }} onClick={() => setSelected(u)}>
                            <IconUser size={12} /> View
                          </button>
                          <button
                            className={`btn btn-xs ${isActive ? 'btn-light' : 'btn-primary'}`}
                            style={{ fontSize: 11, color: isActive ? '#dc2626' : undefined }}
                            disabled={togglingId === u.id}
                            onClick={() => toggleUser(u.id, isActive)}
                          >
                            {togglingId === u.id ? '…' : isActive ? 'Disable' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ Admin Job Moderation page ───────────────────────────── */
function AdminJobs({ call }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await call('/admin/jobs')
      setJobs(res?.jobs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [call])

  useEffect(() => { loadJobs() }, [loadJobs])

  const filtered = jobs.filter(j => {
    const matchSearch = !search.trim() || 
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.employer_name?.toLowerCase().includes(search.toLowerCase()) ||
      j.location?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="page-inner">
      <div className="section-title" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconBriefcase size={26} /> Job Post Moderation
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
            Oversee and moderate all job listings published by Oriental Mindoro employers.
          </p>
        </div>
        <span className="chip navy" style={{ fontWeight: 700, padding: '6px 14px' }}>
          {jobs.length} Listings
        </span>
      </div>

      <div className="panel" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search job title, employer, or municipality…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'active', 'archived'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn btn-xs ${statusFilter === s ? 'btn-navy' : 'btn-light'}`}
              style={{ fontWeight: 600, textTransform: 'capitalize', padding: '6px 12px' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <span className="spin" style={{ display: 'inline-block', marginRight: 8 }} /> Loading job postings…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}><IconBriefcase size={32} /></div>
            <p style={{ fontSize: 14 }}>No job posts found.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Employer / Business</th>
                  <th>Location</th>
                  <th>Salary Range</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(j => (
                  <tr key={j.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-d)' }}>{j.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Views: {j.views || 0}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{j.employer_name || 'Employer'}</td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <IconPin size={13} /> {j.location || 'Oriental Mindoro'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{fmt(j.salary_min, j.salary_max)}</td>
                    <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{j.type || 'Full-time'}</td>
                    <td>
                      <span className={`status-badge ${j.status === 'active' ? 'active' : 'archived'}`}>
                        ● {j.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{days(j.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/jobs/${j.id}`} target="_blank" className="btn btn-light btn-xs" style={{ textDecoration: 'none' }}>
                        ↗ View Public Post
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ Admin Verification Queue ────────────────────────────── */
function AdminVerification({ call }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'verified'
  const [search, setSearch] = useState('')
  const [reviewUser, setReviewUser] = useState(null)
  const [reviewDetails, setReviewDetails] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  const loadUsers = useCallback(() => {
    setLoading(true)
    call('/admin/users?limit=100')
      .then(res => setUsers(res?.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [call])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openReview = async (u) => {
    setReviewUser(u)
    setReviewDetails(null)
    setReviewLoading(true)
    try {
      const res = await call(`/admin/users/${u.id}`)
      if (res?.success) {
        setReviewDetails(res)
      } else {
        setReviewDetails({ user: u, jobs: [], applications: [], skills: [] })
      }
    } catch {
      setReviewDetails({ user: u, jobs: [], applications: [], skills: [] })
    } finally {
      setReviewLoading(false)
    }
  }

  const handleVerify = async (id, status) => {
    if (status === 0 && !window.confirm('Are you sure you want to revoke the verification status of this account?')) {
      return
    }
    setVerifying(true)
    try {
      const res = await call(`/admin/users/${id}/verify`, {
        method: 'PATCH',
        body: { is_verified: status }
      })
      if (res?.success) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_verified: status } : u))
        if (reviewUser?.id === id) {
          setReviewUser(prev => ({ ...prev, is_verified: status }))
          setReviewDetails(prev => prev ? { ...prev, user: { ...prev.user, is_verified: status } } : prev)
        }
        setToastMessage({
          type: 'success',
          text: status === 1
            ? 'Account verified and endorsed successfully! Notification sent.'
            : 'Verification revoked successfully.'
        })
        setTimeout(() => setToastMessage(null), 4000)
      } else {
        alert(res?.error || 'Failed to update verification status.')
      }
    } catch (err) {
      alert(err?.message || 'Error updating verification status.')
    } finally {
      setVerifying(false)
    }
  }

  const q = search.trim().toLowerCase()
  const filteredUsers = users.filter(u => {
    if (filter === 'pending' && Number(u.is_verified) === 1) return false
    if (filter === 'verified' && Number(u.is_verified) !== 1) return false
    if (q) {
      const matchName = (u.full_name || '').toLowerCase().includes(q)
      const matchEmail = (u.email || '').toLowerCase().includes(q)
      const matchLoc = (u.location || '').toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchLoc) return false
    }
    return true
  })

  const employers = filteredUsers.filter(u => u.role === 'employer' || u.account_type === 'employer')
  const workers = filteredUsers.filter(u => u.role === 'worker' || u.account_type === 'worker' || u.account_type === 'jobseeker')

  const totalPending = users.filter(u => Number(u.is_verified) !== 1 && u.role !== 'admin').length
  const totalVerified = users.filter(u => Number(u.is_verified) === 1 && u.role !== 'admin').length

  const target = reviewDetails?.user || reviewUser
  const isEmployer = target && (target.role === 'employer' || target.account_type === 'employer')
  const isTargetVerified = target && Number(target.is_verified) === 1

  return (
    <div className="page-inner" style={{ position: 'relative' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: '#064e3b',
          color: '#ecfdf5',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          fontSize: 13,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <IconCheck size={18} /> {toastMessage.text}
        </div>
      )}

      {/* Page Header */}
      <div className="section-title" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 26, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--navy-d)' }}>
              <IconShield size={26} color="var(--gold)" /> Verification &amp; Endorsement Queue
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
              Inspect credentials, posted vacancies, and Skills Passports before endorsing Mindoro workers and employers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="chip gold" style={{ fontSize: 12, padding: '6px 12px', fontWeight: 700 }}>
              {totalPending} Pending Review
            </span>
            <span className="chip green" style={{ fontSize: 12, padding: '6px 12px', fontWeight: 700 }}>
              {totalVerified} Verified
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Users (${users.filter(u => u.role !== 'admin').length})` },
            { id: 'pending', label: `Pending Review (${totalPending})` },
            { id: 'verified', label: `Verified / Endorsed (${totalVerified})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`btn btn-xs ${filter === f.id ? 'btn-navy' : 'btn-light'}`}
              style={{ fontWeight: 600, fontSize: 12, padding: '6px 14px' }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <IconSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search by name, email, town…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
            style={{ paddingLeft: 34, height: 36, fontSize: 13, width: '100%' }}
          />
        </div>
      </div>

      {/* Grid: Employers & Workers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* Mindoro Employers Panel */}
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, margin: 0, color: 'var(--navy-d)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconBuilding size={18} color="var(--navy)" /> Mindoro Employers ({employers.length})
            </h2>
            <span className="chip gold" style={{ fontSize: 11, fontWeight: 700 }}>Business Registry</span>
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading employers…</div>
          ) : employers.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>No employers match the current filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {employers.map(e => {
                const isV = Number(e.is_verified) === 1
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, marginRight: 12 }}>
                      <div className="avatar" style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--line)', background: 'var(--navy-soft)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                        {e.picture ? (
                          <img src={e.picture} alt="" onError={ev => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (e.full_name || 'B')[0].toUpperCase()
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-d)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.full_name || 'Business'}
                          </span>
                          {isV && (
                            <span title="Verified Business" style={{ color: '#16a34a', display: 'inline-flex' }}>
                              <IconCheck size={14} />
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <IconPin size={11} /> {e.location || 'Oriental Mindoro'} · {e.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isV ? (
                        <span className="chip green" style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconCheck size={11} /> Verified
                        </span>
                      ) : (
                        <span className="chip gold" style={{ fontSize: 11, fontWeight: 700 }}>
                          Pending
                        </span>
                      )}
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => openReview(e)}
                        style={{ fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}
                      >
                        <IconEye size={13} /> View &amp; Review
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Registered Workers Panel */}
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, margin: 0, color: 'var(--navy-d)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconWrench size={18} color="var(--navy)" /> Registered Workers ({workers.length})
            </h2>
            <span className="chip navy" style={{ fontSize: 11, fontWeight: 700 }}>Skills Passport</span>
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Loading workers…</div>
          ) : workers.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>No workers match the current filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {workers.map(w => {
                const isV = Number(w.is_verified) === 1
                return (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'border-color 0.15s, box-shadow 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, marginRight: 12 }}>
                      <div className="avatar" style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--line)', background: 'var(--navy-soft)', color: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                        {w.picture ? (
                          <img src={w.picture} alt="" onError={ev => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          (w.full_name || 'W')[0].toUpperCase()
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy-d)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {w.full_name || 'Worker'}
                          </span>
                          {isV && (
                            <span title="Endorsed Worker" style={{ color: '#16a34a', display: 'inline-flex' }}>
                              <IconCheck size={14} />
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <IconPin size={11} /> {w.location || 'Oriental Mindoro'} · {w.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isV ? (
                        <span className="chip green" style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconCheck size={11} /> Endorsed
                        </span>
                      ) : (
                        <span className="chip gold" style={{ fontSize: 11, fontWeight: 700 }}>
                          Pending
                        </span>
                      )}
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => openReview(w)}
                        style={{ fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px' }}
                      >
                        <IconEye size={13} /> View &amp; Review
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Verification Review Modal */}
      {reviewUser && (
        <div
          onClick={() => setReviewUser(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            backdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 14,
              width: 760,
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isEmployer ? (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconBuilding size={20} />
                  </div>
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconWrench size={20} />
                  </div>
                )}
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
                    {isEmployer ? 'Employer Credential & Job Verification' : 'Worker Profile & Skills Passport Review'}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                    Carefully review details before endorsing or verifying.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewUser(null)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted)', padding: 6, borderRadius: 6 }}
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {reviewLoading ? (
                <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
                  <div className="spin" style={{ width: 28, height: 28, margin: '0 auto 12px', border: '3px solid var(--navy-soft)', borderTopColor: 'var(--navy)' }} />
                  Loading complete profile &amp; credentials…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Verification Banner */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: isTargetVerified ? '#ecfdf5' : '#fffbeb',
                    border: `1px solid ${isTargetVerified ? '#bbf7d0' : '#fde68a'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <IconShield size={20} color={isTargetVerified ? '#16a34a' : '#d97706'} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: isTargetVerified ? '#166534' : '#92400e' }}>
                          {isTargetVerified
                            ? (isEmployer ? 'Verified Mindoro Employer' : 'Endorsed HanapBuhay Worker')
                            : 'Pending Verification / Review Needed'}
                        </div>
                        <div style={{ fontSize: 12, color: isTargetVerified ? '#15803d' : '#b45309' }}>
                          {isTargetVerified
                            ? 'This account has official endorsement and verified trust status on the platform.'
                            : 'Inspect the business credentials, contact info, and activity below before endorsing.'}
                        </div>
                      </div>
                    </div>
                    <span className={`chip ${isTargetVerified ? 'green' : 'gold'}`} style={{ fontSize: 11, fontWeight: 700 }}>
                      {isTargetVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  {/* Profile Header Details */}
                  <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', background: '#f8fafc', padding: 18, borderRadius: 10, border: '1px solid var(--line)' }}>
                    <div className="avatar" style={{ width: 72, height: 72, borderRadius: isEmployer ? 12 : '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--line)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 26, color: 'var(--navy)' }}>
                      {target.picture ? (
                        <img src={target.picture} alt="" onError={ev => { ev.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (target.full_name || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>
                          {target.full_name || 'No Name Provided'}
                        </h3>
                        <span className={`chip ${isEmployer ? 'gold' : 'navy'}`} style={{ fontSize: 11, textTransform: 'capitalize', fontWeight: 700 }}>
                          {target.role || target.account_type || 'User'}
                        </span>
                        <span className={`chip ${Number(target.is_active) ? 'green' : 'gray'}`} style={{ fontSize: 11, fontWeight: 600 }}>
                          {Number(target.is_active) ? 'Active Account' : 'Inactive'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px', marginTop: 12, fontSize: 12.5, color: 'var(--ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                          <IconPin size={14} color="var(--navy)" />
                          <span style={{ color: 'var(--navy-d)', fontWeight: 500 }}>{target.location || 'Oriental Mindoro (Not specified)'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                          <IconMail size={14} color="var(--navy)" />
                          <span style={{ color: 'var(--navy-d)', fontWeight: 500 }}>{target.email || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                          <IconPhone size={14} color="var(--navy)" />
                          <span style={{ color: 'var(--navy-d)', fontWeight: 500 }}>{target.phone || 'No phone set'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
                          <IconCalendar size={14} color="var(--navy)" />
                          <span style={{ color: 'var(--muted)' }}>Registered:</span>
                          <span style={{ color: 'var(--navy-d)', fontWeight: 500 }}>
                            {target.created_at ? new Date(target.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio / Description */}
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '14px 18px', background: '#fff' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' }}>
                      {isEmployer ? 'Company / Business Overview' : 'Worker Bio / Background Summary'}
                    </h4>
                    <p style={{ fontSize: 13.5, color: target.bio ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>
                      {target.bio || (isEmployer ? 'No business description provided yet.' : 'No worker bio provided yet.')}
                    </p>
                  </div>

                  {/* Employer Section: Posted Vacancies */}
                  {isEmployer && (
                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-d)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <IconBriefcase size={15} color="var(--navy)" /> Posted Job Openings ({reviewDetails?.jobs?.length || 0})
                        </h4>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Active business verification factor</span>
                      </div>

                      {(!reviewDetails?.jobs || reviewDetails.jobs.length === 0) ? (
                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                          This employer has not posted any job openings yet.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {reviewDetails.jobs.map(job => (
                            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--line)' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-d)' }}>{job.title}</div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                                  <span>{job.job_type || 'Full-time'}</span>
                                  <span>·</span>
                                  <span>{job.category || 'General'}</span>
                                  <span>·</span>
                                  <span>{job.location || 'Oriental Mindoro'}</span>
                                  <span>·</span>
                                  <strong style={{ color: 'var(--navy)' }}>{fmt(job.salary_min, job.salary_max)}</strong>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span className={`chip ${job.status === 'closed' ? 'gray' : 'green'}`} style={{ fontSize: 10.5, textTransform: 'capitalize' }}>
                                  {job.status || 'Active'}
                                </span>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                  {job.applicant_count ? `${job.applicant_count} applicants` : 'Posted ' + days(job.created_at)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Worker Section: Skills Passport & Applications */}
                  {!isEmployer && (
                    <>
                      {/* Skills Passport */}
                      <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-d)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IconShield size={15} color="var(--gold)" /> Skills Passport &amp; Certifications ({reviewDetails?.skills?.length || 0})
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Endorsement validation</span>
                        </div>

                        {(!reviewDetails?.skills || reviewDetails.skills.length === 0) ? (
                          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                            No skills or certifications recorded in this worker's Skills Passport yet.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                            {reviewDetails.skills.map(skill => (
                              <div key={skill.id} style={{ padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--line)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-d)' }}>{skill.skill_name}</span>
                                  <span className={`chip ${skill.verified ? 'green' : 'navy'}`} style={{ fontSize: 10 }}>
                                    {skill.level || 'Intermediate'}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                                  {skill.category || 'Vocational'} · {skill.source || 'Work Experience'}
                                </div>
                                {skill.certificate && (
                                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                                    Cert: {skill.certificate}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Job Applications Submitted */}
                      <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '16px 18px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-d)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IconBriefcase size={15} color="var(--navy)" /> Job Applications Submitted ({reviewDetails?.applications?.length || 0})
                          </h4>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Activity history</span>
                        </div>

                        {(!reviewDetails?.applications || reviewDetails.applications.length === 0) ? (
                          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                            No job applications submitted yet.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {reviewDetails.applications.map(app => (
                              <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid var(--line)' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy-d)' }}>{app.job_title || 'Position'}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                                    {app.company || app.employer_name || 'Employer'} · Applied {days(app.created_at)}
                                  </div>
                                </div>
                                <span className={`chip ${app.status === 'hired' ? 'green' : app.status === 'shortlisted' ? 'gold' : app.status === 'rejected' ? 'red' : 'navy'}`} style={{ fontSize: 10.5, textTransform: 'capitalize' }}>
                                  {app.status || 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer / Action Bar */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <Link
                  to={`/dashboard/messages?to=${target?.id}`}
                  className="btn btn-light btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}
                >
                  <IconMsgCircle size={14} /> Send Direct Message
                </Link>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() => setReviewUser(null)}
                  style={{ fontSize: 12.5 }}
                >
                  Close
                </button>

                {isTargetVerified ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 600, fontSize: 12.5 }}
                    disabled={verifying}
                    onClick={() => handleVerify(target.id, 0)}
                  >
                    {verifying ? 'Updating…' : 'Revoke Verification'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-navy btn-sm"
                    style={{ fontWeight: 700, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    disabled={verifying}
                    onClick={() => handleVerify(target.id, 1)}
                  >
                    <IconShield size={15} color="var(--gold)" />
                    {verifying ? 'Verifying…' : isEmployer ? 'Verify Business' : 'Endorse Worker'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─ Admin Payments & Revenue page ───────────────────────── */
function AdminPayments({ call }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all') // 'all' | 'active' | 'pending' | 'paymongo'

  useEffect(() => {
    setLoading(true)
    call('/admin/payments')
      .then(res => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [call])

  const payments   = data?.payments || []
  const summary    = data?.summary  || {}

  const q = search.trim().toLowerCase()
  const filtered = payments.filter(p => {
    if (filter === 'active'   && p.status !== 'active')    return false
    if (filter === 'pending'  && p.status !== 'pending')   return false
    if (filter === 'paymongo' && !String(p.payment_method || '').includes('paymongo') && !String(p.payment_reference || '').startsWith('cs_')) return false
    if (q) {
      const haystack = `${p.full_name} ${p.email} ${p.plan_name} ${p.payment_reference}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })

  const statusColor  = { active: '#16a34a', pending: '#d97706', cancelled: '#dc2626', expired: '#6b7280' }
  const methodBadge  = (m) => {
    if (!m) return <span className="chip" style={{ background: '#f1f5f9', color: '#475569', fontSize: 11 }}>—</span>
    if (m.includes('gcash'))   return <span className="chip green"  style={{ fontSize: 11 }}>GCash</span>
    if (m.includes('maya'))    return <span className="chip navy"   style={{ fontSize: 11 }}>Maya</span>
    if (m.includes('card'))    return <span className="chip gold"   style={{ fontSize: 11 }}>Card</span>
    if (m.includes('paymongo'))return <span className="chip green"  style={{ fontSize: 11 }}>PayMongo</span>
    if (m === 'free')          return <span className="chip"        style={{ background: '#f8fafc', color: '#64748b', fontSize: 11 }}>Free</span>
    return <span className="chip" style={{ fontSize: 11 }}>{m}</span>
  }

  return (
    <div className="page-inner">
      {/* Header */}
      <div className="section-title" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 26, margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--navy-d)' }}>
              <IconSpark size={26} color="#059669" /> Payments &amp; Revenue
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>
              Lahat ng subscription payments — real-time view ng PayMongo transactions sa HanapBuhay Mindoro.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Powered by PayMongo · BSP Licensed
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dash-stats" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {[
          { icon: IconSpark,     bg: '#ecfdf5', color: '#059669', val: loading ? '…' : `₱${Number(summary.total_revenue   || 0).toLocaleString()}`, label: 'Total Revenue',      sub: 'All time' },
          { icon: IconSpark,     bg: '#eff6ff', color: '#2563eb', val: loading ? '…' : `₱${Number(summary.month_revenue  || 0).toLocaleString()}`, label: 'This Month',         sub: new Date().toLocaleString('default',{month:'long'}) },
          { icon: IconFile,      bg: '#faf5ff', color: '#7c3aed', val: loading ? '…' : summary.total_transactions || 0,                             label: 'Total Transactions', sub: 'All plans' },
          { icon: IconUsers,     bg: '#fffbeb', color: '#d97706', val: loading ? '…' : summary.active_subscribers || 0,                             label: 'Active Subscribers', sub: 'Currently subscribed' },
          { icon: IconCheck,     bg: '#f0fdf4', color: '#16a34a', val: loading ? '…' : summary.paymongo_count    || 0,                              label: 'PayMongo Payments',  sub: 'Real gateway' },
        ].map(({ icon: Ic, bg, color, val, label, sub }) => (
          <div key={label} className="dstat">
            <div className="dstat-icon" style={{ background: bg, color }}><Ic size={22} /></div>
            <div>
              <div className="dstat-val">{val}</div>
              <div className="dstat-label">{label}</div>
              {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="panel" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all',      label: `All (${payments.length})` },
            { id: 'active',   label: `Active (${payments.filter(p=>p.status==='active').length})` },
            { id: 'pending',  label: `Pending (${payments.filter(p=>p.status==='pending').length})` },
            { id: 'paymongo', label: `PayMongo (${summary.paymongo_count || 0})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`btn btn-xs ${filter === f.id ? 'btn-navy' : 'btn-light'}`}
              style={{ fontWeight: 600, fontSize: 12, padding: '6px 14px' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <IconSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input type="text" placeholder="Search by name, email, plan…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="input" style={{ paddingLeft: 34, height: 36, fontSize: 13, width: '100%' }} />
        </div>
      </div>

      {/* Payments Table */}
      <div className="panel">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            <div className="skel" style={{ height: 200, borderRadius: 8 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <IconSpark size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>Walang payments na nahanap.</p>
            <p style={{ fontSize: 13 }}>Try adjusting the filter or search term.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Subscriber</th>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference / Session</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div className="avatar" style={{ width: 32, height: 32, overflow: 'hidden', flexShrink: 0 }}>
                          <img src={p.picture || '/images/avatar.jpg'} alt={p.full_name}
                            onError={e => { e.currentTarget.style.display = 'none' }} />
                          <span style={{ fontSize: 12 }}>{(p.full_name || p.email || '?')[0].toUpperCase()}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{p.full_name || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="chip navy" style={{ fontSize: 11 }}>{p.plan_name || '—'}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 14, color: '#059669' }}>
                      {Number(p.amount) > 0 ? `₱${Number(p.amount).toLocaleString()}` : <span style={{ color: 'var(--muted)', fontWeight: 400 }}>Free</span>}
                    </td>
                    <td>{methodBadge(p.payment_method)}</td>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', wordBreak: 'break-all', maxWidth: 200, display: 'inline-block' }}>
                        {p.payment_reference
                          ? (String(p.payment_reference).startsWith('cs_')
                              ? <><span className="chip green" style={{ fontSize: 10, marginRight: 4 }}>PayMongo</span>{String(p.payment_reference).slice(0, 20)}…</>
                              : String(p.payment_reference).slice(0, 24))
                          : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: statusColor[p.status] ? statusColor[p.status] + '20' : '#f1f5f9',
                        color: statusColor[p.status] || '#475569'
                      }}>
                        {(p.status || '—').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ Main Dashboard shell ────────────────────────────────── */
export default function Dashboard() {
  const { user, logout, tokens, updateUser, call } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifCount] = useState(0)

  const role = user.role === 'admin' ? 'admin' : user.account_type

  let Overview
  if (role === 'admin')                            Overview = <AdminOverview call={call} />
  else if (role === 'employer' || role === 'hirer') Overview = <EmployerOverview user={user} call={call} />
  else                                              Overview = <WorkerOverview user={user} call={call} />

  return (
    <div className="sidebar-layout" style={{ position: 'relative' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 55, display: 'none' }}
          className="mob-overlay" />
      )}

      <Sidebar user={user} logout={logout} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="dash-content">
        <Topbar user={user} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} call={call} />

        <Routes>
          {/* Universal root dashboard overview */}
          <Route index element={Overview} />

          {/* Universal communication & settings tools */}
          <Route path="messages" element={<Messages call={call} user={user} tokens={tokens} />} />
          <Route path="subscription" element={<Subscription user={user} call={call} updateUser={updateUser} />} />
          <Route path="settings" element={<Settings user={user} call={call} updateUser={updateUser} />} />

          {/* ── WORKER SPECIFIC PAGES (Worker / Jobseeker Only) ── */}
          {(role !== 'employer' && role !== 'hirer' && role !== 'admin') && (
            <>
              <Route path="profile"  element={<WorkerProfile user={user} call={call} tokens={tokens} updateUser={updateUser} />} />
              <Route path="passport" element={<SkillsPassport call={call} tokens={tokens} />} />
              <Route path="featured" element={<FeaturedJobsPage call={call} user={user} />} />
              <Route path="matches"  element={<JobMatches call={call} user={user} />} />
              <Route path="applied"  element={<MyApplications call={call} />} />
              <Route path="training" element={<Training call={call} />} />
            </>
          )}

          {/* ── EMPLOYER SPECIFIC PAGES (Employer / Hirer Only) ── */}
          {(role === 'employer' || role === 'hirer') && (
            <>
              <Route path="profile"           element={<EmployerProfile user={user} call={call} updateUser={updateUser} />} />
              <Route path="jobs"              element={<EmployerJobs call={call} tokens={tokens} />} />
              <Route path="jobs/new"          element={<PostJob call={call} tokens={tokens} />} />
              <Route path="jobs/:id/edit"     element={<PostJobEdit call={call} tokens={tokens} />} />
              <Route path="applicants"        element={<EmployerApplicants call={call} />} />
              <Route path="applicants/:jobId" element={<EmployerApplicants call={call} />} />
            </>
          )}

          {/* ── ADMIN SPECIFIC PAGES (Admin Only) ── */}
          {role === 'admin' && (
            <>
              <Route path="profile"  element={<AdminProfile user={user} call={call} updateUser={updateUser} />} />
              <Route path="users"    element={<AdminUsers call={call} />} />
              <Route path="jobs"     element={<AdminJobs call={call} />} />
              <Route path="verify"   element={<AdminVerification call={call} />} />
              <Route path="payments" element={<AdminPayments call={call} />} />
            </>
          )}

          {/* Catch-all: If user tries to access a page outside their role, redirect safely to /dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}
