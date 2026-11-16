/**
 * Worker gig pages: find gigs, send proposals, do the work, get paid and reviewed.
 * These belong to the worker role only (clients have their own pages in client/).
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import UserAvatar from '../../../components/Avatar.jsx'
import { IconHandshake, IconCheck, IconMsgCircle, IconFile, IconAlert, IconPlus, IconEdit, IconTrash, IconPin, IconClock, IconSearch } from '../../../components/icons.jsx'
import { CONTRACT, PROPOSAL, PAYMENT_STATUS } from '../../../utils/hiringStatus.js'
import { CATEGORIES } from '../../../utils/categories.js'
import { peso, phDate, phDateTime } from '../../../utils/format.js'
import '../../../styles/platform.css'

const TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const MSG = '/dashboard/worker/messages'
const Verified = ({ on }) => (on ? <span className="pf-vbadge" title="Identity checked by our team"><IconCheck size={10} /> Verified</span> : null)
const level = s => (s >= 75 ? ['green', 'Strong match'] : s >= 50 ? ['gold', 'Good match'] : ['red', 'Low match'])

function useLoad(call, path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    if (!path) return
    setError('')
    call(path).then(setData).catch(e => { setError(e.message || 'We couldn’t load this page. Please try again.'); setData({}) })
  }, [call, path])
  useEffect(() => { load() }, [load])
  return [data, error, load]
}

/* ─ Send a proposal ───────────────────────────────────── */
export function ProposalDialog({ gig, call, onClose, onSent }) {
  const [bid, setBid] = useState(gig.salary_max || gig.salary_min || '')
  const [days, setDays] = useState(1)
  const [cover, setCover] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  async function send() {
    setErr(null); setBusy(true)
    try { await call(`/gigs/${gig.id}/proposals`, { method: 'POST', body: { bid_amount: Number(bid), delivery_days: Number(days), cover_letter: cover } }); onSent() }
    catch (e) { setErr({ text: e.message || 'We couldn’t send your proposal. Please try again.', missing: e.data?.missing, phone: /mobile number/.test(e.message || '') }) }
    finally { setBusy(false) }
  }
  return (
    <Dialog tone="info" title={`Send a proposal: ${gig.title}`} onClose={onClose} busy={busy}
      actions={[{ label: busy ? 'Sending…' : 'Send proposal', primary: true, onClick: send }, { label: 'Cancel', onClick: onClose }]}>
      <p className="pf-muted" style={{ marginTop: 0 }}>
        Budget: {[gig.salary_min, gig.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–') || 'not set'}{gig.location ? ` · ${gig.location}` : ''}. The client pays you directly when the work is done.
      </p>
      {err && (
        <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>
          {err.text}
          {err.missing?.length > 0 && <div className="pf-actions">{[...new Set(err.missing.map(m => m.where))].map(w => <Link key={w} to={w} className="btn btn-light btn-sm">{w.includes('passport') ? 'Open Skills Passport' : 'Open my profile'}</Link>)}</div>}
          {err.phone && <div className="pf-actions"><Link to="/dashboard/verification" className="btn btn-light btn-sm">Confirm my number</Link></div>}
        </div>
      )}
      <div className="pf-grid2">
        <label className="field"><span>Your price (₱)</span><div className="in no-icon"><input type="number" min={100} value={bid} onChange={e => setBid(e.target.value)} /></div></label>
        <label className="field"><span>Days you need</span><div className="in no-icon"><input type="number" min={1} max={365} value={days} onChange={e => setDays(e.target.value)} /></div></label>
      </div>
      <label className="field"><span>How you will do it</span>
        <textarea className="pf-textarea" value={cover} onChange={e => setCover(e.target.value)} placeholder="Your experience with this kind of work, what you will bring, and when you can start." /></label>
      <p className="pf-small">Never pay a client to get a gig. Report anyone who asks for a fee.</p>
    </Dialog>
  )
}

/* ─ Find gigs ─────────────────────────────────────────── */
export function WorkerGigBoard({ call }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [town, setTown] = useState('')
  const [data, setData] = useState(null)
  const [mine, , reloadMine] = useLoad(call, '/proposals/mine')
  const [open, setOpen] = useState(null)
  const [flash, setFlash] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ post_type: 'gig', q, category: cat, location: town, limit: 40, sort: 'match' }).filter(([, v]) => v))
      call(`/jobs?${qs}`).then(setData).catch(e => setData({ jobs: [], error: e.message }))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [call, q, cat, town])
  const sent = new Set((mine?.proposals || []).filter(p => p.status !== 'withdrawn').map(p => Number(p.gig_id)))
  const list = data?.jobs || []
  return (
    <div className="page-inner">
      {open && <ProposalDialog gig={open} call={call} onClose={() => setOpen(null)} onSent={() => { setOpen(null); setFlash('Proposal sent. We’ll tell you when the client answers.'); reloadMine() }} />}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      <div className="pf-browse-filters">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search gigs, like plumbing" aria-label="Search gigs" />
        <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town"><option value="">Any town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select>
        <Link to="/dashboard/gigs/services" className="btn btn-light" style={{ height: 44 }}><IconPlus size={14} /> List a service</Link>
      </div>
      {!data ? <BrandLoader compact label="Finding gigs…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconHandshake size={40} /><h2>No open gigs right now</h2>
          <p>{q || cat || town ? 'Try another word, kind of work or town.' : 'New gigs are posted every day. List your own service so clients can book you directly.'}</p>
          <Link to="/dashboard/gigs/services" className="btn btn-primary">List a service</Link></div>
      ) : (
        <div className="pf-list">
          {list.map(g => {
            const m = g.match || {}
            const [tone, label] = level(m.score ?? 0)
            const gap = (m.gaps || [])[0]
            return (
              <article key={g.id} className="pf-card">
                <div className="pf-between">
                  <h3><Link to={`/dashboard/browse/${g.id}`}>{g.title}</Link></h3>
                  <span className={`chip ${tone}`}>{m.score ?? 0}% · {label}</span>
                </div>
                <p className="pf-meta">
                  <span className="pf-type gig">Gig</span>{' '}
                  {[g.employer_name, [g.barangay, g.location].filter(Boolean).join(', '),
                    (g.salary_min || g.salary_max) ? `Budget ${[g.salary_min, g.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–')}` : null,
                    g.duration, g.needed_by ? `Needed by ${phDate(g.needed_by)}` : null, `Posted ${phDate(g.created_at)}`].filter(Boolean).join(' · ')}
                  {' '}<Verified on={Number(g.employer_verified) === 1} />{Number(g.is_urgent) === 1 && <span className="chip red" style={{ marginLeft: 6 }}>Urgent</span>}
                </p>
                {gap && <p className="pf-small" style={{ margin: '6px 0 0' }}>Missing: {(m.gaps || []).slice(0, 2).map(x => x.name).join(', ')}</p>}
                <div className="pf-actions">
                  {sent.has(Number(g.id))
                    ? <Link to="/dashboard/gigs/proposals" className="btn btn-light btn-sm"><IconCheck size={13} /> Proposal sent</Link>
                    : <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(g)}>Send proposal</button>}
                  <Link to={`/dashboard/browse/${g.id}`} className="btn btn-light btn-sm">View details</Link>
                  <Link to={`${MSG}?to=${g.employer_id}`} className="btn btn-light btn-sm" aria-label="Message the client"><IconMsgCircle size={13} /></Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─ My proposals ──────────────────────────────────────── */
export function WorkerProposals({ call }) {
  const [data, error, load] = useLoad(call, '/proposals/mine')
  const [flash, setFlash] = useState('')
  const all = data?.proposals || []
  async function withdraw(p) {
    try { await call(`/proposals/${p.id}/withdraw`, { method: 'POST' }); setFlash('Proposal withdrawn.'); load() } catch (e) { setFlash(e.message) }
  }
  return (
    <div className="page-inner">
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {!data ? <BrandLoader compact label="Loading your proposals…" /> : all.length === 0 ? (
        <div className="panel pf-empty"><IconFile size={40} /><h2>No proposals yet</h2><p>Find a gig you can do and send the client your price and timeline.</p>
          <Link to="/dashboard/gigs" className="btn btn-primary"><IconSearch size={14} /> Find gigs</Link></div>
      ) : (
        <div className="pf-list">
          {all.map(p => (
            <article key={p.id} className="pf-card">
              <div className="pf-between"><h3><Link to={`/dashboard/browse/${p.gig_id}`}>{p.gig_title}</Link></h3><span className={`chip ${PROPOSAL[p.status]?.tone || ''}`}>{PROPOSAL[p.status]?.label}</span></div>
              <p className="pf-meta">{p.client_name} <Verified on={Number(p.client_verified) === 1} /> · Your price {peso(p.bid_amount)} · {p.delivery_days} day{Number(p.delivery_days) === 1 ? '' : 's'} · Sent {phDate(p.created_at)}</p>
              <p className="pf-small" style={{ margin: '6px 0 0' }}>{p.status_text}{p.client_note ? ` · Client’s note: ${p.client_note}` : ''}</p>
              <div className="pf-actions">
                {p.contract_id && <Link to={`/dashboard/gigs/contracts/${p.contract_id}`} className="btn btn-navy btn-sm">Open contract</Link>}
                {['submitted', 'shortlisted'].includes(p.status) && <button type="button" className="btn btn-light btn-sm" onClick={() => withdraw(p)}>Withdraw</button>}
                <Link to={`${MSG}?to=${p.client_id}`} className="btn btn-light btn-sm"><IconMsgCircle size={13} /> Message</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─ Contracts ─────────────────────────────────────────── */
export function WorkerContracts({ call }) {
  const [data, error] = useLoad(call, '/contracts')
  const all = data?.contracts || []
  return (
    <div className="page-inner">
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {!data ? <BrandLoader compact label="Loading contracts…" /> : all.length === 0 ? (
        <div className="panel pf-empty"><IconHandshake size={40} /><h2>No contracts yet</h2><p>A contract starts when a client hires you from a proposal or books one of your services.</p>
          <Link to="/dashboard/gigs" className="btn btn-primary">Find gigs</Link></div>
      ) : (
        <div className="pf-list">
          {all.map(c => (
            <Link key={c.id} to={`/dashboard/gigs/contracts/${c.id}`} className="pf-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="pf-between"><h3>{c.title}</h3><span className={`chip ${CONTRACT[c.status]?.tone || ''}`}>{CONTRACT[c.status]?.label}</span></div>
              <p className="pf-meta">{c.client_name} · {peso(c.agreed_amount)} · Due {phDate(c.due_date)} · {PAYMENT_STATUS[c.payment_status]}</p>
              <p className="pf-small" style={{ margin: '6px 0 0' }}>{c.status === 'offered' ? 'New booking: accept or decline it.' : c.status === 'revision_requested' ? 'The client asked for changes.' : c.status_text}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const EVENT_TEXT = {
  started: 'Contract started', booked: 'Client booked your service', accepted: 'You accepted the booking', declined: 'You declined the booking',
  delivered: 'Work delivered', milestone_submitted: 'Milestone delivered', milestone_approved: 'Milestone approved', milestone_added: 'Milestone added',
  revision_requested: 'Client asked for changes', completed: 'Client approved the work', payment_sent: 'Client marked it paid', payment_confirmed: 'You confirmed the payment',
  cancelled: 'Contract cancelled', dispute_opened: 'Dispute opened', dispute_resolved: 'Dispute resolved by our team', reviewed: 'Review left',
}

export function WorkerContract({ call }) {
  const { id } = useParams()
  const [data, error, load] = useLoad(call, `/contracts/${id}`)
  const [dialog, setDialog] = useState(null)
  const [text, setText] = useState('')
  const [extra, setExtra] = useState({})
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [rating, setRating] = useState(0)
  const close = () => { setDialog(null); setText(''); setExtra({}); setFile(null) }

  async function post(path, body, ok) {
    setBusy(true)
    try { const r = await call(`/contracts/${id}${path}`, { method: 'POST', body }); setFlash(ok || r?.message || 'Done.'); close(); load() }
    catch (e) { setDialog(d => ({ ...(d || {}), error: e.message || 'That didn’t work. Please try again.' })) } finally { setBusy(false) }
  }
  function deliver() {
    const fd = new FormData()
    fd.append('note', text)
    if (extra.milestone) fd.append('milestone_id', extra.milestone)
    if (file) fd.append('file', file)
    return post('/deliver', fd)
  }

  if (!data) return <div className="page-inner"><BrandLoader compact label="Opening the contract…" /></div>
  if (error || !data.contract) return <div className="page-inner"><div className="panel pf-empty"><h2>We couldn’t open this contract</h2><p>{error}</p><Link to="/dashboard/gigs/contracts" className="btn btn-light">Back to contracts</Link></div></div>
  const c = data.contract, cl = data.client || {}, ms = data.milestones || []
  const openMs = ms.filter(m => ['pending', 'in_progress', 'revision'].includes(m.status))
  const canDeliver = ['active', 'revision_requested'].includes(c.status)

  const ask = kind => setDialog({
    deliver: { title: 'Deliver the work', tone: 'info', label: 'Deliver', field: 'What did you do? Add a photo of the finished work if you can.', deliver: true, run: deliver },
    cancel: { title: 'Cancel this contract?', tone: 'danger', label: 'Cancel contract', field: 'Why are you cancelling?', run: () => post('/cancel', { reason: text }) },
    dispute: { title: 'Ask our team to help', tone: 'warn', label: 'Open dispute', field: 'What happened? Include dates and what was agreed.', reason: true, run: () => post('/dispute', { reason: extra.reason, details: text }) },
    decline: { title: 'Decline this booking?', tone: 'danger', label: 'Decline', run: () => post('/respond', { action: 'decline' }, 'Booking declined.') },
  }[kind])

  return (
    <div className="page-inner pf-stack">
      {dialog && (
        <Dialog tone={dialog.tone} title={dialog.title} onClose={close} busy={busy}
          actions={[{ label: busy ? 'Saving…' : dialog.label, primary: true, onClick: dialog.run }, { label: 'Close', onClick: close }]}>
          {dialog.error && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{dialog.error}</div>}
          {dialog.reason && (
            <label className="field"><span>What went wrong?</span><div className="in no-icon"><select value={extra.reason || ''} onChange={e => setExtra(x => ({ ...x, reason: e.target.value }))}>
              <option value="">Choose one</option>{Object.entries(data.dispute_reasons || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
          )}
          {dialog.deliver && openMs.length > 0 && (
            <label className="field"><span>Which part are you delivering?</span><div className="in no-icon"><select value={extra.milestone || ''} onChange={e => setExtra(x => ({ ...x, milestone: e.target.value }))}>
              <option value="">The whole job</option>{openMs.map(m => <option key={m.id} value={m.id}>{m.title} ({peso(m.amount)})</option>)}</select></div></label>
          )}
          {dialog.field && <label className="field"><span>{dialog.field}</span><textarea className="pf-textarea" value={text} onChange={e => setText(e.target.value)} /></label>}
          {dialog.deliver && <label className="field"><span>Photo or PDF <em>optional, up to 5 MB</em></span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label>}
        </Dialog>
      )}
      <Link to="/dashboard/gigs/contracts" className="pf-small">← All contracts</Link>
      {flash && <div className="pf-note ok" role="status">{flash}</div>}
      <section className="panel">
        <div className="pf-between">
          <div><h1 className="pf-h" style={{ fontSize: 22 }}>{c.title}</h1><p className="pf-meta">Contract #{c.id} · Due {phDate(c.due_date)}</p></div>
          <span className={`chip ${CONTRACT[c.status]?.tone || ''}`} style={{ fontSize: 13 }}>{CONTRACT[c.status]?.label}</span>
        </div>
        <p className="pf-note" style={{ marginTop: 12 }}>{c.status === 'offered' ? 'This client wants to book your service. Accept it to start, or decline it.' : c.status_text}</p>
        <div className="pf-grid2" style={{ marginTop: 14 }}>
          <dl className="pf-kv">
            <dt>Price</dt><dd>{peso(c.agreed_amount)}</dd>
            <dt>Payment</dt><dd>{PAYMENT_STATUS[c.payment_status]}{c.payment_method ? ` (${data.pay_methods?.[c.payment_method]})` : ''}</dd>
            <dt>Changes</dt><dd>{c.revisions_used} of {c.revisions_allowed} used</dd>
          </dl>
          <div className="pf-person"><UserAvatar user={cl} size={44} />
            <span><b>{cl.full_name}</b> <Verified on={Number(cl.is_verified) === 1} /><span className="pf-small" style={{ display: 'block' }}>{cl.location}</span>
              <span className="pf-row" style={{ marginTop: 6 }}><Link to={`${MSG}?to=${cl.id}`} className="btn btn-light btn-sm"><IconMsgCircle size={13} /> Message</Link></span></span></div>
        </div>
        {c.scope && <><h3 style={{ fontSize: 14, margin: '16px 0 4px' }}>What was agreed</h3><p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>{c.scope}</p></>}
        <div className="pf-actions">
          {c.status === 'offered' && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => post('/respond', { action: 'accept' }, 'Booking accepted. Message the client to agree on the schedule.')}><IconCheck size={14} /> Accept booking</button>}
          {c.status === 'offered' && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('decline')}>Decline</button>}
          {canDeliver && <button type="button" className="btn btn-primary btn-sm" onClick={() => ask('deliver')}>Deliver work</button>}
          {c.payment_status === 'sent' && <button type="button" className="btn btn-navy btn-sm" disabled={busy} onClick={() => post('/confirm-payment', {}, 'Thanks! The payment is confirmed.')}><IconCheck size={14} /> I received the payment</button>}
          {c.status === 'active' && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('cancel')}>Cancel</button>}
          {!['offered', 'cancelled', 'disputed'].includes(c.status) && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('dispute')}><IconAlert size={13} /> Report a problem</button>}
        </div>
      </section>
      {data.dispute && (
        <section className={`pf-note ${data.dispute.status === 'open' ? 'warn' : 'info'}`}>
          <b>{data.dispute.status === 'open' ? 'Our team is reviewing a dispute' : 'Dispute resolved'}:</b> {data.dispute.reason_text}.{data.dispute.resolution_note ? ` Decision: ${data.dispute.resolution_note}` : ' We usually reply within 2 working days.'}
        </section>
      )}
      <div className="pf-grid2">
        <section className="panel">
          <h2 className="pf-h">Milestones</h2>
          {ms.length === 0 ? <p className="pf-muted">Paid as one job.</p> : (
            <ul className="pf-ms">{ms.map(m => (
              <li key={m.id}><span><b>{m.title}</b><span className="pf-small" style={{ display: 'block' }}>{peso(m.amount)}{m.due_date ? ` · due ${phDate(m.due_date)}` : ''}</span></span>
                <span className={`chip ${m.status === 'approved' ? 'green' : m.status === 'revision' ? 'gold' : ''}`}>{{ pending: 'Not started', in_progress: 'In progress', submitted: 'Delivered', revision: 'Changes asked', approved: 'Approved' }[m.status]}</span></li>
            ))}</ul>
          )}
        </section>
        <section className="panel">
          <h2 className="pf-h">What happened</h2>
          <ol className="pf-timeline">{(data.events || []).map(ev => (
            <li key={ev.id} className={['completed', 'payment_confirmed', 'milestone_approved'].includes(ev.event) ? 'good' : ev.event === 'revision_requested' ? 'warn' : ['cancelled', 'dispute_opened'].includes(ev.event) ? 'bad' : ''}>
              <b>{EVENT_TEXT[ev.event] || ev.event}</b><small>{ev.actor_name ? `${ev.actor_name} · ` : ''}{phDateTime(ev.created_at)}</small>{ev.note && <p>{ev.note}</p>}</li>
          ))}</ol>
        </section>
      </div>
      {c.status === 'completed' && (
        <section className="panel">
          <h2 className="pf-h">{data.my_review ? 'Your review of the client' : `Rate ${cl.full_name}`}</h2>
          {data.my_review ? <p className="pf-muted">You gave {data.my_review.rating} star{data.my_review.rating > 1 ? 's' : ''}.</p> : (
            <>
              <div className="pf-row">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`} style={{ background: 'none', border: 0, fontSize: 26, cursor: 'pointer', color: n <= rating ? 'var(--gold)' : 'var(--line)' }}>★</button>)}</div>
              <textarea className="pf-textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Was the client clear and fair? Did they pay on time?" />
              <div className="pf-actions"><button type="button" className="btn btn-navy btn-sm" disabled={!rating || busy} onClick={() => post('/review', { rating, comment: text }, 'Thanks for your review.')}>Post review</button></div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

/* ─ My services (listings clients can book) ───────────── */
const EMPTY_SVC = { title: '', category: '', price: '', price_unit: 'job', delivery_days: 1, service_area: [], description: '', status: 'active' }
export function WorkerServices({ call, user }) {
  const [data, error, load] = useLoad(call, '/services/mine')
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState('')
  async function save(e) {
    e.preventDefault(); setErr('')
    try {
      await call(form.id ? `/services/${form.id}` : '/services', { method: form.id ? 'PUT' : 'POST', body: form })
      setForm(null); setFlash('Service saved. Clients can now book it in Find Talent.'); load()
    } catch (e2) { setErr(e2.message || 'We couldn’t save your service. Please try again.') }
  }
  async function remove(s) { await call(`/services/${s.id}`, { method: 'DELETE' }).catch(() => {}); setFlash('Service removed.'); load() }
  const list = data?.services || []
  const toggleTown = t => setForm(f => ({ ...f, service_area: f.service_area.includes(t) ? f.service_area.filter(x => x !== t) : [...f.service_area, t] }))
  return (
    <div className="page-inner">
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {form ? (
        <form onSubmit={save} className="panel">
          <h2 className="pf-h">{form.id ? 'Edit service' : 'List a service'}</h2>
          <p className="pf-sub">A fixed-price service clients can book directly, like “Aircon cleaning, ₱800 per unit”.</p>
          {err && <div className="pf-note bad" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
          <label className="field"><span>Service name *</span><div className="in no-icon"><input required minLength={4} maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Aircon cleaning (split or window type)" /></div></label>
          <div className="pf-grid2">
            <label className="field"><span>Kind of work</span><div className="in no-icon"><select value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Choose one</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
            <label className="field"><span>Usual time to finish (days)</span><div className="in no-icon"><input type="number" min={1} max={60} value={form.delivery_days} onChange={e => setForm({ ...form, delivery_days: e.target.value })} /></div></label>
            <label className="field"><span>Price (₱) *</span><div className="in no-icon"><input required type="number" min={100} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div></label>
            <label className="field"><span>Price is</span><div className="in no-icon"><select value={form.price_unit} onChange={e => setForm({ ...form, price_unit: e.target.value })}><option value="job">Per job</option><option value="hour">Per hour</option><option value="day">Per day</option></select></div></label>
          </div>
          <div className="field"><span>Towns you serve</span>
            <div className="pf-row">{TOWNS.map(t => <button key={t} type="button" className={`chip ${form.service_area.includes(t) ? 'navy' : ''}`} style={{ cursor: 'pointer', border: 0 }} aria-pressed={form.service_area.includes(t)} onClick={() => toggleTown(t)}>{t}</button>)}</div></div>
          <label className="field"><span>What’s included</span><textarea className="pf-textarea" maxLength={2000} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What you do, what you bring, and what the client should prepare." /></label>
          <label className="pf-row" style={{ fontSize: 14, marginBottom: 14 }}><input type="checkbox" checked={form.status === 'paused'} onChange={e => setForm({ ...form, status: e.target.checked ? 'paused' : 'active' })} /> Pause bookings for now</label>
          <div className="pf-actions"><button type="submit" className="btn btn-primary">Save service</button><button type="button" className="btn btn-light" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      ) : !data ? <BrandLoader compact label="Loading your services…" /> : (
        <>
          <div className="pf-between" style={{ marginBottom: 14 }}>
            <p className="pf-muted" style={{ margin: 0 }}>Clients can find these in Find Talent and book you directly.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ ...EMPTY_SVC, service_area: user?.location ? [user.location] : [] })}><IconPlus size={14} /> List a service</button>
          </div>
          {list.length === 0 ? (
            <div className="panel pf-empty"><IconHandshake size={40} /><h2>No services listed yet</h2><p>List what you offer with a clear price. Clients nearby can book you without posting a gig.</p></div>
          ) : (
            <div className="pf-list">{list.map(s => (
              <article key={s.id} className="pf-card">
                <div className="pf-between"><h3>{s.title}</h3><span className={`chip ${s.status === 'active' ? 'green' : ''}`}>{s.status === 'active' ? 'Bookable' : 'Paused'}</span></div>
                <p className="pf-meta">{peso(s.price, { cents: false })} per {s.price_unit} · <IconClock size={12} /> about {s.delivery_days} day{Number(s.delivery_days) === 1 ? '' : 's'} · <IconPin size={12} /> {s.service_area || 'Your town'}</p>
                <div className="pf-actions">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setForm({ ...s, service_area: String(s.service_area || '').split(',').map(x => x.trim()).filter(Boolean) })}><IconEdit size={13} /> Edit</button>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => remove(s)}><IconTrash size={13} /> Remove</button>
                </div>
              </article>
            ))}</div>
          )}
        </>
      )}
    </div>
  )
}
