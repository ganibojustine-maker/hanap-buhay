/**
 * Admin pages for the public-ready platform: post moderation, the ID verification queue
 * and its decision history, gig disputes and contracts, the hiring pipeline monitor, and
 * PayMongo payments with refunds and re-checks.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import { IconCheck, IconX, IconEye, IconAlert, IconCard, IconBadge, IconFile } from '../../../components/icons.jsx'
import { STATUS, statusLabel, statusTone, CONTRACT, PAYMENT_STATUS } from '../../../utils/hiringStatus.js'
import { CATEGORIES } from '../../../utils/categories.js'
import { peso, phDate, phDateTime } from '../../../utils/format.js'
import { AdminVerification as BusinessAndCertificates } from '../AdminPages.jsx'
import '../../../styles/platform.css'

function useLoad(call, path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    call(path).then(setData).catch(e => { setError(e.message || 'We couldn’t load this page. Please try again.'); setData({}) })
  }, [call, path])
  useEffect(() => { load() }, [load])
  return [data, error, load]
}

/** A dialog that asks for a reason before an action. */
function ReasonDialog({ conf, onClose, busy }) {
  const [text, setText] = useState('')
  return (
    <Dialog tone={conf.tone || 'warn'} title={conf.title} onClose={onClose} busy={busy}
      actions={[{ label: busy ? 'Saving…' : conf.label, primary: true, onClick: () => conf.run(text) }, { label: 'Cancel', onClick: onClose }]}>
      {conf.error && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{conf.error}</div>}
      {conf.body && <p>{conf.body}</p>}
      {conf.field !== false && <label className="field"><span>{conf.field || 'Reason (the person will see this)'}</span><textarea className="pf-textarea" value={text} onChange={e => setText(e.target.value)} /></label>}
      {conf.extra}
    </Dialog>
  )
}

