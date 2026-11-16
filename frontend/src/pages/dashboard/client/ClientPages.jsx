/**
 * Client (service buyer) pages. A client hires for gigs: short, priced work.
 *
 *   post gig → proposals → compare → hire → contract (+ milestones) → delivery
 *            → changes (up to the agreed rounds) → complete → pay the worker → review
 *   or book a worker's service directly. Cancelled before delivery, disputed after.
 *
 * These pages belong to the client role only. Employers have their own pages for jobs and
 * applicants (EmployerPages.jsx): hiring for a gig does not go through interview shortlists.
 *
 * What a client sees of other clients: their public gig posts on the job board only. Never
 * other clients' proposals, prices offered to them, contracts, or messages.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BrandLoader from '../../../components/BrandLoader.jsx'
import Dialog from '../../../components/Dialog.jsx'
import UserAvatar from '../../../components/Avatar.jsx'
import { IconBriefcase, IconPlus, IconCheck, IconX, IconEdit, IconTrash, IconMsgCircle, IconStar, IconAlert, IconClock, IconFile, IconSearch, IconBadge, IconArrow, IconEye } from '../../../components/icons.jsx'
import { CONTRACT, PROPOSAL, PAYMENT_STATUS } from '../../../utils/hiringStatus.js'
import { CATEGORIES } from '../../../utils/categories.js'
import { peso, phDate, phDateTime, daysUntil, validPhMobile } from '../../../utils/format.js'
import { barangaysOf } from '../../../data/barangays.js'
import { greet } from '../shared.jsx'
import PhotoManager from '../../../components/PhotoManager.jsx'
import ServiceCard from '../../../components/ServiceCard.jsx'
import { usePaged, Pager, ListTools, SORT } from '../../../components/Pager.jsx'
import { getJobImage } from '../../../utils/jobImages.js'
import { apiUrl, uploadPhotos } from '../../../utils/photos.js'
import '../../../styles/platform.css'
import '../../../styles/overview.css'

const TOWNS = ['Baco', 'Bansud', 'Bongabong', 'Bulalacao', 'Calapan City', 'Gloria', 'Mansalay', 'Naujan', 'Pinamalayan',
  'Pola', 'Puerto Galera', 'Roxas', 'San Teodoro', 'Socorro', 'Victoria']
const DURATIONS = ['A few hours', '1 day', '2–3 days', '1 week', '2–4 weeks', '1–3 months']
const MSG = '/dashboard/client/messages'

const Stars = ({ value }) => <span className="pf-stars" aria-label={`${value} out of 5 stars`}>{'★'.repeat(Math.round(value || 0))}{'☆'.repeat(5 - Math.round(value || 0))}</span>

function Verified({ on }) {
  return on ? <span className="pf-vbadge" title="Identity checked by our team"><IconCheck size={10} /> Verified</span> : null
}

/** Live / waiting for review / needs changes / ended / closed — and what it means. */
export function gigState(g) {
  if (g.moderation_status === 'pending') return { label: 'Waiting for review', tone: 'gold', text: 'Our team checks new gigs from unverified accounts, usually within one working day.' }
  if (g.moderation_status === 'rejected') return { label: 'Needs changes', tone: 'red', text: g.moderation_note ? `Reason: ${g.moderation_note}` : 'Edit the gig and it will be checked again.' }
  const left = daysUntil(g.expires_at)
  if (g.status === 'active') return { label: 'Live', tone: 'green', text: left !== null ? (left <= 0 ? 'Ends today.' : `Ends in ${left} day${left === 1 ? '' : 's'} (${phDate(g.expires_at)}).`) : '' }
  if (g.expires_at && left !== null && left < 0) return { label: 'Ended', tone: '', text: `It ended on ${phDate(g.expires_at)}. Renew it to take proposals again.` }
  return { label: 'Closed', tone: '', text: 'Not taking proposals.' }
}

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

