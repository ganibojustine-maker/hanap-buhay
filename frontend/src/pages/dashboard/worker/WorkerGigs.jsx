/**
 * Worker gig pages: find gigs, send proposals, do the work, get paid and reviewed, and sell
 * your own services. These belong to the worker role only (clients have theirs in client/).
 *
 *   Find gigs      photo cards of open gigs, best match first; invitations from clients on top
 *   My proposals   every proposal and where it stands
 *   Contracts      work in progress, delivery, payment and reviews
 *   My services    listings clients can book directly: photos, packages, what's included
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import UserAvatar from '../../../components/Avatar.jsx'
import PhotoManager from '../../../components/PhotoManager.jsx'
import ServiceCard from '../../../components/ServiceCard.jsx'
import { usePaged, Pager, ListTools, SORT } from '../../../components/Pager.jsx'
import { IconHandshake, IconCheck, IconMsgCircle, IconFile, IconAlert, IconPlus, IconEdit, IconTrash, IconPin, IconSearch, IconEye, IconBell } from '../../../components/icons.jsx'
import { CONTRACT, PROPOSAL, PAYMENT_STATUS } from '../../../utils/hiringStatus.js'
import { CATEGORIES } from '../../../utils/categories.js'
import { getJobImage } from '../../../utils/jobImages.js'
import { apiUrl, uploadPhotos } from '../../../utils/photos.js'
import { peso, phDate, phDateTime } from '../../../utils/format.js'
import '../../../styles/platform.css'

const TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const MSG = '/dashboard/worker/messages'
const Verified = ({ on }) => (on ? <span className="pf-vbadge" title="Identity checked by our team"><IconCheck size={10} /> Verified</span> : null)
const level = s => (s >= 75 ? ['green', 'Strong match'] : s >= 50 ? ['gold', 'Good match'] : ['red', 'Low match'])
const budget = g => [g.salary_min, g.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–')
const BASIS = { fixed: 'for the job', day: 'per day', hour: 'per hour', month: 'per month' }

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
/**
 * What a client compares: the price, the days, how the worker will do it, when they can
 * start, and photos of similar work they did before (from their Skills Passport gallery).
 */
export function ProposalDialog({ gig, call, onClose, onSent }) {
  const [bid, setBid] = useState(gig.salary_max || gig.salary_min || '')
  const [days, setDays] = useState(1)
  const [from, setFrom] = useState('')
  const [cover, setCover] = useState('')
  const [work, setWork] = useState(null)
  const [picked, setPicked] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { call('/portfolio').then(r => setWork(r.items || [])).catch(() => setWork([])) }, [call])
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length >= 4 ? p : [...p, id]))
  const low = Number(gig.salary_min || 0), high = Number(gig.salary_max || 0)
  const priceNote = !bid ? '' : high && Number(bid) > high * 1.25 ? 'Your price is well above the client’s budget. Explain why in your message.'
    : low && Number(bid) < low * 0.6 ? 'Your price is far below the budget. Make sure it still covers your materials and fare.' : ''

  async function send() {
    setErr(null); setBusy(true)
    try {
      await call(`/gigs/${gig.id}/proposals`, { method: 'POST', body: { bid_amount: Number(bid), delivery_days: Number(days), cover_letter: cover, work_ids: picked, available_from: from } })
      onSent()
    } catch (e) { setErr({ text: e.message || 'We couldn’t send your proposal. Please try again.', missing: e.data?.missing, phone: /mobile number/.test(e.message || '') }) }
    finally { setBusy(false) }
  }
  return (
    <Dialog tone="info" title={`Send a proposal: ${gig.title}`} onClose={onClose} busy={busy}
      actions={[{ label: busy ? 'Sending…' : 'Send proposal', primary: true, onClick: send }, { label: 'Cancel', onClick: onClose }]}>
      <p className="pf-muted" style={{ marginTop: 0 }}>
        Client’s budget: <b>{budget(gig) || 'not set'}</b> {BASIS[gig.pay_basis] || ''}{gig.location ? ` · ${gig.location}` : ''}{gig.needed_by ? ` · needed by ${phDate(gig.needed_by)}` : ''}. The client pays you directly when the work is done.
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
      {priceNote && <p className="pf-small" style={{ margin: '-4px 0 10px', color: 'var(--amber)' }}>{priceNote}</p>}
      <label className="field"><span>You can start on <em>optional</em></span><div className="in no-icon"><input type="date" min={new Date().toISOString().slice(0, 10)} value={from} onChange={e => setFrom(e.target.value)} /></div></label>
      <label className="field"><span>How you will do it <em>{cover.length}/2000</em></span>
        <textarea className="pf-textarea" maxLength={2000} value={cover} onChange={e => setCover(e.target.value)} placeholder={'1. Your experience with this kind of work\n2. How you will do it, and what materials you bring\n3. When you can start and finish'} /></label>
      <div className="field"><span>Show similar work you did <em>up to 4 photos</em></span>
        {work === null ? <p className="pf-small">Loading your work photos…</p> : work.length === 0 ? (
          <p className="pf-small" style={{ margin: 0 }}>Proposals with photos of past work get picked more often. <Link to="/dashboard/passport/work">Add work photos</Link> to your Skills Passport.</p>
        ) : (
          <div className="pp-work">{work.map(w => (
            <button key={w.id} type="button" className={`pp-work-item${picked.includes(w.id) ? ' on' : ''}`} onClick={() => toggle(w.id)} aria-pressed={picked.includes(w.id)} title={w.title}>
              <img src={apiUrl(w.url)} alt="" loading="lazy" />
              {picked.includes(w.id) && <span className="pp-tick"><IconCheck size={12} /></span>}
              <small>{w.title}</small>
            </button>
          ))}</div>
        )}
      </div>
      <p className="pf-small">Never pay a client to get a gig. Report anyone who asks for a fee.</p>
    </Dialog>
  )
}

