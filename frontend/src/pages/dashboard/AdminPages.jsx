// Dashboard admin pages (split out of Dashboard.jsx so each role downloads only its own code).
import askConfirm, { showNotice } from '../../components/askConfirm.jsx'
import { usePaged, Pager, ListTools, SORT } from '../../components/Pager.jsx'
import { useEffect, useState, useCallback } from 'react'
import { statusLabel, statusTone } from '../../utils/hiringStatus.js'
import BrandLoader from '../../components/BrandLoader.jsx'
import { Link } from 'react-router-dom'
import { IconUser, IconBriefcase, IconShield, IconUsers, IconPin, IconMail, IconCheck, IconMsgCircle, IconSearch, IconTrend, IconX, IconClock, IconCalendar, IconBuilding, IconEdit, IconPhone, IconWrench, IconAlert, IconEye } from '../../components/icons.jsx'
import { fmt, days } from './shared.jsx'
import CertificateReview from '../../components/CertificateReview.jsx'
import BusinessReview from '../../components/BusinessReview.jsx'
import { avatarDataUrl } from '../../components/Avatar.jsx'

/** The account kind people recognise: Worker, Employer, Client, Admin. */
const roleName = u => (u?.role === 'admin' ? 'Admin' : { worker: 'Worker', employer: 'Employer', hirer: 'Client' }[u?.account_type] || 'User')
import '../../styles/admin-overview.css'

/* ─ Admin overview (home) lives in AdminOverview.jsx; the dashboard loads it from here ─ */
export { AdminOverview } from './AdminOverview.jsx'

/* ─ Admin: job reports review ───────────────────────────── */
export const REPORT_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
]

