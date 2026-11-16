// Admin home: what needs action, the headline numbers, and recent activity.
// All data comes from GET /api/admin/overview?days=7|30|90 (AdminController::overview);
// the range buttons scope every number, the chart and the "new" counts together.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import { Link } from 'react-router-dom'
import { IconCheck, IconArrow, IconAlert } from '../../components/icons.jsx'
import { days as ago } from './shared.jsx'
import '../../styles/admin-overview.css'

const RANGES = [7, 30, 90]
const TYPE_LABEL = { worker: 'Workers', employer: 'Employers', hirer: 'Clients', admin: 'Admins', none: 'No type yet' }
const SERIES = [
  { key: 'users', label: 'New users', color: 'var(--ao-s1)' },
  { key: 'applications', label: 'Applications', color: 'var(--ao-s2)' },
]

const num = n => Number(n || 0).toLocaleString('en-PH')
const compact = n => Number(n || 0) >= 10000
  ? new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  : num(n)
const peso = n => '₱' + compact(Math.round(Number(n || 0)))
const dayLabel = (iso, opts = { month: 'short', day: 'numeric' }) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', opts)

/* ─ Stat tile: label · value · what changed in the range ───── */
function Stat({ label, value, note }) {
  return (
    <div className="ao-stat">
      <span className="ao-stat-label">{label}</span>
      <span className="ao-stat-value">{value}</span>
      <span className="ao-stat-note">{note}</span>
    </div>
  )
}