/* ─ Find gigs ─────────────────────────────────────────── */
function GigTile({ g, sent, onPropose }) {
  const m = g.match || {}
  const [tone, label] = level(m.score ?? 0)
  return (
    <article className="pf-post has-cover">
      <Link to={`/dashboard/browse/${g.id}`} className="pf-cover" tabIndex={-1} aria-hidden="true">
        <img src={getJobImage(g)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
        <span className="pf-type gig">Gig</span>
        {Number(g.is_urgent) === 1 && <span className="pf-urgent">Urgent</span>}
        {m.score != null && <span className={`pf-score chip ${tone}`}>{m.score}% · {label}</span>}
      </Link>
      <div className="pf-post-body">
        <h3><Link to={`/dashboard/browse/${g.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{g.title}</Link></h3>
        <p className="pf-small" style={{ margin: 0 }}>{g.employer_name} <Verified on={Number(g.employer_verified) === 1} /></p>
        <p className="pf-small" style={{ margin: 0 }}><IconPin size={12} /> {[g.barangay, g.location].filter(Boolean).join(', ') || 'Oriental Mindoro'}{g.duration ? ` · ${g.duration}` : ''}</p>
        <div className="pf-between">
          <span className="pf-pay">{budget(g) ? `${budget(g)} ${BASIS[g.pay_basis] || ''}` : 'Price to discuss'}</span>
          <span className="pf-small">{g.needed_by ? `By ${phDate(g.needed_by)}` : phDate(g.created_at)}</span>
        </div>
        {(m.gaps || []).length > 0 && <p className="pf-small" style={{ margin: 0 }}>Missing: {m.gaps.slice(0, 2).map(x => x.name).join(', ')}</p>}
        <div className="pf-actions" style={{ marginTop: 'auto' }}>
          {sent
            ? <Link to="/dashboard/gigs/proposals" className="btn btn-light btn-sm"><IconCheck size={13} /> Proposal sent</Link>
            : <button type="button" className="btn btn-primary btn-sm" onClick={() => onPropose(g)}>Send proposal</button>}
          <Link to={`/dashboard/browse/${g.id}`} className="btn btn-light btn-sm">Details</Link>
          <Link to={`${MSG}?to=${g.employer_id}`} className="btn btn-light btn-sm" aria-label="Message the client"><IconMsgCircle size={13} /></Link>
        </div>
      </div>
    </article>
  )
}

export function WorkerGigBoard({ call }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [town, setTown] = useState('')
  const [sort, setSort] = useState('match')
  const [urgent, setUrgent] = useState(false)
  const [data, setData] = useState(null)
  const [mine, , reloadMine] = useLoad(call, '/proposals/mine')
  const [inv, , reloadInv] = useLoad(call, '/gigs/invites')
  const [open, setOpen] = useState(null)
  const [flash, setFlash] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ post_type: 'gig', q, category: cat, location: town, limit: 50, sort: sort === 'budget' ? 'salary' : sort }).filter(([, v]) => v))
      call(`/jobs?${qs}`).then(setData).catch(e => setData({ jobs: [], error: e.message }))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [call, q, cat, town, sort])
  const sent = new Set((mine?.proposals || []).filter(p => p.status !== 'withdrawn').map(p => Number(p.gig_id)))
  const list = useMemo(() => (data?.jobs || []).filter(g => !urgent || Number(g.is_urgent) === 1), [data, urgent])
  const invites = (inv?.invites || []).filter(i => !i.proposal_status)
  const open1 = g => setOpen(g)
  const pg = usePaged(list, { perPage: 12 })
  return (
    <div className="page-inner">
      {open && <ProposalDialog gig={open} call={call} onClose={() => setOpen(null)} onSent={() => { setOpen(null); setFlash('Proposal sent. We’ll tell you when the client answers.'); reloadMine(); reloadInv() }} />}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}

      {invites.length > 0 && (
        <section className="panel gig-invites" style={{ marginBottom: 16 }}>
          <h2 className="pf-h"><IconBell size={16} /> Clients invited you ({invites.length})</h2>
          <div className="gig-inv-list">{invites.map(i => (
            <div key={i.id} className="gig-inv">
              <img src={getJobImage({ id: i.gig_id, title: i.title, category: i.category, image_v: i.image_v })} alt="" />
              <div style={{ minWidth: 0 }}>
                <b>{i.title}</b>
                <span className="pf-small" style={{ display: 'block' }}>{i.client_name} <Verified on={Number(i.client_verified) === 1} /> · {i.location}{budget(i) ? ` · ${budget(i)}` : ''}</span>
                {i.message && <span className="pf-small" style={{ display: 'block', fontStyle: 'italic' }}>“{i.message}”</span>}
              </div>
              <div className="pf-actions" style={{ margin: 0 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => open1({ ...i, id: i.gig_id, employer_id: i.client_id })}>Send proposal</button>
                <Link to={`/dashboard/browse/${i.gig_id}`} className="btn btn-light btn-sm">Details</Link>
              </div>
            </div>
          ))}</div>
        </section>
      )}

      <div className="pf-browse-filters">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search gigs, like plumbing" aria-label="Search gigs" />
        <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town"><option value="">Any town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select>
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="match">Best match first</option><option value="recent">Newest first</option><option value="budget">Highest budget</option></select>
      </div>
      <div className="pf-between" style={{ margin: '-4px 0 14px' }}>
        <label className="pf-row" style={{ fontSize: 14 }}><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} /> Urgent gigs only</label>
        <span className="pf-small">{data ? `${list.length} open gig${list.length === 1 ? '' : 's'}` : ''} · <Link to="/dashboard/gigs/services">List your own service</Link></span>
      </div>
      {!data ? <BrandLoader compact label="Finding gigs…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconHandshake size={40} /><h2>No open gigs right now</h2>
          <p>{q || cat || town || urgent ? 'Try another word, kind of work or town.' : 'New gigs are posted every day. List your own service so clients can book you directly.'}</p>
          <Link to="/dashboard/gigs/services" className="btn btn-primary">List a service</Link></div>
      ) : (
        <>
          <div className="pf-post-grid" ref={pg.top}>{pg.items.map(g => <GigTile key={g.id} g={g} sent={sent.has(Number(g.id))} onPropose={open1} />)}</div>
          <Pager pg={pg} />
        </>
      )}
    </div>
  )
}

/* ─ My proposals ──────────────────────────────────────── */
export function WorkerProposals({ call }) {
  const [data, error, load] = useLoad(call, '/proposals/mine')
  const [flash, setFlash] = useState('')
  const [tab, setTab] = useState('open')
  const all = data?.proposals || []
  const OPEN = ['submitted', 'shortlisted']
  const shown = tab === 'open' ? all.filter(p => OPEN.includes(p.status)) : tab === 'hired' ? all.filter(p => p.status === 'hired') : tab === 'closed' ? all.filter(p => !OPEN.includes(p.status) && p.status !== 'hired') : all
  const pg = usePaged(shown, { sorts: {
    new: ['Newest first', SORT.date('created_at')],
    price: ['Highest price', SORT.num('bid_amount')],
    gig: ['Gig title (A–Z)', SORT.text('gig_title')],
  } })
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
        <>
        <div className="mc-chips" role="group" aria-label="Filter proposals" style={{ marginBottom: 12 }}>
          {[['open', 'Waiting', all.filter(p => OPEN.includes(p.status)).length], ['hired', 'Hired', all.filter(p => p.status === 'hired').length],
            ['closed', 'Closed', all.filter(p => !OPEN.includes(p.status) && p.status !== 'hired').length], ['all', 'All', all.length]].map(([id, l, n]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{n}</span></button>))}
        </div>
        <ListTools pg={pg} noun="proposal" />
        {shown.length === 0 && <div className="panel pf-empty"><p style={{ margin: 0 }}>No proposals in this list.</p></div>}
        <div className="pf-list">
          {pg.items.map(p => (
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
        <Pager pg={pg} />
        </>
      )}
    </div>
  )
}

/* ─ Contracts ─────────────────────────────────────────── */
export function WorkerContracts({ call }) {
  const [data, error] = useLoad(call, '/contracts')
  const [tab, setTab] = useState('active')
  const all = data?.contracts || []
  const ACTIVE = ['offered', 'active', 'delivered', 'revision_requested', 'disputed']
  const shown = tab === 'active' ? all.filter(c => ACTIVE.includes(c.status)) : tab === 'done' ? all.filter(c => !ACTIVE.includes(c.status)) : all
  const needsMe = c => (c.status === 'offered' || c.status === 'revision_requested' || c.payment_status === 'sent' ? 1 : 0)
  const pg = usePaged(shown, { sorts: {
    todo: ['Needs my action first', (a, b) => needsMe(b) - needsMe(a) || String(a.due_date || '').localeCompare(String(b.due_date || ''))],
    due: ['Due soonest', (a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))],
    new: ['Newest first', SORT.date('started_at')],
    amount: ['Highest price', SORT.num('agreed_amount')],
  } })
  return (
    <div className="page-inner">
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {!data ? <BrandLoader compact label="Loading contracts…" /> : all.length === 0 ? (
        <div className="panel pf-empty"><IconHandshake size={40} /><h2>No contracts yet</h2><p>A contract starts when a client hires you from a proposal or books one of your services.</p>
          <Link to="/dashboard/gigs" className="btn btn-primary">Find gigs</Link></div>
      ) : (
        <>
        <div className="mc-chips" role="group" aria-label="Filter contracts" style={{ marginBottom: 12 }}>
          {[['active', 'In progress', all.filter(c => ACTIVE.includes(c.status)).length], ['done', 'Finished', all.filter(c => !ACTIVE.includes(c.status)).length], ['all', 'All', all.length]].map(([id, l, n]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{n}</span></button>))}
        </div>
        <ListTools pg={pg} noun="contract" />
        {shown.length === 0 && <div className="panel pf-empty"><p style={{ margin: 0 }}>No contracts in this list.</p></div>}
        <div className="pf-list">
          {pg.items.map(c => (
            <Link key={c.id} to={`/dashboard/gigs/contracts/${c.id}`} className="pf-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="pf-between"><h3>{c.title}</h3><span className={`chip ${CONTRACT[c.status]?.tone || ''}`}>{CONTRACT[c.status]?.label}</span></div>
              <p className="pf-meta">{c.client_name} · {peso(c.agreed_amount)} · Due {phDate(c.due_date)} · {PAYMENT_STATUS[c.payment_status]}</p>
              <p className="pf-small" style={{ margin: '6px 0 0' }}>{c.status === 'offered' ? 'New booking: accept or decline it.' : c.status === 'revision_requested' ? 'The client asked for changes.' : c.status_text}</p>
            </Link>
          ))}
        </div>
        <Pager pg={pg} />
        </>
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
/**
 * A service listing the way freelancers sell on any big marketplace: photos of real work,
 * a clear title, what is included, up to three packages (Basic / Standard / Premium),
 * what the client must prepare, the towns served, and a live preview of the card.
 */
const EMPTY_SVC = { title: '', category: '', price: '', price_unit: 'job', delivery_days: 1, service_area: [], description: '', requirements: '', revisions: 1, status: 'active', packages: [] }
const PKG_NAMES = ['Basic', 'Standard', 'Premium']
const blankPkg = i => ({ name: PKG_NAMES[i], price: '', days: 1, includes: '' })

function ServiceForm({ call, user, initial, onDone, onCancel }) {
  const [form, setForm] = useState(initial)
  const [usePk, setUsePk] = useState((initial.packages || []).length > 0)
  const [pending, setPending] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const pk = usePk ? (form.packages.length ? form.packages : [blankPkg(0), blankPkg(1), blankPkg(2)]) : []
  const setPk = (i, k, v) => setForm(f => { const list = (f.packages.length ? f.packages : [blankPkg(0), blankPkg(1), blankPkg(2)]).map((p, j) => (j === i ? { ...p, [k]: v } : p)); return { ...f, packages: list } })
  const toggleTown = t => setForm(f => ({ ...f, service_area: f.service_area.includes(t) ? f.service_area.filter(x => x !== t) : [...f.service_area, t] }))
  const filled = pk.filter(p => Number(p.price) > 0)
  const pendingUrls = useMemo(() => pending.map(f => URL.createObjectURL(f)), [pending])
  useEffect(() => () => pendingUrls.forEach(u => URL.revokeObjectURL(u)), [pendingUrls])
  const preview = {
    ...form, id: form.id || 0, worker: { full_name: user?.full_name, picture: user?.picture, is_verified: user?.is_verified, rating: null },
    worker_name: user?.full_name, worker_picture: user?.picture, worker_verified: user?.is_verified,
    price: filled.length ? Math.min(...filled.map(p => Number(p.price))) : Number(form.price) || 0,
    packages: filled, service_area: form.service_area.join(', '),
    photos: pending.length ? pendingUrls.map((url, i) => ({ slot: i, url })) : form.photos,
    cover: null,
  }

  async function save(e) {
    e.preventDefault(); setErr('')
    if (usePk && filled.length === 0) { setErr('Give at least one package a price, or switch to a single price.'); return }
    if (!usePk && !(Number(form.price) >= 100)) { setErr('Enter your price in pesos (at least 100).'); return }
    setBusy(true)
    try {
      const body = { ...form, packages: usePk ? filled.map(p => ({ ...p, price: Number(p.price), days: Number(p.days) || 1 })) : [], price: usePk ? Math.min(...filled.map(p => Number(p.price))) : Number(form.price) }
      const r = await call(form.id ? `/services/${form.id}` : '/services', { method: form.id ? 'PUT' : 'POST', body })
      const id = form.id || r.id
      const failed = !form.id && pending.length ? await uploadPhotos(call, 'service', id, pending) : 0
      onDone(failed ? `Service saved, but ${failed} photo${failed === 1 ? '' : 's'} didn’t upload. Open Edit to add ${failed === 1 ? 'it' : 'them'} again.` : 'Service saved. Clients can now find and book it in Find Talent → Services.')
    } catch (e2) { setErr(e2.message || 'We couldn’t save your service. Please try again.') } finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="pf-side">
      <div className="pf-stack">
        {err && <div className="pf-note bad" role="alert">{err}</div>}
        <section className="panel">
          <h2 className="pf-h">{form.id ? 'Edit service' : 'List a service'}</h2>
          <p className="pf-sub">Sell a service clients can book directly, like “Aircon cleaning (split type), ₱800 per unit”.</p>
          <label className="field"><span>Service title *</span><div className="in no-icon"><input required minLength={4} maxLength={150} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. I will clean and check your split-type aircon" /></div></label>
          <div className="pf-grid2">
            <label className="field"><span>Kind of work *</span><div className="in no-icon"><select required value={form.category || ''} onChange={e => set('category', e.target.value)}><option value="">Choose one</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
            <label className="field"><span>Price is</span><div className="in no-icon"><select value={form.price_unit} onChange={e => set('price_unit', e.target.value)}><option value="job">Per job</option><option value="hour">Per hour</option><option value="day">Per day</option></select></div></label>
          </div>
          <label className="field"><span>About this service * <em>{(form.description || '').length}/2000</em></span>
            <textarea className="pf-textarea" required minLength={30} maxLength={2000} value={form.description || ''} onChange={e => set('description', e.target.value)}
              placeholder={'What you do, step by step\nYour experience and tools\nWhat is not included'} /></label>
        </section>

        <section className="panel">
          <h2 className="pf-h">Photos</h2>
          <PhotoManager type="service" id={form.id} call={form.id ? call : null} pending={pending} onPending={setPending} max={6} onChange={list => set('photos', list)}
            hint="Up to 6 photos of real work you did: before and after, your tools, the finished job. The first one is the cover clients see first." />
        </section>

        <section className="panel">
          <div className="pf-between"><h2 className="pf-h" style={{ margin: 0 }}>Price and packages</h2>
            <label className="pf-row" style={{ fontSize: 14 }}><input type="checkbox" checked={usePk} onChange={e => setUsePk(e.target.checked)} /> Offer 3 packages</label></div>
          {!usePk ? (
            <div className="pf-grid2" style={{ marginTop: 12 }}>
              <label className="field"><span>Price (₱) *</span><div className="in no-icon"><input type="number" min={100} value={form.price} onChange={e => set('price', e.target.value)} placeholder="e.g. 800" /></div></label>
              <label className="field"><span>Usual time to finish (days)</span><div className="in no-icon"><input type="number" min={1} max={60} value={form.delivery_days} onChange={e => set('delivery_days', e.target.value)} /></div></label>
            </div>
          ) : (
            <div className="svc-pk-edit">{pk.map((p, i) => (
              <div key={i} className="svc-pk-col">
                <div className="in no-icon"><input value={p.name} maxLength={40} onChange={e => setPk(i, 'name', e.target.value)} aria-label={`Package ${i + 1} name`} /></div>
                <label className="field"><span>Price (₱)</span><div className="in no-icon"><input type="number" min={100} value={p.price} onChange={e => setPk(i, 'price', e.target.value)} placeholder={['500', '900', '1500'][i]} /></div></label>
                <label className="field"><span>Days</span><div className="in no-icon"><input type="number" min={1} max={60} value={p.days} onChange={e => setPk(i, 'days', e.target.value)} /></div></label>
                <label className="field"><span>Included <em>one per line</em></span><textarea className="pf-textarea" rows={4} maxLength={500} value={p.includes} onChange={e => setPk(i, 'includes', e.target.value)} placeholder={['1 unit\nBasic cleaning', '2 units\nCleaning + check-up', '3 units\nDeep cleaning + freon check'][i]} /></label>
              </div>
            ))}<p className="pf-small" style={{ gridColumn: '1 / -1', margin: 0 }}>Leave a package’s price empty to hide it. Clients pick one when they book.</p></div>
          )}
          <label className="field" style={{ marginTop: 10 }}><span>Changes included</span><div className="in no-icon"><select value={form.revisions} onChange={e => set('revisions', Number(e.target.value))}>{[0, 1, 2, 3, 5].map(n => <option key={n} value={n}>{n === 0 ? 'No changes' : `${n} change${n === 1 ? '' : 's'}`}</option>)}</select></div></label>
        </section>

        <section className="panel">
          <h2 className="pf-h">Where and what to prepare</h2>
          <div className="field"><span>Towns you serve</span>
            <div className="pf-row">{TOWNS.map(t => <button key={t} type="button" className={`chip ${form.service_area.includes(t) ? 'navy' : ''}`} style={{ cursor: 'pointer', border: 0 }} aria-pressed={form.service_area.includes(t)} onClick={() => toggleTown(t)}>{t}</button>)}</div></div>
          <label className="field"><span>What the client should prepare <em>optional</em></span><textarea className="pf-textarea" maxLength={1000} value={form.requirements || ''} onChange={e => set('requirements', e.target.value)} placeholder="e.g. Access to the outdoor unit, a power outlet, and a photo of the aircon model." /></label>
          <label className="pf-row" style={{ fontSize: 14 }}><input type="checkbox" checked={form.status === 'paused'} onChange={e => set('status', e.target.checked ? 'paused' : 'active')} /> Pause bookings for now</label>
        </section>
      </div>
      <aside className="pf-stack" style={{ position: 'sticky', top: 16 }}>
        <section className="panel">
          <h2 className="pf-h">Preview</h2>
          <p className="pf-small" style={{ marginTop: 0 }}>This is the card clients see in Find Talent.</p>
          <ServiceCard s={preview} to="#" />
        </section>
        <section className="panel">
          <p className="pf-small" style={{ marginTop: 0 }}>Clear photos and an honest price get more bookings. Never ask clients to pay before the work is agreed here.</p>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Publish service'}</button>
          <button type="button" className="btn btn-light btn-block" style={{ marginTop: 8 }} onClick={onCancel}>Cancel</button>
        </section>
      </aside>
    </form>
  )
}

export function WorkerServices({ call, user }) {
  const [data, error, load] = useLoad(call, '/services/mine')
  const [form, setForm] = useState(null)
  const [flash, setFlash] = useState('')
  const [askRemove, setAskRemove] = useState(null)
  const [params, setParams] = useSearchParams()
  const list = data?.services || []

  // "Edit this service" from the service page opens the form straight away
  useEffect(() => {
    const id = Number(params.get('edit'))
    if (!id || !data) return
    const s = list.find(x => x.id === id)
    if (s) edit(s)
    setParams({}, { replace: true })
  }, [params, data]) // eslint-disable-line react-hooks/exhaustive-deps

  function edit(s) { setFlash(''); setForm({ ...EMPTY_SVC, ...s, requirements: s.requirements || '', revisions: s.revisions ?? 1, service_area: String(s.service_area || '').split(',').map(x => x.trim()).filter(Boolean), packages: s.packages || [] }) }
  async function remove(s) {
    setAskRemove(null)
    try { await call(`/services/${s.id}`, { method: 'DELETE' }); setFlash('Service removed.'); load() }
    catch (e) { setFlash(e.message || 'We couldn’t remove the service. Please try again.') }
  }
  async function pause(s) {
    try { await call(`/services/${s.id}`, { method: 'PUT', body: { ...s, service_area: String(s.service_area || '').split(',').map(x => x.trim()).filter(Boolean), status: s.status === 'active' ? 'paused' : 'active' } }); load() }
    catch (e) { setFlash(e.message) }
  }

  if (form) return (
    <div className="page-inner">
      <ServiceForm call={call} user={user} initial={form} onCancel={() => setForm(null)} onDone={m => { setForm(null); setFlash(m); load() }} />
    </div>
  )
  return (
    <div className="page-inner">
      {askRemove && (
        <Dialog tone="danger" title={`Remove “${askRemove.title}”?`} onClose={() => setAskRemove(null)}
          actions={[{ label: 'Remove service', primary: true, onClick: () => remove(askRemove) }, { label: 'Keep it', onClick: () => setAskRemove(null) }]}>
          <p style={{ margin: 0 }}>Clients will no longer see or book it. Bookings you already accepted stay in Contracts.</p>
        </Dialog>
      )}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {!data ? <BrandLoader compact label="Loading your services…" /> : (
        <>
          <div className="pf-between" style={{ marginBottom: 14 }}>
            <p className="pf-muted" style={{ margin: 0 }}>Clients find these in Find Talent → Services and on your profile, and book you directly.</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ ...EMPTY_SVC, service_area: user?.location ? [user.location] : [] })}><IconPlus size={14} /> List a service</button>
          </div>
          {list.length === 0 ? (
            <div className="panel pf-empty"><IconHandshake size={40} /><h2>No services listed yet</h2>
              <p>List what you offer with photos and a clear price. Clients nearby can book you without posting a gig.</p>
              <button type="button" className="btn btn-primary" onClick={() => setForm({ ...EMPTY_SVC, service_area: user?.location ? [user.location] : [] })}><IconPlus size={14} /> List your first service</button></div>
          ) : (
            <div className="pf-post-grid">{list.map(s => (
              <div key={s.id} className="pf-stack" style={{ gap: 8 }}>
                <ServiceCard s={{ ...s, worker_name: user?.full_name, worker_picture: user?.picture, worker_verified: user?.is_verified }} to={`/dashboard/gigs/services/${s.id}`} showWorker={false} />
                <p className="pf-small" style={{ margin: 0 }}><IconEye size={12} /> {s.views} view{s.views === 1 ? '' : 's'} · {s.bookings} booking{s.bookings === 1 ? '' : 's'} · {s.completed} done{!s.photos?.length ? ' · add photos to get more bookings' : ''}</p>
                <div className="pf-actions" style={{ margin: 0 }}>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => edit(s)}><IconEdit size={13} /> Edit</button>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => pause(s)}>{s.status === 'active' ? 'Pause' : 'Resume'}</button>
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setAskRemove(s)} aria-label={`Remove ${s.title}`}><IconTrash size={13} /></button>
                </div>
              </div>
            ))}</div>
          )}
        </>
      )}
    </div>
  )
}

/* ─ The freelance side of a worker's profile ──────────── */
/**
 * Shown on My Profile: the services clients can book, the gigs in progress and the
 * proposals waiting, so the profile and the gig work are one place, not two.
 */
export function FreelanceStrip({ call, user }) {
  const [svc] = useLoad(call, '/services/mine')
  const [ct] = useLoad(call, '/contracts')
  const [pr] = useLoad(call, '/proposals/mine')
  const services = svc?.services || []
  const active = (ct?.contracts || []).filter(c => ['offered', 'active', 'delivered', 'revision_requested'].includes(c.status)).length
  const done = (ct?.contracts || []).filter(c => c.status === 'completed').length
  const waiting = (pr?.proposals || []).filter(p => ['submitted', 'shortlisted'].includes(p.status)).length
  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="pf-between">
        <div>
          <h2 className="pf-h" style={{ margin: 0 }}>Freelance and gigs</h2>
          <p className="pf-small" style={{ margin: '4px 0 0' }}>Clients see your services and reviews on your profile and can book you directly.</p>
        </div>
        <div className="pf-actions" style={{ margin: 0 }}>
          <Link to="/dashboard/gigs/services" className="btn btn-primary btn-sm"><IconPlus size={13} /> {services.length ? 'Manage services' : 'List a service'}</Link>
          <Link to="/dashboard/gigs" className="btn btn-light btn-sm"><IconSearch size={13} /> Find gigs</Link>
        </div>
      </div>
      <div className="fl-stats">
        <Link to="/dashboard/gigs/services"><b>{svc ? services.length : '…'}</b><span>Services listed</span></Link>
        <Link to="/dashboard/gigs/proposals"><b>{pr ? waiting : '…'}</b><span>Proposals waiting</span></Link>
        <Link to="/dashboard/gigs/contracts"><b>{ct ? active : '…'}</b><span>Gigs in progress</span></Link>
        <Link to="/dashboard/gigs/contracts"><b>{ct ? done : '…'}</b><span>Gigs completed</span></Link>
      </div>
      {services.length > 0 && (
        <div className="pf-post-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', marginTop: 14 }}>
          {services.slice(0, 3).map(s => <ServiceCard key={s.id} s={{ ...s, worker_name: user?.full_name }} to={`/dashboard/gigs/services/${s.id}`} showWorker={false} />)}
        </div>
      )}
    </section>
  )
}