/* ─ Posts: approve, send back, take down ──────────────── */
export function AdminPosts({ call }) {
  const [data, error, load] = useLoad(call, '/admin/jobs')
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')

  async function moderate(j, action, note) {
    setBusy(true)
    try { await call(`/admin/jobs/${j.id}/moderate`, { method: 'PATCH', body: { action, note } }); setFlash(action === 'approve' ? `“${j.title}” is live.` : `“${j.title}” was sent back to the poster.`); setDlg(null); load() }
    catch (e) { setDlg(d => d ? { ...d, error: e.message } : null); if (action === 'approve') setFlash(e.message) } finally { setBusy(false) }
  }
  const all = data?.jobs || []
  const expired = j => j.expires_at && new Date(String(j.expires_at).replace(' ', 'T')) < new Date()
  const groups = {
    pending: all.filter(j => j.moderation_status === 'pending'),
    live: all.filter(j => j.status === 'active'),
    rejected: all.filter(j => j.moderation_status === 'rejected'),
    ended: all.filter(j => j.status === 'closed' && j.moderation_status === 'approved'),
    all,
  }
  const list = groups[tab].filter(j => !q || [j.title, j.employer_name, j.location].join(' ').toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="page-inner">
      {dlg && <ReasonDialog conf={dlg} onClose={() => setDlg(null)} busy={busy} />}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="pf-between" style={{ marginBottom: 14 }}>
        <div className="mc-chips" role="group" aria-label="Filter posts">
          {[['pending', 'Waiting for review'], ['live', 'Live'], ['rejected', 'Sent back'], ['ended', 'Closed or ended'], ['all', 'All']].map(([id, l]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{groups[id].length}</span></button>))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, poster or town" aria-label="Search posts" style={{ height: 38, borderRadius: 10, border: '1.5px solid var(--line)', padding: '0 12px', minWidth: 220 }} />
      </div>
      {!data ? <BrandLoader compact label="Loading posts…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconCheck size={36} /><h2>{tab === 'pending' ? 'Nothing waiting for review' : 'No posts here'}</h2><p>{tab === 'pending' ? 'New posts from unverified accounts will appear here.' : 'Try another filter.'}</p></div>
      ) : (
        <div className="pf-list">
          {list.map(j => (
            <article key={j.id} className="pf-card">
              <div className="pf-between">
                <h3><span className={`pf-type ${j.post_type === 'gig' ? 'gig' : 'job'}`}>{j.post_type === 'gig' ? 'Gig' : 'Job'}</span> {j.title}</h3>
                <span className={`chip ${j.moderation_status === 'pending' ? 'gold' : j.moderation_status === 'rejected' ? 'red' : j.status === 'active' ? 'green' : ''}`}>
                  {j.moderation_status === 'pending' ? 'Waiting for review' : j.moderation_status === 'rejected' ? 'Sent back' : j.status === 'active' ? 'Live' : expired(j) ? 'Ended' : 'Closed'}</span>
              </div>
              <p className="pf-meta">{[j.employer_name, CATEGORIES[j.category], [j.barangay, j.location].filter(Boolean).join(', '),
                (j.salary_min || j.salary_max) ? [j.salary_min, j.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–') : 'No pay given',
                `Posted ${phDate(j.created_at)}`, j.expires_at ? `ends ${phDate(j.expires_at)}` : null].filter(Boolean).join(' · ')}</p>
              {j.description && <p className="pf-small" style={{ margin: '6px 0 0', whiteSpace: 'pre-line' }}>{String(j.description).slice(0, 280)}{String(j.description).length > 280 ? '…' : ''}</p>}
              {j.moderation_note && <p className="pf-note warn" style={{ marginTop: 8 }}>Reason given: {j.moderation_note}</p>}
              <div className="pf-actions">
                {j.moderation_status !== 'approved' && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => moderate(j, 'approve')}><IconCheck size={13} /> Approve</button>}
                {j.moderation_status === 'pending' && <button type="button" className="btn btn-light btn-sm" onClick={() => setDlg({ title: `Send back “${j.title}”?`, label: 'Send back', body: 'The poster sees your reason and can edit the post to fix it.', run: n => moderate(j, 'reject', n) })}>Send back</button>}
                {j.status === 'active' && <button type="button" className="btn btn-light btn-sm" onClick={() => setDlg({ tone: 'danger', title: `Take down “${j.title}”?`, label: 'Take down', body: 'Use this for scams, fees asked from workers, fake or illegal posts.', run: n => moderate(j, 'take_down', n) })}><IconAlert size={13} /> Take down</button>}
                <Link to={`/dashboard/browse/${j.id}`} className="btn btn-light btn-sm"><IconEye size={13} /> View</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─ Verification: IDs, business documents, history ───── */
const ACTION = { submitted: 'Sent a document', approved: 'Approved', rejected: 'Not approved', resubmission_requested: 'Asked to send again', revoked: 'Badge removed' }

function IdQueue({ call }) {
  const [status, setStatus] = useState('pending')
  const [data, error, load] = useLoad(call, `/admin/verification?status=${status}`)
  const [view, setView] = useState(null)
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  async function decide(r, action, reason) {
    setBusy(true)
    try { await call(`/admin/verification/${r.id}`, { method: 'PATCH', body: { action, reason } }); setFlash(`${r.full_name}: ${action === 'approve' ? 'verified' : action === 'resubmit' ? 'asked to send again' : 'not approved'}.`); setDlg(null); setView(null); load() }
    catch (e) { setDlg(d => d ? { ...d, error: e.message } : null); setFlash(e.message) } finally { setBusy(false) }
  }
  async function open(r, part = 'id') {
    try { const f = await call(`/verification/requests/${r.id}/file${part === 'selfie' ? '?part=selfie' : ''}`); setView({ r, ...f, part }) } catch (e) { setFlash(e.message) }
  }
  const list = data?.requests || []
  const c = data?.counts || {}
  const chk = (ok, label) => <span className={`chip ${ok ? 'green' : 'red'}`}>{ok ? <IconCheck size={11} /> : <IconX size={11} />} {label}</span>
  return (
    <div>
      {dlg && <ReasonDialog conf={dlg} onClose={() => setDlg(null)} busy={busy} />}
      {view && (
        <Dialog tone="info" title={`${view.r.full_name}: ${view.r.id_label}`} onClose={() => setView(null)} busy={busy}
          actions={view.r.status === 'pending' ? [
            { label: 'Approve', primary: true, onClick: () => decide(view.r, 'approve') },
            { label: 'Ask to send again', onClick: () => setDlg({ title: 'Ask for a new photo', label: 'Send request', run: n => decide(view.r, 'resubmit', n) }) },
            { label: 'Reject', onClick: () => setDlg({ tone: 'danger', title: 'Reject this ID?', label: 'Reject', run: n => decide(view.r, 'reject', n) }) },
          ] : [{ label: 'Close', primary: true, onClick: () => setView(null) }]}>
          {String(view.file_mime).startsWith('image/') ? <img src={view.data_url} alt="Submitted document" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
            : <iframe title="Document" src={view.data_url} style={{ width: '100%', height: 420, border: 0 }} />}
          <dl className="pf-kv" style={{ marginTop: 10 }}>
            <dt>Name on ID</dt><dd>{view.r.name_on_id}</dd><dt>Account name</dt><dd>{view.r.full_name}</dd>
            <dt>ID number</dt><dd>{view.r.id_number}</dd><dt>Account</dt><dd>{view.r.account_type === 'hirer' ? 'Client' : 'Worker'} since {phDate(view.r.member_since)}</dd>
          </dl>
          {view.r.has_selfie && view.part !== 'selfie' && <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 10 }} onClick={() => open(view.r, 'selfie')}>See selfie</button>}
        </Dialog>
      )}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 12 }}>{flash}</div>}
      {error && <div className="pf-note bad" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="mc-chips" role="group" aria-label="Filter" style={{ marginBottom: 12 }}>
        {[['pending', 'To check'], ['resubmit', 'Asked to resend'], ['verified', 'Approved'], ['rejected', 'Rejected']].map(([id, l]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>{l} <span>{c[id] || 0}</span></button>))}
      </div>
      {!data ? <BrandLoader compact label="Loading IDs…" /> : data.enabled === false ? <p className="pf-muted">ID verification switches on after the database update (migration 021).</p>
        : list.length === 0 ? <div className="panel pf-empty"><IconBadge size={36} /><h2>{status === 'pending' ? 'No IDs to check' : 'Nothing here'}</h2><p>Workers and clients who send an ID appear here, oldest first.</p></div> : (
        <div className="pf-list">
          {list.map(r => (
            <article key={r.id} className="pf-card">
              <div className="pf-between"><h3>{r.full_name} <span className="pf-small">· {r.account_type === 'hirer' ? 'Client' : 'Worker'} · {r.location}</span></h3><span className="pf-small">Sent {phDateTime(r.created_at)}</span></div>
              <p className="pf-meta">{r.id_label} · {r.email}</p>
              <div className="pf-tags">{chk(r.checks.email_confirmed, 'Email confirmed')}{chk(r.checks.phone_confirmed, 'Phone confirmed')}{chk(r.checks.name_match, 'Name matches')}{chk(r.checks.id_unique, 'ID not used elsewhere')}{r.has_selfie && <span className="chip navy">Selfie sent</span>}</div>
              {r.reason && <p className="pf-small" style={{ marginTop: 6 }}>Reason given: {r.reason}{r.reviewer_name ? ` (${r.reviewer_name})` : ''}</p>}
              <div className="pf-actions"><button type="button" className="btn btn-navy btn-sm" onClick={() => open(r)}><IconFile size={13} /> {r.status === 'pending' ? 'Check ID' : 'View ID'}</button>
                {r.status === 'verified' && <button type="button" className="btn btn-light btn-sm" onClick={() => setDlg({ tone: 'danger', title: 'Remove the verified badge?', label: 'Remove badge', run: n => decide(r, 'revoke', n) })}>Remove badge</button>}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function DecisionLog({ call }) {
  const [data] = useLoad(call, '/admin/verification/log')
  return !data ? <BrandLoader compact label="Loading history…" /> : (data.history || []).length === 0 ? <p className="pf-muted">No decisions yet.</p> : (
    <section className="panel"><ol className="pf-timeline">{data.history.map((h, i) => (
      <li key={i} className={h.action === 'approved' ? 'good' : ['rejected', 'revoked'].includes(h.action) ? 'bad' : h.action === 'resubmission_requested' ? 'warn' : ''}>
        <b>{h.full_name}: {ACTION[h.action] || h.action}</b><small>{phDateTime(h.created_at)}{h.actor_name && h.action !== 'submitted' ? ` · by ${h.actor_name}` : ''} · {h.account_type === 'hirer' ? 'Client' : h.account_type === 'employer' ? 'Employer' : 'Worker'}</small>{h.reason && <p>{h.reason}</p>}</li>
    ))}</ol></section>
  )
}

export function AdminVerificationHub({ call }) {
  const [tab, setTab] = useState('ids')
  return (
    <div className="page-inner">
      <div className="pf-tabs" role="tablist">
        {[['ids', 'IDs (workers and clients)'], ['business', 'Business documents and certificates'], ['log', 'Decision history']].map(([id, l]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`btn btn-sm ${tab === id ? 'btn-navy' : 'btn-light'}`} onClick={() => setTab(id)}>{l}</button>))}
      </div>
      {tab === 'ids' && <IdQueue call={call} />}
      {tab === 'business' && <div style={{ margin: '0 -28px' }}><BusinessAndCertificates call={call} /></div>}
      {tab === 'log' && <DecisionLog call={call} />}
    </div>
  )
}

/* ─ Disputes ──────────────────────────────────────────── */
export function AdminDisputes({ call }) {
  const [status, setStatus] = useState('open')
  const [data, error, load] = useLoad(call, `/admin/disputes?status=${status}`)
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  async function resolve(d, resolution, note) {
    setBusy(true)
    try { await call(`/admin/disputes/${d.id}`, { method: 'PATCH', body: { resolution, note } }); setFlash('Dispute resolved. Both people were told.'); setDlg(null); load() }
    catch (e) { setDlg(x => x ? { ...x, error: e.message } : null) } finally { setBusy(false) }
  }
  const ask = (d, resolution, title) => setDlg({ title, label: 'Resolve', field: 'Decision (both people will see this)', run: n => resolve(d, resolution, n) })
  const list = data?.disputes || []
  return (
    <div className="page-inner">
      {dlg && <ReasonDialog conf={dlg} onClose={() => setDlg(null)} busy={busy} />}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="mc-chips" role="group" aria-label="Filter disputes" style={{ marginBottom: 14 }}>
        {[['open', 'Open'], ['resolved', 'Resolved']].map(([id, l]) => <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>{l}</button>)}
      </div>
      {!data ? <BrandLoader compact label="Loading disputes…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconCheck size={36} /><h2>{status === 'open' ? 'No open disputes' : 'No resolved disputes yet'}</h2><p>When a worker or client reports a problem on a contract, it appears here.</p></div>
      ) : (
        <div className="pf-list">{list.map(d => (
          <article key={d.id} className="pf-card">
            <div className="pf-between"><h3>{d.title}</h3><span className={`chip ${d.status === 'open' ? 'red' : 'green'}`}>{d.status === 'open' ? 'Open' : `Resolved: ${{ complete: 'marked complete', cancel: 'cancelled', resume: 'continued' }[d.resolution] || d.resolution}`}</span></div>
            <p className="pf-meta">Client {d.client_name} · Worker {d.worker_name} · {peso(d.agreed_amount)} · {PAYMENT_STATUS[d.payment_status]} · Opened by {d.opened_by_name} {phDateTime(d.created_at)}</p>
            <p className="pf-note warn" style={{ marginTop: 8 }}><b>{d.reason_text}:</b> {d.details}</p>
            {d.resolution_note && <p className="pf-small">Decision: {d.resolution_note}</p>}
            {d.status === 'open' && (
              <div className="pf-actions">
                <button type="button" className="btn btn-navy btn-sm" onClick={() => ask(d, 'complete', 'Mark the contract complete?')}>Mark complete</button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => ask(d, 'cancel', 'Cancel the contract?')}>Cancel contract</button>
                <button type="button" className="btn btn-light btn-sm" onClick={() => ask(d, 'resume', 'Let the contract continue?')}>Let it continue</button>
                <Link to={`/dashboard/admin/messages?to=${d.client_id}`} className="btn btn-light btn-sm">Message client</Link>
                <Link to={`/dashboard/admin/messages?to=${d.worker_id}`} className="btn btn-light btn-sm">Message worker</Link>
              </div>
            )}
          </article>
        ))}</div>
      )}
    </div>
  )
}

/* ─ Gig contracts monitor ─────────────────────────────── */
export function AdminGigContracts({ call }) {
  const [status, setStatus] = useState('')
  const [data, error] = useLoad(call, `/admin/contracts${status ? `?status=${status}` : ''}`)
  const c = data?.counts || {}
  return (
    <div className="page-inner">
      {error && <div className="pf-note bad" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="stat-grid">
        {[['Proposals sent', data?.proposals?.total], ['Hired from proposals', data?.proposals?.hired], ['In progress', (c.active || 0) + (c.delivered || 0) + (c.revision_requested || 0)], ['In dispute', c.disputed || 0]].map(([l, n]) => (
          <div key={l} className="stat-card"><span className="stat-card-val">{n ?? '–'}</span><span className="stat-card-label">{l}</span></div>))}
      </div>
      <div className="mc-chips" role="group" aria-label="Filter contracts" style={{ marginBottom: 14 }}>
        <button type="button" aria-pressed={!status} onClick={() => setStatus('')}>All</button>
        {Object.entries(CONTRACT).map(([k, v]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{v.label} <span>{c[k] || 0}</span></button>)}
      </div>
      {!data ? <BrandLoader compact label="Loading contracts…" /> : (data.contracts || []).length === 0 ? <div className="panel pf-empty"><p>No contracts here.</p></div> : (
        <section className="panel" style={{ overflowX: 'auto' }}>
          <table className="pf-table"><thead><tr><th>Contract</th><th>Client</th><th>Worker</th><th>Price</th><th>Status</th><th>Payment</th></tr></thead>
            <tbody>{data.contracts.map(k => (
              <tr key={k.id}><td><b>{k.title}</b><div className="pf-small">#{k.id} · started {phDate(k.started_at)}</div></td><td>{k.client_name}</td><td>{k.worker_name}</td>
                <td>{peso(k.agreed_amount)}</td><td><span className={`chip ${CONTRACT[k.status]?.tone || ''}`}>{CONTRACT[k.status]?.label}</span></td><td className="pf-small">{PAYMENT_STATUS[k.payment_status]}</td></tr>
            ))}</tbody></table>
        </section>
      )}
    </div>
  )
}

/* ─ Hiring pipeline monitor ───────────────────────────── */
export function AdminHiringMonitor({ call }) {
  const [status, setStatus] = useState('')
  const [data, error] = useLoad(call, `/admin/applications${status ? `?status=${status}` : ''}`)
  const c = data?.counts || {}
  return (
    <div className="page-inner">
      {error && <div className="pf-note bad" style={{ marginBottom: 14 }}>{error}</div>}
      {data?.stale > 0 && <div className="pf-note warn" style={{ marginBottom: 14 }}><b>{data.stale}</b> application{data.stale === 1 ? '' : 's'} have waited more than 14 days without a decision. Consider reminding those employers.</div>}
      <div className="mc-chips" role="group" aria-label="Filter by step" style={{ marginBottom: 14 }}>
        <button type="button" aria-pressed={!status} onClick={() => setStatus('')}>All</button>
        {Object.keys(STATUS).map(k => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{statusLabel(k)} <span>{c[k] || 0}</span></button>)}
      </div>
      {!data ? <BrandLoader compact label="Loading applications…" /> : (data.applications || []).length === 0 ? <div className="panel pf-empty"><p>No applications at this step.</p></div> : (
        <section className="panel" style={{ overflowX: 'auto' }}>
          <table className="pf-table"><thead><tr><th>Applicant</th><th>Job</th><th>Employer</th><th>Step</th><th>Match</th><th>In this step</th></tr></thead>
            <tbody>{data.applications.map(a => (
              <tr key={a.id}><td>{a.worker_name}</td><td><Link to={`/dashboard/browse/${a.job_id}`}>{a.job_title}</Link></td><td>{a.employer_name}</td>
                <td><span className={`chip ${statusTone(a.status)}`}>{statusLabel(a.status)}</span>{a.status === 'for_interview' && a.interview_date && <div className="pf-small">{phDateTime(a.interview_date)}</div>}</td>
                <td>{a.match_score}%</td><td className="pf-small">{a.days_in_step} day{Number(a.days_in_step) === 1 ? '' : 's'}</td></tr>
            ))}</tbody></table>
        </section>
      )}
    </div>
  )
}

/* ─ Payments ──────────────────────────────────────────── */
const PAY_TONE = { paid: 'green', pending: 'gold', failed: 'red', cancelled: '', expired: '', refunded: 'blue' }
export function AdminPaymentsPage({ call }) {
  const [filter, setFilter] = useState({ status: '', q: '', mode: '' })
  const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString()
  const [data, error, load] = useLoad(call, `/admin/payments${qs ? `?${qs}` : ''}`)
  const [dlg, setDlg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  async function reconcile() {
    setBusy(true)
    try { const r = await call('/admin/payments/reconcile', { method: 'POST' }); setFlash(r.message); load() } catch (e) { setFlash(e.message) } finally { setBusy(false) }
  }
  function refund(p) {
    let amount = String(p.amount)
    setDlg({ tone: 'danger', title: `Refund ${p.full_name}?`, label: 'Refund through PayMongo', field: 'Reason (the customer will see it)',
      body: `${p.plan_name}, paid ${peso(p.amount)} on ${phDate(p.paid_at)}. A full refund ends the plan it paid for.`,
      extra: <label className="field"><span>Amount to refund (₱)</span><div className="in no-icon"><input type="number" defaultValue={p.amount} max={p.amount} min={1} onChange={e => { amount = e.target.value }} /></div></label>,
      run: async reason => {
        setBusy(true)
        try { await call(`/admin/payments/${p.id}/refund`, { method: 'POST', body: { amount: Number(amount), reason } }); setFlash('Refund started. The status updates when PayMongo finishes it.'); setDlg(null); load() }
        catch (e) { setDlg(d => d ? { ...d, error: e.message } : null) } finally { setBusy(false) }
      } })
  }
  const s = data?.summary || {}
  const counts = s.counts || {}
  return (
    <div className="page-inner pf-stack">
      {dlg && <ReasonDialog conf={dlg} onClose={() => setDlg(null)} busy={busy} />}
      {flash && <div className="pf-note ok" role="status">{flash}</div>}
      {error && <div className="pf-note bad">{error}</div>}
      {data?.test_mode && <div className="pf-note warn"><span className="pf-test">Test mode</span> PayMongo is using test keys. These amounts are test payments, not real revenue.</div>}
      <div className="stat-grid">
        {[['Collected (all time)', peso(s.gross || 0)], ['This month', peso(s.this_month || 0)], ['Refunded', peso(s.refunded || 0)], ['Net after PayMongo fees and refunds', peso(s.net || 0)]].map(([l, v]) => (
          <div key={l} className="stat-card"><span className="stat-card-val" style={{ fontSize: 24 }}>{v}</span><span className="stat-card-label">{l}</span></div>))}
      </div>
      <div className="pf-grid2">
        <section className="panel"><h2 className="pf-h">By plan</h2>
          {(s.by_plan || []).length === 0 ? <p className="pf-muted">No paid plans yet.</p> : <table className="pf-table"><tbody>{s.by_plan.map(r => <tr key={r.plan_name}><td>{r.plan_name}</td><td>{r.n} paid</td><td><b>{peso(r.total)}</b></td></tr>)}</tbody></table>}</section>
        <section className="panel"><h2 className="pf-h">By payment method</h2>
          {(s.by_method || []).length === 0 ? <p className="pf-muted">No payments yet.</p> : <table className="pf-table"><tbody>{s.by_method.map(r => <tr key={r.method}><td>{r.label}</td><td>{r.n}</td><td><b>{peso(r.total)}</b></td></tr>)}</tbody></table>}
          <p className="pf-small">Active paid plans right now: <b>{s.active_paid_plans ?? 0}</b></p></section>
      </div>
      <section className="panel">
        <div className="pf-between" style={{ marginBottom: 12 }}>
          <h2 className="pf-h"><IconCard size={16} /> Transactions</h2>
          <button type="button" className="btn btn-navy btn-sm" disabled={busy} onClick={reconcile}>{busy ? 'Checking…' : 'Re-check pending payments with PayMongo'}</button>
        </div>
        <div className="pf-row" style={{ marginBottom: 12 }}>
          <div className="mc-chips" role="group" aria-label="Filter by status">
            {[['', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['failed', 'Failed'], ['expired', 'Expired'], ['cancelled', 'Cancelled'], ['refunds', 'Refunds']].map(([id, l]) => (
              <button key={id || 'all'} type="button" aria-pressed={filter.status === id} onClick={() => setFilter(f => ({ ...f, status: id }))}>{l}{id && id !== 'refunds' ? <span>{counts[id] || 0}</span> : null}</button>))}
          </div>
          <input value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} placeholder="Reference, receipt, name or email" aria-label="Search payments" style={{ height: 38, borderRadius: 10, border: '1.5px solid var(--line)', padding: '0 12px', minWidth: 220 }} />
          {data?.test_mode && <select value={filter.mode} onChange={e => setFilter(f => ({ ...f, mode: e.target.value }))} aria-label="Test or live" style={{ height: 38, borderRadius: 10, border: '1.5px solid var(--line)', padding: '0 10px' }}>
            <option value="">Test and live</option><option value="test">Test only</option><option value="live">Live only</option></select>}
        </div>
        {!data ? <BrandLoader compact label="Loading payments…" /> : (data.payments || []).length === 0 ? <p className="pf-muted">No payments match.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pf-table">
              <thead><tr><th>Date</th><th>Account</th><th>Plan</th><th>Amount</th><th>Status</th><th>Method</th><th></th></tr></thead>
              <tbody>{data.payments.map(p => (
                <tr key={p.id}>
                  <td>{phDateTime(p.paid_at || p.created_at)}<div className="pf-small">{p.reference}{p.receipt_no ? ` · ${p.receipt_no}` : ''}</div></td>
                  <td>{p.full_name}<div className="pf-small">{p.email} · {p.account_type === 'hirer' ? 'Client' : 'Employer'}</div></td>
                  <td>{p.plan_name}<div className="pf-small">{p.change_type}{p.is_test ? <> · <span className="pf-test">Test</span></> : ''}</div></td>
                  <td>{peso(p.amount)}{p.fee ? <div className="pf-small">fee {peso(p.fee)}</div> : null}</td>
                  <td><span className={`chip ${PAY_TONE[p.status] || ''}`}>{p.status_text}</span>
                    {p.failure_reason && <div className="pf-small">{p.failure_reason}</div>}
                    {p.refund_status && <div className="pf-small">Refund {p.refund_status === 'succeeded' ? 'done' : p.refund_status}: {peso(p.refunded_amount)}</div>}</td>
                  <td className="pf-small">{p.method_label || '–'}</td>
                  <td>{p.status === 'paid' && !p.refund_status && <button type="button" className="btn btn-light btn-sm" onClick={() => refund(p)}>Refund</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