/* ─ Needs attention: each row links to the page that resolves it ─ */
function Attention({ a }) {
  const rows = [
    { n: a.support_waiting, label: 'Help requests waiting for a reply', to: '/dashboard/support', action: 'Reply' },
    { n: a.open_reports, label: 'Job reports to review', to: '/dashboard/reports', action: 'Review' },
    { n: a.unverified_workers, label: 'Workers awaiting verification', to: '/dashboard/verify', action: 'Verify' },
    { n: a.unverified_employers, label: 'Employers awaiting verification', to: '/dashboard/verify', action: 'Verify' },
    { n: a.pending_certificates, label: 'Certificates to check', to: '/dashboard/verify', action: 'Check' },
    { n: a.pending_payments, label: 'Payments pending', to: '/dashboard/payments', action: 'Open' },
    { n: a.inactive_users, label: 'Deactivated accounts', to: '/dashboard/users', action: 'View', info: true },
  ].filter(r => r.n !== null && r.n !== undefined)
  const open = rows.filter(r => !r.info && r.n > 0).length

  return (
    <section className="ao-card" aria-labelledby="ao-att">
      <header className="ao-card-hd">
        <h2 id="ao-att">Needs attention</h2>
        <span className="ao-muted">{open ? `${open} to do` : 'All clear'}</span>
      </header>
      <ul className="ao-att">
        {rows.map(r => {
          const todo = !r.info && r.n > 0
          return (
            <li key={r.label}>
              <span className={`ao-att-ic ${todo ? 'warn' : r.info ? 'info' : ''}`} aria-hidden="true">
                {todo ? <IconAlert size={14} /> : r.info ? null : <IconCheck size={14} />}
              </span>
              <span className="ao-att-label">{r.label}</span>
              <span className="ao-att-n">{todo || r.info ? num(r.n) : 'None'}</span>
              {r.n > 0
                ? <Link to={r.to} className="ao-att-go" aria-label={`${r.action}: ${r.label}`}>{r.action} <IconArrow size={13} /></Link>
                : <span className="ao-att-go" aria-hidden="true" />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ─ Activity chart: 2 lines, one axis, crosshair + tooltip, table twin ─ */
function niceTicks(max) {
  if (max <= 4) return [0, 1, 2, 3, 4].filter(t => t <= Math.max(max, 1) + 1).slice(0, Math.max(max, 1) + 1)
  const raw = max / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

function ActivityChart({ daily, days }) {
  const wrap = useRef(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState(null)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const H = 200, pad = { t: 12, r: 44, b: 26, l: 34 }
  const iw = Math.max(10, w - pad.l - pad.r), ih = H - pad.t - pad.b
  const max = Math.max(1, ...daily.flatMap(d => SERIES.map(s => d[s.key])))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const x = i => pad.l + (daily.length < 2 ? iw / 2 : (i / (daily.length - 1)) * iw)
  const y = v => pad.t + ih - (v / top) * ih
  const path = key => daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('')
  // a range with no days yet (new install) has no ticks to draw
  const xTicks = daily.length ? [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])] : []
  const last = daily[daily.length - 1]
  const totals = SERIES.map(s => daily.reduce((a, d) => a + d[s.key], 0))

  // end labels only when they don't collide (otherwise legend + tooltip carry it)
  const endYs = SERIES.map(s => y(last?.[s.key] || 0))
  const showEnds = last && Math.abs(endYs[0] - endYs[1]) >= 14

  function pick(clientX) {
    const r = wrap.current.getBoundingClientRect()
    const rel = (clientX - r.left - pad.l) / iw
    setHover(Math.max(0, Math.min(daily.length - 1, Math.round(rel * (daily.length - 1)))))
  }
  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover(h => Math.max(0, Math.min(daily.length - 1, (h ?? daily.length - 1) + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setHover(null)
  }

  const h = hover !== null ? daily[hover] : null
  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) - 70, 0), w - 150) : 0
  const summary = `New users and applications per day, last ${days} days: ${num(totals[0])} new users and ${num(totals[1])} applications.`

  return (
    <div>
      <div className="ao-legend" aria-hidden="true">
        {SERIES.map((s, i) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.label} <b>{num(totals[i])}</b></span>
        ))}
      </div>
      <div ref={wrap} className="ao-chart" tabIndex={0} role="img" aria-label={summary}
        onPointerMove={e => pick(e.clientX)} onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(daily.length - 1)} onBlur={() => setHover(null)} onKeyDown={onKey}>
        <svg width={w} height={H} aria-hidden="true">
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} className="ao-grid" />
              <text x={pad.l - 8} y={y(t)} className="ao-axis" textAnchor="end" dominantBaseline="middle">{compact(t)}</text>
            </g>
          ))}
          {xTicks.map(i => (
            <text key={i} x={x(i)} y={H - 6} className="ao-axis"
              textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}>{dayLabel(daily[i].date)}</text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="ao-cross" />}
          {SERIES.map(s => (
            <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {SERIES.map(s => last && (
            <circle key={s.key} cx={x(daily.length - 1)} cy={y(last[s.key])} r="4" fill={s.color} className="ao-dot" />
          ))}
          {showEnds && SERIES.map((s, i) => (
            <text key={s.key} x={x(daily.length - 1) + 9} y={endYs[i]} className="ao-end" dominantBaseline="middle">{num(last[s.key])}</text>
          ))}
          {h && SERIES.map(s => (
            <circle key={s.key} cx={x(hover)} cy={y(h[s.key])} r="4" fill={s.color} className="ao-dot" />
          ))}
        </svg>
        {h && (
          <div className="ao-tip" style={{ left: tipLeft }} role="status">
            <div className="ao-tip-date">{dayLabel(h.date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            {SERIES.map(s => (
              <div key={s.key} className="ao-tip-row"><i style={{ background: s.color }} /><b>{num(h[s.key])}</b><span>{s.label}</span></div>
            ))}
          </div>
        )}
      </div>
      <details className="ao-table">
        <summary>View as table</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th>{SERIES.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>
              {[...daily].reverse().map(d => (
                <tr key={d.date}><td>{dayLabel(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</td>{SERIES.map(s => <td key={s.key}>{num(d[s.key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

/* ─ Ranked bars with the figure beside each (meter list) ───── */
function MeterList({ rows, empty }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  const total = rows.reduce((a, r) => a + r.count, 0)
  if (!rows.length || !total) return <p className="ao-muted">{empty}</p>
  return (
    <ul className="ao-meters">
      {rows.map(r => (
        <li key={r.label} title={`${r.label}: ${num(r.count)} (${Math.round((r.count / total) * 100)}%)`}>
          <span className="ao-meter-name">{r.label}</span>
          <span className="ao-meter-bar" aria-hidden="true"><i style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="ao-meter-n">{num(r.count)}</span>
        </li>
      ))}
    </ul>
  )
}

function Recent({ title, link, rows, render, empty }) {
  return (
    <section className="ao-card">
      <header className="ao-card-hd">
        <h2>{title}</h2>
        <Link to={link.to} className="ao-link">{link.label} <IconArrow size={13} /></Link>
      </header>
      {rows.length ? <ul className="ao-list">{rows.map(render)}</ul> : <p className="ao-muted">{empty}</p>}
    </section>
  )
}

export function AdminOverview({ call }) {
  const [range, setRange] = useState(30)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setBusy(true); setError('')
    call(`/admin/overview?days=${range}`)
      .then(r => { if (alive) setData(r) })
      .catch(e => { if (alive) setError(e?.message || 'Could not load the overview.') })
      .finally(() => { if (alive) setBusy(false) })
    return () => { alive = false }
  }, [call, range, attempt])

  const types = useMemo(() => {
    const t = data?.users_by_type || {}
    return ['worker', 'employer', 'hirer', 'admin', 'none']
      .map(k => ({ label: TYPE_LABEL[k], count: Number(t[k] || 0) }))
      .filter(r => r.count > 0 || r.label !== TYPE_LABEL.none)
      .sort((a, b) => b.count - a.count)
  }, [data])
  const towns = useMemo(() => (data?.users_by_town || []).map(r => ({ label: r.town, count: r.count })), [data])

  const t = data?.totals || {}
  // labels follow the data on screen (not the button just pressed) so they never mismatch while loading
  const shown = data?.days || range
  const lastDay = data?.daily?.[data.daily.length - 1]?.date
  const rangeText = data && lastDay ? `${dayLabel(data.since)} – ${dayLabel(lastDay)}` : ''

  return (
    <div className="page-inner ao">
      <div className="ao-top">
        <div>
          <h1>Overview</h1>
          <p className="ao-muted">{rangeText ? `hanapbuhay activity · ${rangeText}` : 'hanapbuhay activity'}</p>
        </div>
        <div className="ao-range" role="group" aria-label="Time range">
          {RANGES.map(d => (
            <button key={d} type="button" aria-pressed={range === d} onClick={() => setRange(d)}>{d} days</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="ao-card ao-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-light btn-sm" onClick={() => setAttempt(n => n + 1)}>Retry</button>
        </div>
      )}

      {!data && busy && !error && (
        <BrandLoader compact label="Loading the overview…" />
      )}

      {data && (
        // refetch keeps the previous numbers on screen (dimmed) instead of flashing skeletons
        <div className="ao-body" style={{ opacity: busy ? 0.55 : 1 }} aria-busy={busy}>
          <div className="ao-stats">
            <Stat label="Users" value={compact(t.users)} note={`+${num(t.users_new)} in ${shown} days`} />
            <Stat label="Active jobs" value={compact(t.active_jobs)} note={`+${num(t.jobs_new)} posted in ${shown} days`} />
            <Stat label="Applications" value={compact(t.applications)} note={`+${num(t.applications_new)} · ${num(t.hired_new)} hired in ${shown} days`} />
            <Stat label="Revenue" value={peso(t.revenue)} note={`${peso(t.revenue_new)} in ${shown} days · ${num(t.active_subscribers)} active plans`} />
          </div>

          <div className="ao-grid-2">
            <section className="ao-card" aria-labelledby="ao-act">
              <header className="ao-card-hd">
                <h2 id="ao-act">Activity</h2>
                <span className="ao-muted">Per day, last {shown} days</span>
              </header>
              <ActivityChart daily={data.daily || []} days={shown} />
            </section>
            <Attention a={data.attention || {}} />
          </div>

          <div className="ao-grid-even">
            <section className="ao-card">
              <header className="ao-card-hd"><h2>Users by type</h2><span className="ao-muted">{num(types.reduce((a, r) => a + r.count, 0))} accounts</span></header>
              <MeterList rows={types} empty="No accounts yet." />
            </section>
            <section className="ao-card">
              <header className="ao-card-hd"><h2>Top towns</h2><span className="ao-muted">By users</span></header>
              <MeterList rows={towns} empty="No towns recorded yet." />
            </section>
          </div>

          <div className="ao-grid-even">
            <Recent title="Newest users" link={{ to: '/dashboard/users', label: 'All users' }} rows={data.recent_users || []} empty="No sign-ups yet."
              render={u => (
                <li key={u.id}>
                  <span className="ao-avatar" aria-hidden="true">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                  <span className="ao-list-main">
                    <b>{u.full_name || u.email}</b>
                    <span>{[TYPE_LABEL[u.account_type] ? TYPE_LABEL[u.account_type].replace(/s$/, '') : 'No type yet', u.location].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="ao-list-side">
                    {Number(u.is_active) !== 1 ? <span className="ao-tag off">Deactivated</span>
                      : Number(u.is_verified) === 1 ? <span className="ao-tag ok"><IconCheck size={11} /> Verified</span>
                      : <span className="ao-tag">Unverified</span>}
                    <small>{ago(u.created_at)}</small>
                  </span>
                </li>
              )} />
            <Recent title="Newest job posts" link={{ to: '/dashboard/jobs', label: 'Moderate jobs' }} rows={data.recent_jobs || []} empty="No job posts yet."
              render={j => (
                <li key={j.id}>
                  <span className="ao-list-main">
                    <b>{j.title}</b>
                    <span>{[j.company || j.employer_name, j.location].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="ao-list-side">
                    <span className={`ao-tag ${j.status === 'active' ? '' : 'off'}`}>{j.status === 'active' ? `${num(j.applicants)} applicant${Number(j.applicants) === 1 ? '' : 's'}` : j.status}</span>
                    <small>{ago(j.created_at)}</small>
                  </span>
                </li>
              )} />
          </div>
        </div>
      )}
    </div>
  )
}
