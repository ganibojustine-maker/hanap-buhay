/**
 * ServiceDetail: one service listing, the page a client reads before booking.
 *
 *   photos (gallery) · what's included · packages to choose from · what to prepare
 *   the worker: verified, rating, jobs done, skills, message / view profile
 *   reviews from past clients · more services from the same worker
 *
 * Clients book from here (pick a package, describe the job, choose a date). The worker who
 * owns it sees the same page as a preview, with Edit instead of Book.
 *   /dashboard/talent/services/:id  (client)    /dashboard/gigs/services/:id  (worker)
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BrandLoader from '../../components/BrandLoader.jsx'
import Dialog from '../../components/Dialog.jsx'
import Gallery from '../../components/Gallery.jsx'
import UserAvatar from '../../components/Avatar.jsx'
import ServiceCard, { UNIT, serviceCover } from '../../components/ServiceCard.jsx'
import { IconCheck, IconClock, IconPin, IconStar, IconMsgCircle, IconEdit, IconShield, IconEye } from '../../components/icons.jsx'
import { apiUrl } from '../../utils/photos.js'
import { CATEGORIES } from '../../utils/categories.js'
import { peso, phDate } from '../../utils/format.js'
import '../../styles/platform.css'

const Stars = ({ n = 0 }) => <span className="svc-stars" aria-label={`${n} out of 5`}>{[1, 2, 3, 4, 5].map(k => <span key={k} className={k <= Math.round(n) ? 'on' : ''}>★</span>)}</span>

export default function ServiceDetail({ call, role = 'hirer' }) {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [pkg, setPkg] = useState(0)
  const [book, setBook] = useState(false)
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')
  const [bErr, setBErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setData(null); setErr('')
    call(`/services/${id}`).then(setData).catch(e => { setErr(e.message || 'This service is not available right now.'); setData({}) })
  }, [call, id])

  if (!data) return <div className="page-inner"><BrandLoader compact label="Opening the service…" /></div>
  if (err || !data.service) return (
    <div className="page-inner"><div className="panel pf-empty"><h2>Service not available</h2><p>{err}</p>
      <Link to={role === 'worker' ? '/dashboard/gigs/services' : '/dashboard/talent/services'} className="btn btn-light">Back to services</Link></div></div>
  )

  const s = data.service, w = data.worker || {}, pk = s.packages || []
  const chosen = pk[pkg] || null
  const price = chosen ? chosen.price : s.price
  const days = chosen ? chosen.days : s.delivery_days
  const isClient = data.viewer === 'hirer'
  const msg = role === 'worker' ? '/dashboard/worker/messages' : '/dashboard/client/messages'
  const base = role === 'worker' ? '/dashboard/gigs/services' : '/dashboard/talent/services'
  const photos = (s.photos || []).map(p => apiUrl(p.url))

  async function confirm() {
    setBErr(''); setBusy(true)
    try {
      const r = await call(`/services/${s.id}/book`, { method: 'POST', body: { note, due_date: due, package: chosen ? pkg : '' } })
      nav(`/dashboard/contracts/${r.contract_id}`)
    } catch (e) { setBErr(e.message || 'We couldn’t send the booking. Please try again.') } finally { setBusy(false) }
  }

  return (
    <div className="page-inner">
      {book && (
        <Dialog tone="info" title={`Book: ${s.title}`} onClose={() => setBook(false)} busy={busy}
          actions={[{ label: busy ? 'Sending…' : `Send booking · ${peso(price, { cents: false })}`, primary: true, onClick: confirm }, { label: 'Cancel', onClick: () => setBook(false) }]}>
          <p className="pf-muted" style={{ marginTop: 0 }}>
            {chosen ? <><b>{chosen.name}</b> package · </> : null}{peso(price, { cents: false })} {UNIT[s.price_unit] || ''} · about {days} day{Number(days) === 1 ? '' : 's'}.
            {' '}{s.worker_name} accepts or declines. You pay them directly when the work is done.
          </p>
          {bErr && <div className="pf-note bad" role="alert" style={{ marginBottom: 10 }}>{bErr}</div>}
          {s.requirements && <div className="pf-note info" style={{ marginBottom: 10 }}><b>The worker needs from you:</b> {s.requirements}</div>}
          <label className="field"><span>Describe the job: what, where and when</span>
            <textarea className="pf-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Two split-type aircon units, Brgy. Lalud, Saturday morning" /></label>
          <label className="field"><span>Needed by</span><div className="in no-icon"><input type="date" min={new Date().toISOString().slice(0, 10)} value={due} onChange={e => setDue(e.target.value)} /></div></label>
        </Dialog>
      )}

      <Link to={base} className="pf-small">← All services</Link>
      <div className="svd">
        <div className="pf-stack">
          <section className="panel">
            {data.mine && <div className="pf-note info" style={{ marginBottom: 12 }}><IconEye size={13} /> This is how clients see your service. {s.status === 'paused' ? 'It is paused, so clients cannot book it right now.' : ''}</div>}
            <h1 className="pf-h" style={{ fontSize: 24, marginBottom: 6 }}>{s.title}</h1>
            <p className="svc-meta" style={{ marginBottom: 14 }}>
              {w.rating?.count ? <span className="svc-rate"><IconStar size={12} /> <b>{w.rating.average}</b> ({w.rating.count} review{w.rating.count === 1 ? '' : 's'})</span> : <span className="svc-new">New on hanapbuhay</span>}
              {s.category && CATEGORIES[s.category] && <span>{CATEGORIES[s.category]}</span>}
              {s.completed > 0 && <span>{s.completed} booking{s.completed === 1 ? '' : 's'} completed</span>}
            </p>
            <Gallery photos={photos} alt={s.title} fallback={serviceCover(s)} />
          </section>

          <section className="panel">
            <h2 className="pf-h">About this service</h2>
            <p style={{ whiteSpace: 'pre-line', margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{s.description || 'The worker has not added a description yet. Message them to ask what is included.'}</p>
            <div className="svd-facts">
              <div><IconPin size={14} /><span><small>Serves</small>{s.service_area || w.location || 'Oriental Mindoro'}</span></div>
              <div><IconClock size={14} /><span><small>Usually done in</small>{s.delivery_days} day{Number(s.delivery_days) === 1 ? '' : 's'}</span></div>
              <div><IconEdit size={14} /><span><small>Changes included</small>{s.revisions ?? 1}</span></div>
            </div>
            {s.requirements && <><h3 className="svd-h3">What to prepare</h3><p style={{ margin: 0, fontSize: 14, whiteSpace: 'pre-line' }}>{s.requirements}</p></>}
          </section>

          <section className="panel">
            <h2 className="pf-h">Reviews {data.reviews?.length ? `(${data.reviews.length})` : ''}</h2>
            {!data.reviews?.length ? <p className="pf-muted" style={{ margin: 0 }}>No reviews yet. Reviews appear after a client completes a gig with {w.full_name}.</p> : (
              <ul className="svd-reviews">{data.reviews.map((r, k) => (
                <li key={k}><div className="pf-between"><b>{r.reviewer_name}</b><Stars n={r.rating} /></div>
                  <small className="pf-small">{r.contract_title} · {phDate(r.created_at)}</small>
                  {r.comment && <p>{r.comment}</p>}</li>
              ))}</ul>
            )}
          </section>
        </div>

        <aside className="pf-stack svd-side">
          <section className="panel">
            {pk.length > 0 ? (
              <>
                <div className="svd-tabs" role="tablist">{pk.map((p, k) => (
                  <button key={k} type="button" role="tab" aria-selected={k === pkg} className={k === pkg ? 'on' : ''} onClick={() => setPkg(k)}>{p.name}</button>
                ))}</div>
                <div className="svd-price">{peso(chosen.price, { cents: false })} <small>{UNIT[s.price_unit] || ''}</small></div>
                <p className="pf-small" style={{ margin: '4px 0 10px' }}><IconClock size={12} /> {chosen.days} day{Number(chosen.days) === 1 ? '' : 's'} · {s.revisions ?? 1} change{Number(s.revisions) === 1 ? '' : 's'} included</p>
                {chosen.includes && <ul className="svd-inc">{chosen.includes.split(/\n|,/).map(x => x.trim()).filter(Boolean).map(x => <li key={x}><IconCheck size={12} /> {x}</li>)}</ul>}
              </>
            ) : (
              <>
                <div className="svd-price">{peso(s.price, { cents: false })} <small>{UNIT[s.price_unit] || ''}</small></div>
                <p className="pf-small" style={{ margin: '4px 0 10px' }}><IconClock size={12} /> about {s.delivery_days} day{Number(s.delivery_days) === 1 ? '' : 's'}</p>
              </>
            )}
            {data.mine ? (
              <Link to={`/dashboard/gigs/services?edit=${s.id}`} className="btn btn-primary btn-block"><IconEdit size={14} /> Edit this service</Link>
            ) : isClient ? (
              <button type="button" className="btn btn-primary btn-block" disabled={s.status !== 'active'} onClick={() => { setBook(true); setBErr('') }}>Book {chosen ? chosen.name : 'this service'}</button>
            ) : (
              <p className="pf-small" style={{ margin: 0 }}>Only client accounts can book services.</p>
            )}
            {!data.mine && <Link to={`${msg}?to=${s.worker_id}`} className="btn btn-light btn-block" style={{ marginTop: 8 }}><IconMsgCircle size={14} /> Ask a question first</Link>}
            <p className="pf-small" style={{ margin: '10px 0 0' }}><IconShield size={12} /> You pay the worker directly when the job is done. Never pay anyone before you have a contract here.</p>
          </section>

          <section className="panel">
            <div className="pf-person">
              <UserAvatar user={w} size={52} />
              <span><b>{w.full_name}</b> {Number(w.is_verified) === 1 && <span className="pf-vbadge"><IconCheck size={10} /> Verified</span>}
                <span className="pf-small" style={{ display: 'block' }}><IconPin size={11} /> {w.location || 'Oriental Mindoro'}</span>
                <span className="pf-small" style={{ display: 'block' }}>{w.completed_gigs || 0} gig{Number(w.completed_gigs) === 1 ? '' : 's'} completed{w.rating?.count ? ` · ★ ${w.rating.average}` : ''}</span></span>
            </div>
            {w.skills?.length > 0 && <div className="pf-row" style={{ marginTop: 10 }}>{w.skills.map(k => <span key={k} className="chip">{k}</span>)}</div>}
            {isClient && <Link to={`/dashboard/talent/${w.id}`} className="btn btn-light btn-sm btn-block" style={{ marginTop: 12 }}>View full profile</Link>}
          </section>
        </aside>
      </div>

      {data.others?.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2 className="pf-h">More from {w.full_name}</h2>
          <div className="pf-post-grid">{data.others.map(o => <ServiceCard key={o.id} s={{ ...o, worker: w }} to={`${base}/${o.id}`} showWorker={false} />)}</div>
        </section>
      )}
    </div>
  )
}