export function AdminReports({ call }) {
  const [tab, setTab] = useState('open')
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({ open: 0, reviewed: 0, dismissed: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [stored, setStored] = useState(true) // false until the job_reports table exists (migration 012)

  const load = useCallback(() => {
    setLoading(true)
    call(`/admin/reports?status=${tab}`)
      .then(r => { setRows(r?.reports || []); setCounts(r?.counts || { open: 0, reviewed: 0, dismissed: 0 }); setStored(r?.enabled !== false) })
      .catch(err => setMsg(err.message || 'Could not load reports.'))
      .finally(() => setLoading(false))
  }, [call, tab])

  useEffect(() => { load() }, [load])

  const act = async (report, status, action) => {
    if (action === 'archive_job' && !(await askConfirm({ tone: 'danger', title: 'Remove this job?', body: `"${report.job_title}" will be taken off the job board and the employer will be told.`, yes: 'Remove job' }))) return
    setBusy(report.id); setMsg('')
    try {
      await call(`/admin/reports/${report.id}`, { method: 'PATCH', body: { status, action } })
      setMsg(action === 'archive_job' ? 'Job removed and the employer was notified.' : 'Report updated.')
      load()
    } catch (err) {
      setMsg(err.message || 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  const fmt = (ts) => ts ? new Date(String(ts).replace(' ', 'T')).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const statusChip = (s) => s === 'open'
    ? { cls: 'gold', label: 'Open' }
    : s === 'reviewed' ? { cls: 'green', label: 'Reviewed' } : { cls: 'gray', label: 'Dismissed' }

  const pg = usePaged(rows, { sorts: { new: ['Newest first', SORT.date('created_at')], old: ['Oldest first', (a, b) => -SORT.date('created_at')(a, b)] } })
  return (
    <div className="page-inner">

      <div className="ap-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="ap-stat tone-amber"><span className="ap-stat-val">{counts.open}</span><span className="ap-stat-label">Open</span></div>
        <div className="ap-stat tone-green"><span className="ap-stat-val">{counts.reviewed}</span><span className="ap-stat-label">Reviewed</span></div>
        <div className="ap-stat tone-navy"><span className="ap-stat-val">{counts.dismissed}</span><span className="ap-stat-label">Dismissed</span></div>
      </div>

      <div className="ap-tabs">
        {REPORT_TABS.map(t => (
          <button key={t.id} className={`ap-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {msg && <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--soft)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{msg}</div>}
      {!stored && (
        <div role="status" style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--gold-l)', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
          <b>Reports are not stored yet.</b> The database update (migration 012) hasn't been run, so new reports reach you only as notifications under the bell. Run <code>php public/index.php migrate</code> to keep them here.
        </div>
      )}

      {loading ? (
        <BrandLoader compact label="Loading…" />
      ) : rows.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '44px 20px' }}>
          <IconCheck size={28} />
          <h3 style={{ margin: '10px 0 4px' }}>No reports here</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Nothing waiting in this list.</p>
        </div>
      ) : (
        <>
        <ListTools pg={pg} noun="report" />
        <div style={{ display: 'grid', gap: 12 }}>
          {pg.items.map(r => {
            const chip = statusChip(r.status)
            const removed = r.job_status === 'archived'
            return (
              <article key={r.id} className="panel" style={{ padding: '18px 20px', borderLeft: `3px solid ${r.status === 'open' ? 'var(--gold)' : 'var(--line)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {r.job_title
                        ? <Link to={`/dashboard/browse/${r.job_id}`} style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 16 }}>{r.job_title}</Link>
                        : <span style={{ fontWeight: 800, fontSize: 16 }}>Deleted job #{r.job_id}</span>}
                      <span className={`chip ${chip.cls}`} style={{ fontSize: 11, fontWeight: 700 }}>{chip.label}</span>
                      {removed && <span className="chip red" style={{ fontSize: 11, fontWeight: 700 }}>Removed</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                      {r.job_company || r.employer_name || 'Unknown employer'} · reported by {r.reporter_name || 'a user'} · {fmt(r.created_at)}
                    </div>
                  </div>
                </div>

                <blockquote style={{ margin: '12px 0 14px', padding: '10px 14px', background: 'var(--soft)', borderRadius: 10, fontSize: 14, color: 'var(--text)', lineHeight: 1.55 }}>
                  {r.reason || 'No details given.'}
                </blockquote>

                {r.status === 'open' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" disabled={busy === r.id || !r.job_title || removed} onClick={() => act(r, 'reviewed', 'archive_job')}
                      style={{ background: '#dc2626', color: '#fff', fontWeight: 700 }}>
                      Remove job &amp; notify employer
                    </button>
                    <button className="btn btn-light btn-sm" disabled={busy === r.id} onClick={() => act(r, 'dismissed', 'none')}>Dismiss, keep job</button>
                    <button className="btn btn-light btn-sm" disabled={busy === r.id} onClick={() => act(r, 'reviewed', 'none')}>Mark reviewed</button>
                  </div>
                )}
                {r.status !== 'open' && (
                  <button className="btn btn-light btn-sm" disabled={busy === r.id} onClick={() => act(r, 'open', 'none')}>Reopen</button>
                )}
              </article>
            )
          })}
        </div>
        <Pager pg={pg} />
        </>
      )}

      {/* Ratings in both directions are moderated on their own page, which also
          covers the ratings employers leave about workers. */}
      <p className="panel" style={{ marginTop: 16, fontSize: 13.5, color: 'var(--muted)' }}>
        Looking for star ratings? <Link to="/dashboard/reviews" style={{ fontWeight: 700 }}>Review Moderation</Link>{' '}
        covers both directions — what workers said about employers, and what employers said about workers.
      </p>
    </div>
  )
}

/* ─ Admin Profile page ──────────────────────────────────── */
export function AdminProfile({ user, call, updateUser }) {
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
      <div className="page-actions">
        <button className="btn btn-primary btn-sm" onClick={() => setEditing(v => !v)}>
          {editing ? <><IconX size={15} /> Cancel</> : <><IconEdit size={15} /> Edit Profile</>}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, background: msg.ok ? '#f0fdf4' : '#fef2f2', color: msg.ok ? '#16a34a' : '#dc2626', fontSize: 14, border: `1px solid ${msg.ok ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          {msg.ok ? <IconCheck size={15} /> : <IconAlert size={15} />} {msg.text}
          <button onClick={() => setMsg(null)} style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', opacity: .6 }}><IconX size={14} /></button>
        </div>
      )}

      <div className="adm-prof">
        <div className="panel rise" style={{ textAlign: 'center', padding: 28, minWidth: 0 }}>
          <div className="avatar avatar-gold" style={{ width: 84, height: 84, margin: '0 auto 14px', overflow: 'hidden' }}>
            <img src={user.picture || avatarDataUrl(user)} alt={user.full_name} />
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
            <p style={{ fontWeight: 700, color: 'var(--navy-d)', marginTop: 2 }}>{user.created_at ? new Date(String(user.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }) : '—'}</p>
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
                <div key={label} className="adm-row">
                  <div className="adm-row-k">{label}</div>
                  <div className="adm-row-v">{val}</div>
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
            <div className="adm-access">
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

/* ─ Admin User Management page ──────────────────────────── */
export function AdminUsers({ call }) {
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
      const res = await call(`/admin/users?limit=500${q}${rf}${sf}`)
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
    if (!(await askConfirm(currentStatus ? { tone: 'danger', title: 'Disable this account?', body: 'The person will be signed out and can’t sign in until you turn the account back on.', yes: 'Disable account' } : { title: 'Turn this account back on?', body: 'The person will be able to sign in again.', yes: 'Turn on' }))) return
    setTogglingId(id)
    try {
      const res = await call(`/admin/users/${id}/toggle`, { method: 'PATCH' })
      if (res?.success) {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: res.is_active } : u))
        if (selected?.id === id) setSelected(prev => ({ ...prev, is_active: res.is_active }))
      }
    } catch (err) {
      showNotice('Could not change the account', err?.message || 'Please try again.')
    } finally {
      setTogglingId(null)
    }
  }

  const activeCount   = users.filter(u => Number(u.is_active) === 1).length
  const inactiveCount = users.filter(u => Number(u.is_active) === 0).length
  const pg = usePaged(users, { perPage: 20, sorts: {
    new: ['Newest first', SORT.date('created_at')],
    old: ['Oldest first', (a, b) => -SORT.date('created_at')(a, b)],
    name: ['Name (A–Z)', SORT.text('full_name')],
    town: ['Town (A–Z)', SORT.text('location')],
  } })

  return (
    <div className="page-inner" style={{ position: 'relative' }}>
      {/* User Detail Slide-over */}
      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '100vw', background: '#fff', zIndex: 201, boxShadow: '-8px 0 40px rgba(0,0,0,.15)', display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--navy-d)' }}>Account Details</h2>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><IconX size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {/* Avatar + name */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div className="avatar" style={{ width: 72, height: 72, margin: '0 auto 12px', overflow: 'hidden', border: `3px solid ${Number(selected.is_active) ? '#22c55e' : '#ef4444'}` }}>
                  <img src={selected.picture || avatarDataUrl(selected)} alt={selected.full_name} />
                  <span style={{ fontSize: 22 }}>{(selected.full_name || selected.email || '?')[0].toUpperCase()}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--navy-d)' }}>{selected.full_name || '—'}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>{selected.email}</p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <span className={`chip ${selected.role === 'admin' ? 'navy' : selected.account_type === 'worker' ? 'green' : 'gold'}`} style={{ fontSize: 11, fontWeight: 700 }}>{roleName(selected)}</span>
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
                  { icon: IconCalendar, label: 'Registered', val: selected.created_at ? new Date(String(selected.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { icon: IconClock, label: 'Last Updated', val: selected.updated_at ? new Date(String(selected.updated_at).replace(' ', 'T')).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
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

      {/* Status tabs */}
      <div className="ap-tabs" role="tablist" aria-label="Account status">
        {[
          { id: 'all',      label: 'All users',   count: users.length },
          { id: 'active',   label: 'Active',      count: activeCount },
          { id: 'inactive', label: 'Deactivated', count: inactiveCount },
        ].map(tab => (
          <button key={tab.id} type="button" role="tab" aria-selected={statusFilter === tab.id} className={`ap-tab${statusFilter === tab.id ? ' on' : ''}`} onClick={() => setStatusFilter(tab.id)}>
            {tab.label} <span className="ap-tab-n">{tab.count}</span>
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
          {[{ id: 'all', label: 'All Roles' }, { id: 'worker', label: 'Workers' }, { id: 'employer', label: 'Employers' }, { id: 'hirer', label: 'Clients' }, { id: 'admin', label: 'Admins' }].map(f => (
            <button key={f.id} onClick={() => setRoleFilter(f.id)}
              className={`btn btn-xs ${roleFilter === f.id ? 'btn-navy' : 'btn-light'}`}
              style={{ fontWeight: 600, padding: '6px 12px' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <BrandLoader compact label="Loading users…" />
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><IconSearch size={34} /></div>
            <p style={{ fontSize: 14 }}>No users found matching your filters.</p>
            <button className="btn btn-light btn-sm" style={{ marginTop: 12 }} onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}>Clear Filters</button>
          </div>
        ) : (
          <div className="table-wrap">
            <div style={{ padding: '12px 16px 0' }}><ListTools pg={pg} noun="user" perPageOptions={[20, 50, 100]}>{users.length >= 500 && <span className="pf-small"> · showing the newest 500, search to narrow</span>}</ListTools></div>
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
                {pg.items.map(u => {
                  const isActive = Number(u.is_active) === 1
                  return (
                    <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 34, height: 34, overflow: 'hidden', flexShrink: 0, border: `2px solid ${isActive ? '#22c55e' : '#ef4444'}` }}>
                            <img src={u.picture || avatarDataUrl(u)} alt={u.full_name} />
                            <span style={{ fontSize: 12 }}>{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy-d)' }}>{u.full_name || '—'}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`chip ${u.role === 'admin' ? 'navy' : u.account_type === 'worker' ? 'green' : 'gold'}`} style={{ fontSize: 11, fontWeight: 700 }}>{roleName(u)}</span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{u.location || '—'}</td>
                      <td>
                        <span className={`status-badge ${isActive ? 'active' : 'archived'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          {isActive ? <><IconCheck size={10} /> Active</> : <><IconX size={10} /> Disabled</>}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {u.created_at ? new Date(String(u.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
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
            <div style={{ padding: '0 16px 12px' }}><Pager pg={pg} /></div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─ Admin Verification Queue ────────────────────────────── */
export function AdminVerification({ call }) {
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
    if (status === 0 && !(await askConfirm({ tone: 'danger', title: 'Remove the Verified badge?', body: 'The account goes back to unverified and the person is told.', yes: 'Remove badge' }))) return
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
        showNotice('Could not update verification', res?.error || 'Please try again.')
      }
    } catch (err) {
      showNotice('Could not update verification', err?.message || 'Please try again.')
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

      {/* Business registration documents, then skill certificates */}
      <BusinessReview call={call} />
      <CertificateReview call={call} />

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
                <BrandLoader compact label="Loading profile and credentials…" />
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
                            ? (isEmployer ? 'Verified Mindoro Employer' : 'Endorsed hanapbuhay Worker')
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
                            {target.created_at ? new Date(String(target.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
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
                                <span className={`chip ${statusTone(app.status) || 'navy'}`} style={{ fontSize: 10.5 }}>
                                  {statusLabel(app.status || 'pending')}
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