/* ─ Dashboard ─────────────────────────────────────────── */
export function ClientOverview({ user, call }) {
  const [gigs] = useLoad(call, '/gigs/mine')
  const [props] = useLoad(call, '/proposals/received')
  const [contracts] = useLoad(call, '/contracts')
  if (!gigs || !props || !contracts) return <div className="page-inner"><BrandLoader compact label="Loading your dashboard…" /></div>

  const g = gigs.gigs || [], p = props.proposals || [], c = contracts.contracts || []
  const newProps = p.filter(x => x.status === 'submitted')
  const toApprove = c.filter(x => x.status === 'delivered')
  const toPay = c.filter(x => x.status === 'completed' && x.payment_status === 'unpaid')
  const bookings = c.filter(x => x.status === 'offered')
  const active = c.filter(x => ['active', 'revision_requested', 'delivered'].includes(x.status))
  const verified = user.verification_status === 'verified'
  const waiting = [
    ...toApprove.map(x => ({ key: 'd' + x.id, to: `/dashboard/contracts/${x.id}`, title: `Check the delivery: ${x.title}`, text: `${x.worker_name} delivered. Approve it or ask for changes.`, tone: 'gold' })),
    ...toPay.map(x => ({ key: 'p' + x.id, to: `/dashboard/contracts/${x.id}`, title: `Pay ${x.worker_name}: ${peso(x.agreed_amount)}`, text: 'The work is complete. Pay the worker, then mark it paid.', tone: 'gold' })),
    ...(newProps.length ? [{ key: 'np', to: '/dashboard/proposals', title: `${newProps.length} new proposal${newProps.length === 1 ? '' : 's'}`, text: 'Compare prices and delivery times, then hire.', tone: 'navy' }] : []),
  ]

  return (
    <div className="page-inner pf-stack">
      <div className="pf-between">
        <div>
          <h1 className="pf-h" style={{ fontSize: 24 }}>{greet()}, {String(user.full_name || '').split(' ')[0]}</h1>
          <p className="pf-sub" style={{ margin: 0 }}>Here is what needs you today.</p>
        </div>
        <Link to="/dashboard/gigs/new" className="btn btn-primary"><IconPlus size={15} /> Post a gig</Link>
      </div>

      {!verified && (
        <div className="pf-note info pf-between">
          <span><b>Verify your account</b> so your gigs go live right away and workers trust your offers.</span>
          <Link to="/dashboard/verification" className="btn btn-navy btn-sm"><IconBadge size={14} /> Get verified</Link>
        </div>
      )}

      <div className="stat-grid">
        {[['Open gigs', g.filter(x => x.status === 'active').length, '/dashboard/gigs'], ['New proposals', newProps.length, '/dashboard/proposals'],
          ['Work in progress', active.length, '/dashboard/contracts'], ['Completed', c.filter(x => x.status === 'completed').length, '/dashboard/contracts']].map(([l, n, to]) => (
          <Link key={l} to={to} className="stat-card" style={{ textDecoration: 'none' }}><span className="stat-card-val">{n}</span><span className="stat-card-label">{l}</span></Link>
        ))}
      </div>

      <section className="panel">
        <div className="panel-hd"><h2>Waiting on you</h2></div>
        {waiting.length === 0 && bookings.length === 0 ? (
          <p className="pf-muted">Nothing needs you right now. {g.length === 0 ? 'Post your first gig to start getting proposals.' : 'We’ll tell you when a worker sends a proposal or delivers.'}</p>
        ) : (
          <div className="pf-list">
            {waiting.map(w => (
              <Link key={w.key} to={w.to} className="pf-card pf-between" style={{ textDecoration: 'none' }}>
                <span><b style={{ color: 'var(--ink)' }}>{w.title}</b><span className="pf-meta" style={{ display: 'block' }}>{w.text}</span></span>
                <IconArrow size={16} />
              </Link>
            ))}
            {bookings.map(b => (
              <Link key={'b' + b.id} to={`/dashboard/contracts/${b.id}`} className="pf-card pf-between" style={{ textDecoration: 'none' }}>
                <span><b style={{ color: 'var(--ink)' }}>Booking sent: {b.title}</b><span className="pf-meta" style={{ display: 'block' }}>Waiting for {b.worker_name} to accept.</span></span>
                <span className="chip gold">Waiting</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="pf-grid2">
        <section className="panel">
          <div className="panel-hd"><h2>Your gigs</h2><Link to="/dashboard/gigs" className="btn btn-light btn-sm">See all</Link></div>
          {g.length === 0 ? <p className="pf-muted">No gigs yet.</p> : g.slice(0, 4).map(x => {
            const st = gigState(x)
            return (
              <div key={x.id} className="pf-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><Link to={`/dashboard/proposals?gig=${x.id}`}><b>{x.title}</b></Link><span className="pf-small" style={{ display: 'block' }}>{x.proposals} proposal{x.proposals === 1 ? '' : 's'}</span></span>
                <span className={`chip ${st.tone}`}>{st.label}</span>
              </div>
            )
          })}
        </section>
        <section className="panel">
          <div className="panel-hd"><h2>Need someone now?</h2></div>
          <p className="pf-muted">Browse services workers already offer, with fixed prices, and book one directly.</p>
          <div className="pf-actions">
            <Link to="/dashboard/talent/services" className="btn btn-navy btn-sm"><IconSearch size={14} /> Browse services</Link>
            <Link to="/dashboard/talent" className="btn btn-light btn-sm">Find workers</Link>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ─ My Gigs ───────────────────────────────────────────── */
export function ClientGigs({ call }) {
  const navigate = useNavigate()
  const [data, error, load] = useLoad(call, '/gigs/mine')
  const [tab, setTab] = useState('open')
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const close = () => setDialog(null)

  async function act(fn, done) {
    setBusy(true)
    try { const r = await fn(); setFlash(done || r?.message || 'Saved.'); close(); load() }
    catch (e) {
      setDialog({ tone: e.status === 402 ? 'warn' : 'error', title: 'That didn’t work', body: <p>{e.message || 'Please try again.'}</p>,
        actions: e.status === 402 ? [{ label: 'See passes', primary: true, onClick: () => navigate('/dashboard/pass') }, { label: 'Close', onClick: close }] : [{ label: 'OK', primary: true, onClick: close }] })
    } finally { setBusy(false) }
  }
  const renew = g => setDialog({ tone: 'info', title: `Renew “${g.title}”?`, body: <p>Put it back up so workers can send proposals again.</p>,
    actions: [15, 30, 60].map((d, i) => ({ label: `${d} days`, primary: i === 1, onClick: () => act(() => call(`/jobs/${g.id}/renew`, { method: 'POST', body: { days: d } })) }))
      .concat([{ label: 'Cancel', onClick: close }]) })
  const del = g => setDialog({ tone: 'danger', title: `Delete “${g.title}”?`, body: <p>It disappears from the job board. Contracts you already started stay in Contracts.</p>,
    actions: [{ label: 'Delete', primary: true, onClick: () => act(() => call(`/jobs/${g.id}`, { method: 'DELETE' }), 'Gig deleted.') }, { label: 'Cancel', onClick: close }] })

  const all = data?.gigs || []
  const open = all.filter(g => g.status === 'active' || g.moderation_status === 'pending' || g.moderation_status === 'rejected')
  const closed = all.filter(g => !open.includes(g))
  const list = tab === 'open' ? open : tab === 'closed' ? closed : all
  const pg = usePaged(list, { sorts: {
    new: ['Newest first', SORT.date('created_at')],
    proposals: ['Most proposals', SORT.num('proposals')],
    fresh: ['New proposals first', SORT.num('new_proposals')],
    title: ['Title (A–Z)', SORT.text('title')],
  } })

  return (
    <div className="page-inner">
      {dialog && <Dialog tone={dialog.tone} title={dialog.title} actions={dialog.actions} onClose={close} busy={busy}>{dialog.body}</Dialog>}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="pf-between" style={{ marginBottom: 14 }}>
        <div className="mc-chips" role="group" aria-label="Filter gigs">
          {[['open', 'Open', open.length], ['closed', 'Closed and ended', closed.length], ['all', 'All', all.length]].map(([id, l, n]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{n}</span></button>
          ))}
        </div>
        <Link to="/dashboard/gigs/new" className="btn btn-primary btn-sm"><IconPlus size={14} /> Post a gig</Link>
      </div>
      {!data ? <BrandLoader compact label="Loading your gigs…" /> : all.length === 0 ? (
        <div className="panel pf-empty">
          <IconBriefcase size={40} />
          <h2>No gigs yet</h2>
          <p>Post what you need done, like a repair, cleaning or a small project. Workers near you send proposals with their price.</p>
          <div className="pf-actions" style={{ justifyContent: 'center' }}>
            <Link to="/dashboard/gigs/new" className="btn btn-primary"><IconPlus size={15} /> Post a gig</Link>
            <Link to="/dashboard/talent/services" className="btn btn-light">Browse services instead</Link>
          </div>
        </div>
      ) : list.length === 0 ? <div className="panel pf-empty"><p>No gigs here.</p></div> : (
        <>
        <ListTools pg={pg} noun="gig" />
        <div className="pf-list">
          {pg.items.map(g => {
            const st = gigState(g)
            const ended = st.label === 'Ended' || st.label === 'Closed'
            return (
              <article key={g.id} className="pf-card cg-card">
                <Link to={`/dashboard/gigs/${g.id}/edit`} className="cg-thumb" title={Number(g.image_v) > 0 ? 'Change photos' : 'Add photos'}>
                  <img src={getJobImage(g)} alt="" loading="lazy" />
                  {!(Number(g.image_v) > 0) && <span>Add photos</span>}
                </Link>
                <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pf-between">
                  <h3><Link to={`/dashboard/proposals?gig=${g.id}`}>{g.title}</Link></h3>
                  <span className={`chip ${st.tone}`}>{st.label}</span>
                </div>
                <p className="pf-meta">{[CATEGORIES[g.category], [g.barangay, g.location].filter(Boolean).join(', '),
                  (g.salary_min || g.salary_max) ? `Budget ${[g.salary_min, g.salary_max].filter(Boolean).map(v => peso(v, { cents: false })).join('–')}` : null,
                  `Posted ${phDate(g.created_at)}`].filter(Boolean).join(' · ')}</p>
                {st.text && <p className="pf-small" style={{ margin: '6px 0 0' }}>{st.text}</p>}
                <div className="pf-actions">
                  <Link to={`/dashboard/proposals?gig=${g.id}`} className="btn btn-navy btn-sm"><IconFile size={14} /> {g.proposals} proposal{g.proposals === 1 ? '' : 's'}{g.new_proposals ? ` (${g.new_proposals} new)` : ''}</Link>
                  <Link to={`/dashboard/gigs/${g.id}/edit`} className="btn btn-light btn-sm"><IconEdit size={13} /> Edit</Link>
                  {g.status === 'active' && <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => act(() => call(`/jobs/${g.id}`, { method: 'PUT', body: { status: 'closed' } }), 'Gig closed. It no longer takes proposals.')}>Close</button>}
                  {ended && g.moderation_status === 'approved' && <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => renew(g)}><IconClock size={13} /> Renew</button>}
                  <Link to={`/dashboard/browse/${g.id}`} className="btn btn-light btn-sm"><IconEye size={13} /> As workers see it</Link>
                  <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => del(g)}><IconTrash size={13} /> Delete</button>
                </div>
                </div>
              </article>
            )
          })}
        </div>
        <Pager pg={pg} />
        </>
      )}
    </div>
  )
}

/* ─ Post / edit a gig ─────────────────────────────────── */
const EMPTY_GIG = { title: '', category: '', location: '', barangay: '', address: '', description: '', skills_needed: '', salary_min: '', salary_max: '',
  pay_basis: 'fixed', needed_by: '', duration: '', is_urgent: false, openings: 1, expires_in_days: 30, job_type: 'gig' }

export function ClientPostGig({ call, user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(id ? null : { ...EMPTY_GIG, location: user?.location || '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [pending, setPending] = useState([])   // photos picked before a new gig is saved
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'location' ? { barangay: '' } : {}) }))

  useEffect(() => {
    if (!id) return
    call(`/jobs/${id}`).then(r => {
      const j = r.job || {}
      setForm({ ...EMPTY_GIG, ...Object.fromEntries(Object.keys(EMPTY_GIG).map(k => [k, j[k] ?? EMPTY_GIG[k]])), is_urgent: Number(j.is_urgent) === 1, expires_in_days: '' })
    }).catch(e => setErr(e.message || 'We couldn’t open this gig.'))
  }, [id, call])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    if (!form.salary_min && !form.salary_max) { setErr('Enter your budget in pesos so workers can send fair proposals.'); return }
    if (Number(form.salary_min) && Number(form.salary_max) && Number(form.salary_max) < Number(form.salary_min)) { setErr('The highest budget must be more than the lowest.'); return }
    setBusy(true)
    const body = { ...form, salary_min: form.salary_min || null, salary_max: form.salary_max || null, openings: Number(form.openings) || 1 }
    if (!body.expires_in_days) delete body.expires_in_days
    try {
      const r = id ? await call(`/jobs/${id}`, { method: 'PUT', body }) : await call('/jobs', { method: 'POST', body })
      // the photos go up after the gig exists; a failed photo never loses the gig
      const newId = r?.job?.id || r?.id
      const failed = !id && newId && pending.length ? await uploadPhotos(call, 'job', newId, pending) : 0
      setDone(id ? { live: true, message: 'Your changes are saved.' } : { ...r, photoFail: failed })
    } catch (e2) { setErr(e2.message || 'We couldn’t save your gig. Please try again.') } finally { setBusy(false) }
  }

  if (done) return (
    <div className="page-inner">
      <div className="panel pf-empty">
        <IconCheck size={40} />
        <h2>{done.live ? (id ? 'Gig updated' : 'Your gig is live') : 'Thanks! We’re checking your gig'}</h2>
        <p>{done.live ? (id ? done.message : 'Workers near you can now send proposals. We’ll tell you when the first one arrives.')
          : 'Because your account isn’t verified yet, our team checks new gigs first, usually within one working day. Verify your account so next time it goes live right away.'}
          {done.photoFail ? ` ${done.photoFail} photo${done.photoFail === 1 ? '' : 's'} didn’t upload. Open Edit to add ${done.photoFail === 1 ? 'it' : 'them'} again.` : ''}</p>
        <div className="pf-actions" style={{ justifyContent: 'center' }}>
          <Link to="/dashboard/gigs" className="btn btn-primary">Go to My Gigs</Link>
          {!done.live && <Link to="/dashboard/verification" className="btn btn-light">Verify my account</Link>}
        </div>
      </div>
    </div>
  )
  if (!form) return <div className="page-inner">{err ? <div className="pf-note bad">{err}</div> : <BrandLoader compact label="Opening your gig…" />}</div>

  return (
    <div className="page-inner">
      <div className="pf-between" style={{ marginBottom: 16 }}>
        <div><h1 className="pf-h" style={{ fontSize: 24 }}>{id ? 'Edit gig' : 'Post a gig'}</h1>
          <p className="pf-sub" style={{ margin: 0 }}>Describe the work. Workers who can do it send you a proposal with their price and timeline.</p></div>
        <button type="button" className="btn btn-light" onClick={() => navigate(-1)}>← Back</button>
      </div>
      {err && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{err}</div>}
      <form onSubmit={submit} className="pf-side">
        <div className="pf-stack">
          <section className="panel">
            <h2 className="pf-h">The work</h2>
            <label className="field"><span>What do you need done? *</span>
              <div className="in no-icon"><input required minLength={3} maxLength={255} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Fix a leaking kitchen sink" /></div></label>
            <label className="field"><span>Kind of work *</span>
              <div className="in no-icon"><select required value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Choose one</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
            <label className="field"><span>Details *</span>
              <textarea className="pf-textarea" required minLength={20} maxLength={5000} value={form.description || ''} onChange={e => set('description', e.target.value)}
                placeholder="What exactly needs doing, what you already have (tools, materials), and anything the worker should know." /></label>
            <label className="field"><span>Skills needed <em>comma-separated</em></span>
              <div className="in no-icon"><input maxLength={2000} value={form.skills_needed || ''} onChange={e => set('skills_needed', e.target.value)} placeholder="e.g. Plumbing, Pipe fitting" /></div></label>
          </section>
          <section className="panel">
            <h2 className="pf-h">Photos <em className="pf-small" style={{ fontWeight: 500 }}>optional, up to 6</em></h2>
            <PhotoManager type="job" id={id ? Number(id) : null} call={id ? call : null} pending={pending} onPending={setPending} max={6}
              hint="A photo of what needs doing (the leak, the room, the broken item) helps workers understand the job and quote the right price. The first photo is the cover." />
          </section>
          <section className="panel">
            <h2 className="pf-h">Where and when</h2>
            <div className="pf-grid2">
              <label className="field"><span>Town *</span>
                <div className="in no-icon"><select required value={form.location} onChange={e => set('location', e.target.value)}>
                  <option value="">Choose the town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select></div></label>
              <label className="field"><span>Barangay</span>
                <div className="in no-icon"><select value={form.barangay || ''} onChange={e => set('barangay', e.target.value)} disabled={!form.location}>
                  <option value="">{form.location ? 'Choose the barangay' : 'Choose the town first'}</option>{barangaysOf(form.location).map(b => <option key={b}>{b}</option>)}</select></div></label>
            </div>
            <label className="field"><span>Street or landmark <em>only shown to signed-in workers</em></span>
              <div className="in no-icon"><input maxLength={255} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="e.g. near the chapel" /></div></label>
            <div className="pf-grid2">
              <label className="field"><span>Needed by</span>
                <div className="in no-icon"><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.needed_by || ''} onChange={e => set('needed_by', e.target.value)} /></div></label>
              <label className="field"><span>How long it takes</span>
                <div className="in no-icon"><select value={form.duration || ''} onChange={e => set('duration', e.target.value)}>
                  <option value="">Not sure</option>{DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div></label>
            </div>
            <label className="pf-row" style={{ fontSize: 14 }}><input type="checkbox" checked={!!form.is_urgent} onChange={e => set('is_urgent', e.target.checked)} />
              <span><b>Urgent:</b> I need someone as soon as possible</span></label>
          </section>
          <section className="panel">
            <h2 className="pf-h">Budget</h2>
            <p className="pf-sub">Workers see this before they send a price. You pay the worker directly once the work is done.</p>
            <div className="pf-grid2">
              <label className="field"><span>From (₱) *</span><div className="in no-icon"><input type="number" min={100} step={50} value={form.salary_min || ''} onChange={e => set('salary_min', e.target.value)} placeholder="e.g. 800" /></div></label>
              <label className="field"><span>Up to (₱)</span><div className="in no-icon"><input type="number" min={100} step={50} value={form.salary_max || ''} onChange={e => set('salary_max', e.target.value)} placeholder="e.g. 1500" /></div></label>
            </div>
            <div className="pf-grid2">
              <label className="field"><span>Price is</span><div className="in no-icon"><select value={form.pay_basis} onChange={e => set('pay_basis', e.target.value)}>
                <option value="fixed">For the whole job</option><option value="day">Per day</option><option value="hour">Per hour</option></select></div></label>
              <label className="field"><span>Workers needed</span><div className="in no-icon"><input type="number" min={1} max={20} value={form.openings} onChange={e => set('openings', e.target.value)} /></div></label>
            </div>
          </section>
        </div>
        <aside className="pf-stack" style={{ position: 'sticky', top: 16 }}>
          <section className="panel">
            <h2 className="pf-h">Publish</h2>
            {!id && (
              <label className="field"><span>Keep it up for</span><div className="in no-icon"><select value={form.expires_in_days} onChange={e => set('expires_in_days', e.target.value)}>
                <option value={15}>15 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></div></label>
            )}
            <p className="pf-small">{user?.verification_status === 'verified' ? 'Your account is verified, so the gig goes live right away.' : 'Your account is not verified yet, so our team checks the gig before it goes live (usually within one working day).'}</p>
            <p className="pf-small">Never ask workers to pay you. Gigs asking for fees are removed. See our <Link to="/terms">Terms</Link>.</p>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Post gig'}</button>
          </section>
        </aside>
      </form>
    </div>
  )
}

/* ─ Proposals: compare and hire ───────────────────────── */
function HireDialog({ p, call, onClose, onDone }) {
  const [amount, setAmount] = useState(p.bid_amount)
  const [due, setDue] = useState(new Date(Date.now() + (Number(p.delivery_days) || 1) * 86400000).toISOString().slice(0, 10))
  const [revs, setRevs] = useState(2)
  const [ms, setMs] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const total = ms.reduce((s, m) => s + (Number(m.amount) || 0), 0)
  async function go() {
    setErr('')
    if (ms.length && Math.abs(total - Number(amount)) > 0.01) { setErr(`The milestones add up to ${peso(total)}. Make them equal the price, ${peso(amount)}.`); return }
    setBusy(true)
    try { const r = await call(`/proposals/${p.id}/hire`, { method: 'POST', body: { agreed_amount: Number(amount), due_date: due, revisions_allowed: revs, milestones: ms } }); onDone(r) }
    catch (e) { setErr(e.message || 'We couldn’t start the contract. Please try again.') } finally { setBusy(false) }
  }
  return (
    <Dialog tone="info" title={`Hire ${p.worker_name}`} onClose={onClose} busy={busy}
      actions={[{ label: busy ? 'Starting…' : 'Start contract', primary: true, onClick: go }, { label: 'Cancel', onClick: onClose }]}>
      <p className="pf-muted" style={{ marginTop: 0 }}>This starts a contract for “{p.gig_title}”. You pay the worker directly when the work is done, then mark it paid here.</p>
      {err && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{err}</div>}
      <div className="pf-grid2">
        <label className="field"><span>Agreed price (₱)</span><div className="in no-icon"><input type="number" min={100} value={amount} onChange={e => setAmount(e.target.value)} /></div></label>
        <label className="field"><span>Due date</span><div className="in no-icon"><input type="date" min={new Date().toISOString().slice(0, 10)} value={due} onChange={e => setDue(e.target.value)} /></div></label>
      </div>
      <label className="field"><span>Rounds of changes included</span><div className="in no-icon"><select value={revs} onChange={e => setRevs(Number(e.target.value))}>
        {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}</select></div></label>
      <div className="pf-between"><b style={{ fontSize: 14 }}>Milestones <span className="pf-small">(optional, for bigger jobs)</span></b>
        <button type="button" className="btn btn-light btn-sm" onClick={() => setMs(m => [...m, { title: '', amount: '' }])}><IconPlus size={13} /> Add</button></div>
      {ms.map((m, i) => (
        <div key={i} className="pf-row" style={{ marginTop: 8 }}>
          <input className="pf-textarea" style={{ minHeight: 0, height: 40, flex: 2 }} placeholder="e.g. Buy parts" value={m.title} onChange={e => setMs(a => a.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
          <input className="pf-textarea" style={{ minHeight: 0, height: 40, flex: 1 }} type="number" placeholder="₱" value={m.amount} onChange={e => setMs(a => a.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
          <button type="button" className="btn btn-light btn-sm" aria-label="Remove milestone" onClick={() => setMs(a => a.filter((_, j) => j !== i))}><IconX size={13} /></button>
        </div>
      ))}
      {ms.length > 0 && <p className="pf-small">Total: {peso(total)} of {peso(amount)}</p>}
    </Dialog>
  )
}

export function ClientProposals({ call }) {
  const [params, setParams] = useSearchParams()
  const gigId = params.get('gig') || ''
  const navigate = useNavigate()
  const [gigs] = useLoad(call, '/gigs/mine')
  const [data, error, load] = useLoad(call, gigId ? `/gigs/${gigId}/proposals` : '/proposals/received')
  const [hire, setHire] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [flash, setFlash] = useState('')
  const [tab, setTab] = useState('open')
  const all = data?.proposals || []
  const open = all.filter(p => ['submitted', 'shortlisted'].includes(p.status))
  const list = tab === 'open' ? open : tab === 'shortlisted' ? all.filter(p => p.status === 'shortlisted') : all
  const best = useMemo(() => open.length > 1 ? [...open].sort((a, b) => b.match_score - a.match_score || a.bid_amount - b.bid_amount)[0]?.id : null, [open])
  const pg = usePaged(list, { sorts: {
    match: ['Best match first', (a, b) => b.match_score - a.match_score || a.bid_amount - b.bid_amount],
    low: ['Lowest price', SORT.num('bid_amount', 1)],
    fast: ['Fastest delivery', SORT.num('delivery_days', 1)],
    rating: ['Highest rated', (a, b) => (b.worker?.rating?.average || 0) - (a.worker?.rating?.average || 0)],
    new: ['Newest first', SORT.date('created_at')],
  } })

  async function decide(p, action) {
    try {
      await call(`/proposals/${p.id}`, { method: 'PATCH', body: { action } })
      setFlash(action === 'shortlist' ? `${p.worker_name} is on your shortlist.` : `You declined ${p.worker_name}'s proposal. We let them know.`); load()
    } catch (e) { setDialog({ title: 'That didn’t work', body: e.message || 'Please try again.' }) }
  }

  return (
    <div className="page-inner">
      {hire && <HireDialog p={hire} call={call} onClose={() => setHire(null)} onDone={r => { setHire(null); navigate(`/dashboard/contracts/${r.contract_id}`) }} />}
      {dialog && <Dialog tone="error" title={dialog.title} onClose={() => setDialog(null)} actions={[{ label: 'OK', primary: true, onClick: () => setDialog(null) }]}><p>{dialog.body}</p></Dialog>}
      {flash && <div className="pf-note ok" role="status" style={{ marginBottom: 14 }}>{flash}</div>}
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="pf-between" style={{ marginBottom: 14 }}>
        <div className="mc-chips" role="group" aria-label="Filter proposals">
          {[['open', 'To decide', open.length], ['shortlisted', 'Shortlisted', all.filter(p => p.status === 'shortlisted').length], ['all', 'All', all.length]].map(([id, l, n]) => (
            <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{n}</span></button>))}
        </div>
        <select value={gigId} onChange={e => setParams(e.target.value ? { gig: e.target.value } : {})} aria-label="Show proposals for" style={{ height: 38, borderRadius: 10, border: '1.5px solid var(--line)', padding: '0 10px' }}>
          <option value="">All my gigs</option>
          {(gigs?.gigs || []).map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      {!data ? <BrandLoader compact label="Loading proposals…" /> : all.length === 0 ? (
        <div className="panel pf-empty">
          <IconFile size={40} /><h2>No proposals yet</h2>
          <p>{(gigs?.gigs || []).length ? 'Workers usually reply within a day. You can also invite workers you like from Find Talent.' : 'Post a gig and workers near you will send proposals here.'}</p>
          <div className="pf-actions" style={{ justifyContent: 'center' }}>
            {(gigs?.gigs || []).length ? <Link to="/dashboard/talent" className="btn btn-navy">Find workers to invite</Link> : <Link to="/dashboard/gigs/new" className="btn btn-primary">Post a gig</Link>}
          </div>
        </div>
      ) : (
        <section className="panel">
          <p className="pf-muted" style={{ marginTop: 0 }}>The match score uses the same formula workers see: skills, experience, certificates, distance and education.</p>
          <ListTools pg={pg} noun="proposal" />
          <div className="pf-compare-wrap">
            <table className="pf-compare">
              <thead><tr><th>Worker</th><th>Price</th><th>Delivery</th><th>Match</th><th>Their message</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {pg.items.map(p => (
                  <tr key={p.id} className={p.id === best ? 'best' : ''}>
                    <td><div className="pf-person"><UserAvatar user={{ id: p.worker_id, full_name: p.worker_name, picture: p.worker_picture, avatar_color: p.avatar_color }} size={38} />
                      <span><b>{p.worker_name}</b> <Verified on={Number(p.worker_verified) === 1} />
                        <span className="pf-small" style={{ display: 'block' }}>{p.worker_location}{p.worker?.rating?.count ? <> · <Stars value={p.worker.rating.average} /> ({p.worker.rating.count})</> : ' · New on hanapbuhay'}{p.worker?.completed_gigs ? ` · ${p.worker.completed_gigs} gigs done` : ''}</span>
                        {!gigId && <span className="pf-small" style={{ display: 'block' }}>For: {p.gig_title}</span>}
                        {p.id === best && <span className="chip green" style={{ marginTop: 4 }}>Best fit</span>}</span></div></td>
                    <td><b>{peso(p.bid_amount)}</b></td>
                    <td>{p.delivery_days} day{Number(p.delivery_days) === 1 ? '' : 's'}</td>
                    <td><span className={`chip ${p.match_score >= 75 ? 'green' : p.match_score >= 50 ? 'gold' : 'red'}`}>{p.match_score}%</span></td>
                    <td className="pc-msg">
                      <p style={{ margin: 0, fontSize: 13.5, whiteSpace: 'pre-line' }}>{p.cover_letter}</p>
                      {p.available_from && <p className="pf-small" style={{ margin: '6px 0 0' }}><IconClock size={11} /> Can start {phDate(p.available_from)}</p>}
                      {p.work?.length > 0 && (
                        <div className="pp-proof">{p.work.map(w => (
                          <a key={w.id} href={apiUrl(w.url)} target="_blank" rel="noreferrer" title={w.title}><img src={apiUrl(w.url)} alt={w.title} loading="lazy" /></a>
                        ))}<span className="pf-small">Similar work</span></div>
                      )}
                    </td>
                    <td><span className={`chip ${PROPOSAL[p.status]?.tone || ''}`}>{PROPOSAL[p.status]?.label || p.status}</span></td>
                    <td>
                      <div className="pc-act">
                        {['submitted', 'shortlisted'].includes(p.status) && <button type="button" className="btn btn-primary btn-sm" onClick={() => setHire(p)}>Hire</button>}
                        {p.status === 'submitted' && <button type="button" className="btn btn-light btn-sm" onClick={() => decide(p, 'shortlist')}>Shortlist</button>}
                        {['submitted', 'shortlisted'].includes(p.status) && <button type="button" className="btn btn-light btn-sm" onClick={() => decide(p, 'decline')}>Decline</button>}
                        {p.contract_id && <Link to={`/dashboard/contracts/${p.contract_id}`} className="btn btn-navy btn-sm">Contract</Link>}
                        <Link to={`${MSG}?to=${p.worker_id}`} className="btn btn-light btn-sm" aria-label={`Message ${p.worker_name}`}><IconMsgCircle size={13} /></Link>
                        <Link to={`/dashboard/talent/${p.worker_id}`} className="btn btn-light btn-sm">Profile</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length === 0 && <p className="pf-muted" style={{ textAlign: 'center', margin: '14px 0 0' }}>No proposals in this list.</p>}
          <Pager pg={pg} />
        </section>
      )}
    </div>
  )
}

/* ─ Contracts ─────────────────────────────────────────── */
export function ClientContracts({ call }) {
  const [data, error] = useLoad(call, '/contracts')
  const [tab, setTab] = useState('active')
  const all = data?.contracts || []
  const groups = {
    active: all.filter(c => ['offered', 'active', 'delivered', 'revision_requested', 'disputed'].includes(c.status)),
    done: all.filter(c => c.status === 'completed'),
    cancelled: all.filter(c => c.status === 'cancelled'),
  }
  const list = groups[tab]
  const needsMe = c => (c.status === 'delivered' ? 1 : 0)
  const pg = usePaged(list, { sorts: {
    todo: ['Needs my action first', (a, b) => needsMe(b) - needsMe(a) || String(a.due_date || '').localeCompare(String(b.due_date || ''))],
    due: ['Due soonest', (a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))],
    new: ['Newest first', SORT.date('started_at')],
    amount: ['Highest price', SORT.num('agreed_amount')],
  } })
  return (
    <div className="page-inner">
      {error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="mc-chips" role="group" aria-label="Filter contracts" style={{ marginBottom: 14 }}>
        {[['active', 'In progress'], ['done', 'Completed'], ['cancelled', 'Cancelled']].map(([id, l]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l} <span>{groups[id].length}</span></button>))}
      </div>
      {!data ? <BrandLoader compact label="Loading contracts…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconBriefcase size={40} /><h2>{tab === 'active' ? 'No work in progress' : 'Nothing here yet'}</h2>
          <p>Contracts start when you hire someone from Proposals or book a service.</p>
          <div className="pf-actions" style={{ justifyContent: 'center' }}><Link to="/dashboard/proposals" className="btn btn-navy">See proposals</Link><Link to="/dashboard/talent/services" className="btn btn-light">Browse services</Link></div></div>
      ) : (
        <>
        <ListTools pg={pg} noun="contract" />
        <div className="pf-list">
          {pg.items.map(c => (
            <Link key={c.id} to={`/dashboard/contracts/${c.id}`} className="pf-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="pf-between"><h3>{c.title}</h3><span className={`chip ${CONTRACT[c.status]?.tone || ''}`}>{CONTRACT[c.status]?.label}</span></div>
              <p className="pf-meta">{c.worker_name} · {peso(c.agreed_amount)} · Due {phDate(c.due_date)}{Number(c.milestones) ? ` · ${c.milestones_done} of ${c.milestones} milestones approved` : ''}</p>
              <p className="pf-small" style={{ margin: '6px 0 0' }}>{c.status_text}{c.status === 'completed' ? ` · ${PAYMENT_STATUS[c.payment_status]}` : ''}</p>
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
  started: 'Contract started', booked: 'Service booked', accepted: 'Worker accepted the booking', declined: 'Worker declined the booking',
  delivered: 'Work delivered', milestone_submitted: 'Milestone delivered', milestone_approved: 'Milestone approved', milestone_added: 'Milestone added',
  revision_requested: 'Changes requested', completed: 'Marked complete', payment_sent: 'Client marked it paid', payment_confirmed: 'Worker confirmed payment',
  cancelled: 'Contract cancelled', dispute_opened: 'Dispute opened', dispute_resolved: 'Dispute resolved by our team', reviewed: 'Review left',
}
const EVENT_TONE = { completed: 'good', payment_confirmed: 'good', milestone_approved: 'good', accepted: 'good', revision_requested: 'warn', delivered: 'warn', milestone_submitted: 'warn', cancelled: 'bad', dispute_opened: 'bad', declined: 'bad' }

function ReviewBox({ call, id, mine, onDone, who }) {
  const [rating, setRating] = useState(mine?.rating || 0)
  const [comment, setComment] = useState(mine?.comment || '')
  const [msg, setMsg] = useState('')
  async function save() {
    if (!rating) { setMsg('Choose 1 to 5 stars.'); return }
    try { await call(`/contracts/${id}/review`, { method: 'POST', body: { rating, comment } }); setMsg('Thanks for your review.'); onDone() } catch (e) { setMsg(e.message) }
  }
  return (
    <section className="panel">
      <h2 className="pf-h">{mine ? 'Your review' : `Rate ${who}`}</h2>
      <div className="pf-row" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)}
          style={{ background: 'none', border: 0, fontSize: 26, cursor: 'pointer', color: n <= rating ? 'var(--gold)' : 'var(--line)' }} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>)}
      </div>
      <textarea className="pf-textarea" maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder="How was the work? Was it on time?" />
      <div className="pf-actions"><button type="button" className="btn btn-navy btn-sm" onClick={save}>{mine ? 'Update review' : 'Post review'}</button>{msg && <span className="pf-small">{msg}</span>}</div>
    </section>
  )
}

export function ClientContract({ call }) {
  const { id } = useParams()
  const [data, error, load] = useLoad(call, `/contracts/${id}`)
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [text, setText] = useState('')
  const [extra, setExtra] = useState({})
  const close = () => { setDialog(null); setText(''); setExtra({}) }

  async function post(path, body, ok) {
    setBusy(true)
    try { const r = await call(`/contracts/${id}${path}`, { method: 'POST', body }); setFlash(ok || r?.message || 'Done.'); close(); load() }
    catch (e) { setFlash(''); setDialog(d => ({ ...(d || {}), error: e.message || 'That didn’t work. Please try again.' })) } finally { setBusy(false) }
  }
  async function openFile(ev) {
    // the file opens from a local blob: URL in a new tab; no HTML is built from its name
    try { const r = await call(`/contracts/${id}/files/${ev.id}`); const blob = await (await fetch(r.data_url)).blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000) }
    catch (e) { setFlash(e.message) }
  }

  if (!data) return <div className="page-inner"><BrandLoader compact label="Opening the contract…" /></div>
  if (error || !data.contract) return <div className="page-inner"><div className="panel pf-empty"><h2>We couldn’t open this contract</h2><p>{error}</p><Link to="/dashboard/contracts" className="btn btn-light">Back to contracts</Link></div></div>

  const c = data.contract, w = data.worker || {}, ms = data.milestones || []
  const st = CONTRACT[c.status] || {}
  const approved = ms.filter(m => m.status === 'approved').length
  const canCancel = ['offered', 'active'].includes(c.status)
  const canDispute = !['offered', 'cancelled', 'disputed'].includes(c.status)
  const revLeft = Number(c.revisions_allowed) - Number(c.revisions_used)

  const ask = (kind) => {
    const conf = {
      revision: { title: 'Ask for changes', tone: 'warn', label: 'Send request', field: 'What should be changed?', run: () => post('/revision', { note: text }, 'We sent your request to the worker.') },
      complete: { title: 'Approve and complete?', tone: 'success', label: 'Approve work', body: `This marks the contract complete. Then pay ${w.full_name} ${peso(c.agreed_amount)} and mark it paid.`, run: () => post('/complete', {}) },
      paid: { title: 'Mark as paid', tone: 'info', label: 'I paid the worker', field: 'Reference or note (optional)', method: true, run: () => post('/paid', { method: extra.method, note: text }) },
      milestone: { title: 'Add a milestone', tone: 'info', label: 'Add milestone', milestone: true, run: () => post('/milestones', { title: extra.title, amount: Number(extra.amount), due_date: extra.due }, 'Milestone added. The price went up by that amount.') },
      cancel: { title: 'Cancel this contract?', tone: 'danger', label: 'Cancel contract', field: 'Why are you cancelling?', run: () => post('/cancel', { reason: text }) },
      dispute: { title: 'Ask our team to help', tone: 'warn', label: 'Open dispute', field: 'What happened? Include dates and what was agreed.', reason: true, run: () => post('/dispute', { reason: extra.reason, details: text }) },
    }[kind]
    setDialog(conf)
  }

  return (
    <div className="page-inner pf-stack">
      {dialog && (
        <Dialog tone={dialog.tone} title={dialog.title} onClose={close} busy={busy}
          actions={[{ label: busy ? 'Saving…' : dialog.label, primary: true, onClick: dialog.run }, { label: 'Close', onClick: close }]}>
          {dialog.error && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{dialog.error}</div>}
          {dialog.body && <p>{dialog.body}</p>}
          {dialog.method && (
            <label className="field"><span>How did you pay?</span><div className="in no-icon"><select value={extra.method || ''} onChange={e => setExtra(x => ({ ...x, method: e.target.value }))}>
              <option value="">Choose one</option>{Object.entries(data.pay_methods || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
          )}
          {dialog.reason && (
            <label className="field"><span>What went wrong?</span><div className="in no-icon"><select value={extra.reason || ''} onChange={e => setExtra(x => ({ ...x, reason: e.target.value }))}>
              <option value="">Choose one</option>{Object.entries(data.dispute_reasons || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></label>
          )}
          {dialog.milestone && (
            <>
              <label className="field"><span>Milestone</span><div className="in no-icon"><input value={extra.title || ''} onChange={e => setExtra(x => ({ ...x, title: e.target.value }))} placeholder="e.g. Repaint the gate" /></div></label>
              <div className="pf-grid2">
                <label className="field"><span>Amount (₱)</span><div className="in no-icon"><input type="number" min={1} value={extra.amount || ''} onChange={e => setExtra(x => ({ ...x, amount: e.target.value }))} /></div></label>
                <label className="field"><span>Due</span><div className="in no-icon"><input type="date" value={extra.due || ''} onChange={e => setExtra(x => ({ ...x, due: e.target.value }))} /></div></label>
              </div>
            </>
          )}
          {dialog.field && <label className="field"><span>{dialog.field}</span><textarea className="pf-textarea" value={text} onChange={e => setText(e.target.value)} /></label>}
        </Dialog>
      )}
      <Link to="/dashboard/contracts" className="pf-small">← All contracts</Link>
      {flash && <div className="pf-note ok" role="status">{flash}</div>}

      <section className="panel">
        <div className="pf-between">
          <div><h1 className="pf-h" style={{ fontSize: 22 }}>{c.title}</h1>
            <p className="pf-meta">Contract #{c.id} · Started {phDate(c.started_at)} · Due {phDate(c.due_date)}</p></div>
          <span className={`chip ${st.tone}`} style={{ fontSize: 13 }}>{st.label}</span>
        </div>
        <p className="pf-note" style={{ marginTop: 12 }}>{c.status_text}{c.status === 'revision_requested' ? '. The worker is making the changes you asked for.' : ''}
          {c.status === 'delivered' ? ` You have ${revLeft} round${revLeft === 1 ? '' : 's'} of changes left.` : ''}</p>
        <div className="pf-grid2" style={{ marginTop: 14 }}>
          <dl className="pf-kv">
            <dt>Price</dt><dd>{peso(c.agreed_amount)}</dd>
            <dt>Payment</dt><dd>{PAYMENT_STATUS[c.payment_status]}{c.payment_method ? ` (${data.pay_methods?.[c.payment_method]})` : ''}</dd>
            <dt>Changes</dt><dd>{c.revisions_used} of {c.revisions_allowed} used</dd>
          </dl>
          <div className="pf-person">
            <UserAvatar user={w} size={44} />
            <span><b>{w.full_name}</b> <Verified on={Number(w.is_verified) === 1} />
              <span className="pf-small" style={{ display: 'block' }}>{w.location}{w.rating?.count ? <> · <Stars value={w.rating.average} /></> : ''}</span>
              <span className="pf-row" style={{ marginTop: 6 }}><Link to={`${MSG}?to=${w.id}`} className="btn btn-light btn-sm"><IconMsgCircle size={13} /> Message</Link></span></span>
          </div>
        </div>
        {c.scope && <><h3 style={{ fontSize: 14, margin: '16px 0 4px' }}>What was agreed</h3><p style={{ margin: 0, whiteSpace: 'pre-line', fontSize: 14 }}>{c.scope}</p></>}
        <div className="pf-actions">
          {c.status === 'delivered' && <button type="button" className="btn btn-primary btn-sm" onClick={() => ask('complete')}><IconCheck size={14} /> Approve work</button>}
          {c.status === 'delivered' && revLeft > 0 && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('revision')}>Ask for changes</button>}
          {c.payment_status === 'unpaid' && ['completed', 'delivered', 'active'].includes(c.status) && <button type="button" className="btn btn-navy btn-sm" onClick={() => ask('paid')}>Mark as paid</button>}
          {['active', 'revision_requested', 'delivered'].includes(c.status) && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('milestone')}><IconPlus size={13} /> Add milestone</button>}
          {canCancel && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('cancel')}>Cancel</button>}
          {canDispute && <button type="button" className="btn btn-light btn-sm" onClick={() => ask('dispute')}><IconAlert size={13} /> Report a problem</button>}
        </div>
      </section>

      {data.dispute && (
        <section className={`pf-note ${data.dispute.status === 'open' ? 'warn' : 'info'}`}>
          <b>{data.dispute.status === 'open' ? 'Our team is reviewing a dispute' : 'Dispute resolved'}:</b> {data.dispute.reason_text}.
          {data.dispute.resolution_note ? ` Decision: ${data.dispute.resolution_note}` : ' We usually reply within 2 working days. Keep all messages in hanapbuhay.'}
        </section>
      )}

      <div className="pf-grid2">
        <section className="panel">
          <h2 className="pf-h">Milestones</h2>
          {ms.length === 0 ? <p className="pf-muted">This contract is paid as one job. Add a milestone if you agree on extra work.</p> : (
            <>
              <div className="pf-progress" aria-label={`${approved} of ${ms.length} approved`}><i style={{ width: `${(approved / ms.length) * 100}%` }} /></div>
              <ul className="pf-ms" style={{ marginTop: 10 }}>
                {ms.map(m => (
                  <li key={m.id}><span><b>{m.title}</b><span className="pf-small" style={{ display: 'block' }}>{peso(m.amount)}{m.due_date ? ` · due ${phDate(m.due_date)}` : ''}</span></span>
                    {m.status === 'submitted' ? <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(`/contracts/${id}/milestones/${m.id}/approve`, { method: 'POST' }).then(() => { setFlash('Milestone approved.'); load() }).catch(e => setFlash(e.message))}>Approve</button>
                      : <span className={`chip ${m.status === 'approved' ? 'green' : m.status === 'revision' ? 'gold' : ''}`}>{{ pending: 'Not started', in_progress: 'In progress', submitted: 'Delivered', revision: 'Changes asked', approved: 'Approved' }[m.status] || m.status}</span>}</li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="panel">
          <h2 className="pf-h">What happened</h2>
          <ol className="pf-timeline">
            {(data.events || []).map(ev => (
              <li key={ev.id} className={EVENT_TONE[ev.event] || ''}>
                <b>{EVENT_TEXT[ev.event] || ev.event}</b><small>{ev.actor_name ? `${ev.actor_name} · ` : ''}{phDateTime(ev.created_at)}</small>
                {ev.note && <p>{ev.note}</p>}
                {ev.file_name && <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 6 }} onClick={() => openFile(ev)}><IconFile size={13} /> {ev.file_name}</button>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {c.status === 'completed' && <ReviewBox call={call} id={id} mine={data.my_review} onDone={load} who={w.full_name} />}
    </div>
  )
}

/* ─ Services: browse and book ─────────────────────────── */
export function ClientServices({ call }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [town, setTown] = useState('')
  const [max, setMax] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams(Object.entries({ q, category: cat, location: town, max_price: max }).filter(([, v]) => v))
      call(`/services?${qs}`).then(setData).catch(e => setData({ services: [], error: e.message }))
    }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [call, q, cat, town, max])

  const list = data?.services || []
  const rating = s => s.worker?.rating?.average || 0
  const pg = usePaged(list, { perPage: 12, sorts: {
    rec: ['Recommended', (a, b) => Number(b.worker_verified) - Number(a.worker_verified) || rating(b) - rating(a)],
    low: ['Lowest price', SORT.num('price', 1)],
    high: ['Highest price', SORT.num('price')],
    rating: ['Highest rated', (a, b) => rating(b) - rating(a)],
    popular: ['Most booked', SORT.num('completed')],
    new: ['Newest', SORT.date('created_at')],
  } })
  return (
    <div className="page-inner">
      <div className="pf-browse-filters">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search services, like aircon cleaning" aria-label="Search services" />
        <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Kind of work"><option value="">Any kind of work</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={town} onChange={e => setTown(e.target.value)} aria-label="Town"><option value="">Any town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select>
        <select value={max} onChange={e => setMax(e.target.value)} aria-label="Budget"><option value="">Any price</option>{[500, 1000, 2000, 5000, 10000].map(v => <option key={v} value={v}>Up to {peso(v, { cents: false })}</option>)}</select>
      </div>
      {data?.error && <div className="pf-note bad" role="alert" style={{ marginBottom: 14 }}>{data.error}</div>}
      {!data ? <BrandLoader compact label="Finding services…" /> : list.length === 0 ? (
        <div className="panel pf-empty"><IconSearch size={40} /><h2>No services found</h2>
          <p>{q || cat || town || max ? 'Try another word, kind of work, town or price.' : 'Workers have not listed services yet. Post a gig and workers will send you proposals.'}</p>
          <Link to="/dashboard/gigs/new" className="btn btn-primary">Post a gig</Link></div>
      ) : (
        <>
          <ListTools pg={pg} noun="service" perPageOptions={[12, 24, 48]} />
          <div className="pf-post-grid">
            {pg.items.map(s => (
              <ServiceCard key={s.id} s={s} to={`/dashboard/talent/services/${s.id}`}
                actions={<Link to={`/dashboard/talent/services/${s.id}`} className="btn btn-primary btn-sm">View</Link>} />
            ))}
          </div>
          <Pager pg={pg} />
        </>
      )}
    </div>
  )
}

/* ─ Client profile ────────────────────────────────────── */
export function ClientProfile({ user, call, updateUser }) {
  const [form, setForm] = useState({ full_name: user.full_name || '', phone: user.phone || '', location: user.location || '', barangay: user.barangay || '', bio: user.bio || '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'location' ? { barangay: '' } : {}) }))
  async function save(e) {
    e.preventDefault()
    if (form.phone && !validPhMobile(form.phone)) { setMsg({ bad: true, text: 'Enter a Philippine mobile number, like 0917 123 4567.' }); return }
    setBusy(true); setMsg(null)
    try { const r = await call('/auth/me', { method: 'PATCH', body: form }); updateUser(r.user); setMsg({ text: 'Your profile is saved.' }) }
    catch (e2) { setMsg({ bad: true, text: e2.message || 'We couldn’t save your changes. Please try again.' }) } finally { setBusy(false) }
  }
  return (
    <div className="page-inner">
      <form onSubmit={save} className="pf-side">
        <section className="panel">
          <h2 className="pf-h">Your details</h2>
          <p className="pf-sub">Workers see your name, town and verified badge on your gigs. Your mobile number is only shared with a worker you hire.</p>
          {msg && <div className={`pf-note ${msg.bad ? 'bad' : 'ok'}`} role="status" style={{ marginBottom: 12 }}>{msg.text}</div>}
          <label className="field"><span>Full name or business name *</span><div className="in no-icon"><input required minLength={2} value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div></label>
          <label className="field"><span>Mobile number</span><div className="in no-icon"><input inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0917 123 4567" /></div></label>
          <div className="pf-grid2">
            <label className="field"><span>Town *</span><div className="in no-icon"><select required value={form.location} onChange={e => set('location', e.target.value)}><option value="">Choose your town</option>{TOWNS.map(t => <option key={t}>{t}</option>)}</select></div></label>
            <label className="field"><span>Barangay</span><div className="in no-icon"><select value={form.barangay} onChange={e => set('barangay', e.target.value)} disabled={!form.location}><option value="">Choose your barangay</option>{barangaysOf(form.location).map(b => <option key={b}>{b}</option>)}</select></div></label>
          </div>
          <label className="field"><span>About you <em>optional</em></span><textarea className="pf-textarea" maxLength={1000} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="e.g. Homeowner in Calapan, I post small repair jobs now and then." /></label>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        </section>
        <aside className="panel">
          <h2 className="pf-h">Verification</h2>
          <p className="pf-muted">{user.verification_status === 'verified' ? 'Your account is verified. Workers see the Verified badge on your gigs.' : 'Verified clients get the badge and their gigs go live right away.'}</p>
          <Link to="/dashboard/verification" className="btn btn-navy btn-sm"><IconBadge size={14} /> {user.verification_status === 'verified' ? 'See details' : 'Get verified'}</Link>
          <h2 className="pf-h" style={{ marginTop: 20 }}>Your reviews</h2>
          <p className="pf-muted">Workers rate you after each completed contract.</p>
          <Link to="/dashboard/reviews" className="btn btn-light btn-sm"><IconStar size={13} /> Ratings & reviews</Link>
        </aside>
      </form>
    </div>
  )
}
