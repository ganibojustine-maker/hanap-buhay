/**
 * SocialPages — My Network, a person's public profile, and Ratings & Reviews.
 *
 * Following is one-way; when both sides follow each other they are a connection, and a
 * connection is what Messages offers first. That is the answer to "how do I even find
 * someone to message?": the people you worked with, applied to, or follow are right there.
 *
 * Ratings run both ways and only after a hire: a worker rates the employer who hired them
 * (employer_reviews) and the employer rates the worker (worker_reviews). Both averages
 * show on the profile, so credibility is built by actually working, not by claiming.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import WorkPhotos from '../../components/WorkPhotos.jsx'
import { Link, useNavigate, useParams } from 'react-router-dom'
import UserAvatar from '../../components/Avatar.jsx'
import {
  IconUsers, IconCheck, IconPlus, IconMsgCircle, IconPin, IconShield, IconStar,
  IconBriefcase, IconSearch, IconArrow, IconX, IconBook,
} from '../../components/icons.jsx'
import { StarRow } from '../jobs/JobView.jsx'
import { fmtSalary, timeAgo } from '../../components/JobCard.jsx'
import { tr } from '../../lang/dash.js'
import { fileUrl } from '../../api.js'
import '../../styles/social.css'

const ROLE_LABEL = { worker: 'Worker', employer: 'Employer', hirer: 'Client' }

/* ─ Follow button ────────────────────────────────────────── */
export function FollowButton({ person, call, onChange, size = 'sm' }) {
  const [state, setState] = useState({ i_follow: !!person.i_follow, follows_me: !!person.follows_me })
  const [busy, setBusy] = useState(false)
  useEffect(() => { setState({ i_follow: !!person.i_follow, follows_me: !!person.follows_me }) }, [person.i_follow, person.follows_me])

  const toggle = async () => {
    setBusy(true)
    const next = !state.i_follow
    setState(s => ({ ...s, i_follow: next }))
    try {
      if (next) await call('/social/follow', { method: 'POST', body: { user_id: person.id } })
      else await call(`/social/follow/${person.id}`, { method: 'DELETE' })
      onChange?.(person.id, next)
    } catch {
      setState(s => ({ ...s, i_follow: !next })) // the server refused: put the button back
    } finally { setBusy(false) }
  }

  const connected = state.i_follow && state.follows_me
  return (
    <button type="button" onClick={toggle} disabled={busy}
      className={`btn btn-${size} ${state.i_follow ? 'btn-light' : 'btn-primary'}`}
      aria-pressed={state.i_follow}>
      {busy ? <span className="spin" />
        : state.i_follow
          ? <><IconCheck size={13} /> {connected ? tr('Connected') : tr('Following')}</>
          : <><IconPlus size={13} /> {state.follows_me ? tr('Follow back') : tr('Follow')}</>}
    </button>
  )
}

/* ─ One person in a list ─────────────────────────────────── */
function PersonCard({ person, call, onChange }) {
  const connected = person.i_follow && person.follows_me
  return (
    <li className="pc">
      <Link to={`/dashboard/people/${person.id}`} className="pc-av">
        <UserAvatar user={person} size={48} />
      </Link>
      <div className="pc-main">
        <Link to={`/dashboard/people/${person.id}`} className="pc-name">
          {person.full_name || tr('hanapbuhay user')}
          {person.is_verified && <span className="pc-vchk" title={tr('Verified by hanapbuhay')}><IconShield size={12} /></span>}
        </Link>
        <p className="pc-meta">
          {ROLE_LABEL[person.account_type] || tr('Member')}
          {person.location ? <> · <IconPin size={11} /> {person.location}</> : null}
          {person.rating?.count > 0 && (
            <> · <StarRow value={person.rating.average} size={11} /> {person.rating.average} ({person.rating.count})</>
          )}
        </p>
        {person.reason && <span className="pc-why">{tr(person.reason)}</span>}
        {person.bio && <p className="pc-bio">{person.bio}</p>}
      </div>
      <div className="pc-actions">
        <FollowButton person={person} call={call} onChange={onChange} />
        {connected && (
          <Link to={`/dashboard/messages?to=${person.id}`} className="btn btn-light btn-sm">
            <IconMsgCircle size={13} /> {tr('Message')}
          </Link>
        )}
      </div>
    </li>
  )
}

/* ─ My Network ───────────────────────────────────────────── */
export function Network({ call, user }) {
  const [tab, setTab] = useState('connections')
  const [data, setData] = useState({ people: [], counts: { following: 0, followers: 0, connections: 0 } })
  const [suggestions, setSuggestions] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)

  const loadNetwork = useCallback(() => {
    setLoading(true)
    call(`/social/network?kind=${tab}`)
      .then(r => { setData({ people: r.people || [], counts: r.counts || {} }); setSetupNeeded(!!r.setup_needed) })
      .catch(() => setData({ people: [], counts: { following: 0, followers: 0, connections: 0 } }))
      .finally(() => setLoading(false))
  }, [call, tab])
  useEffect(() => { loadNetwork() }, [loadNetwork])

  const loadSuggestions = useCallback(() => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
    call(`/social/suggestions${qs}`).then(r => setSuggestions(r.people || [])).catch(() => setSuggestions([]))
  }, [call, q])
  useEffect(() => {
    const t = setTimeout(loadSuggestions, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [loadSuggestions, q])

  const afterFollow = () => { loadNetwork(); loadSuggestions() }
  const counts = data.counts || {}
  const tabs = [
    ['connections', tr('Connections'), counts.connections],
    ['followers', tr('Followers'), counts.followers],
    ['following', tr('Following'), counts.following],
  ]

  return (
    <div className="page-inner">

      {setupNeeded && (
        <div className="panel" style={{ marginBottom: 16, background: 'var(--gold-l)', borderColor: '#fde68a' }}>
          <b>{tr('Almost ready.')}</b> {tr('Following switches on once the site update finishes. Everything else keeps working.')}
        </div>
      )}

      <div className="sn-tabs" role="tablist">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label} <span>{n ?? 0}</span>
          </button>
        ))}
      </div>

      {loading
        ? <BrandLoader compact label="Loading…" />
        : data.people.length === 0
          ? (
            <div className="panel sn-empty">
              <IconUsers size={36} />
              <h3>{tab === 'connections' ? tr('No connections yet') : tab === 'followers' ? tr('Nobody follows you yet') : tr('You are not following anyone yet')}</h3>
              <p>{tr('Follow someone below. Follow each other and you can message directly.')}</p>
            </div>
          )
          : <ul className="pc-list">{data.people.map(p => <PersonCard key={p.id} person={p} call={call} onChange={afterFollow} />)}</ul>}

      {/* who to follow */}
      <section className="panel sn-suggest">
        <div className="panel-hd">
          <h2>{tr('People you may know')}</h2>
          <div className="in sn-search">
            <IconSearch size={15} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Search by name or town')} aria-label={tr('Search people')} />
            {q && <button type="button" onClick={() => setQ('')} aria-label={tr('Clear')}><IconX size={14} /></button>}
          </div>
        </div>
        {suggestions.length === 0
          ? <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{q ? tr('Nobody matches that search.') : tr('Apply to a job or post one, and the people you deal with appear here.')}</p>
          : <ul className="pc-list">{suggestions.map(p => <PersonCard key={p.id} person={p} call={call} onChange={afterFollow} />)}</ul>}
      </section>
    </div>
  )
}

/* ─ Public profile ───────────────────────────────────────── */
export function PublicProfile({ call, user }) {
  const { id } = useParams()
  const nav = useNavigate()
  const [p, setP] = useState(null)
  const [portfolio, setPortfolio] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(() => {
    call(`/social/profile/${id}`)
      .then(r => setP(r.profile))
      .catch(e => setError(e?.message || tr('Profile not found.')))
    call(`/portfolio/user/${id}`).then(r => setPortfolio(r.items || [])).catch(() => {})
  }, [call, id])
  useEffect(() => { load() }, [load])

  if (error) {
    return (
      <div className="page-inner">
        <div className="panel" style={{ textAlign: 'center', padding: 40 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>{error}</h2>
          <button type="button" className="btn btn-light" onClick={() => nav(-1)}>{tr('Go back')}</button>
        </div>
      </div>
    )
  }
  if (!p) return <div className="page-inner"><BrandLoader compact label="Loading…" /></div>

  const isWorker = p.account_type === 'worker'
  const connected = p.i_follow && p.follows_me

  return (
    <div className="page-inner">
      <header className="up-head panel">
        <UserAvatar user={p} size={84} />
        <div className="up-head-main">
          <h1>
            {p.full_name}
            {p.is_verified && <span className="pc-vchk" title={tr('Verified by hanapbuhay')}><IconShield size={14} /></span>}
          </h1>
          <p className="up-sub">
            {ROLE_LABEL[p.account_type] || tr('Member')}
            {p.location ? <> · <IconPin size={12} /> {p.location}</> : null}
            {p.joined ? <> · {tr('Joined')} {new Date(String(p.joined).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</> : null}
          </p>

          <div className="up-stats">
            {p.rating?.count > 0 && (
              <div className="up-stat">
                <b><StarRow value={p.rating.average} size={14} /> {p.rating.average}</b>
                <span>{p.rating.count} {p.rating.count === 1 ? tr('rating') : tr('ratings')}</span>
              </div>
            )}
            <div className="up-stat"><b>{p.counts?.connections ?? 0}</b><span>{tr('connections')}</span></div>
            <div className="up-stat"><b>{p.counts?.followers ?? 0}</b><span>{tr('followers')}</span></div>
            {isWorker
              ? <div className="up-stat"><b>{p.hired_count ?? 0}</b><span>{tr('jobs hired for')}</span></div>
              : <div className="up-stat"><b>{p.hires_count ?? 0}</b><span>{tr('people hired')}</span></div>}
          </div>

          {p.bio && <p className="up-bio">{p.bio}</p>}
        </div>

        {!p.is_me && (
          <div className="up-actions">
            <FollowButton person={p} call={call} onChange={load} size="md" />
            <Link to={`/dashboard/messages?to=${p.id}`} className="btn btn-navy btn-md"><IconMsgCircle size={15} /> {tr('Message')}</Link>
          </div>
        )}
        {p.is_me && <Link to="/dashboard/profile" className="btn btn-light btn-sm">{tr('Edit my profile')}</Link>}
      </header>

      {/* worker: skills, work gallery */}
      {isWorker && p.skills?.length > 0 && (
        <section className="panel">
          <div className="panel-hd"><h2>{tr('Skills')}</h2></div>
          <ul className="jv-chips">
            {p.skills.map((s, i) => (
              <li key={i} className={Number(s.verified) === 1 ? 'ok' : ''}>
                {Number(s.verified) === 1 ? <IconShield size={13} /> : null}
                {s.skill_name}
                {s.level && <em>{s.level}</em>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isWorker && <WorkPhotos items={portfolio} title={tr('Work photos')} />}

      {/* employer: open jobs */}
      {!isWorker && p.jobs?.length > 0 && (
        <section className="panel">
          <div className="panel-hd"><h2>{tr('Open jobs')}</h2><span className="chip navy">{p.jobs.length}</span></div>
          <ul className="up-jobs">
            {p.jobs.map(j => (
              <li key={j.id}>
                <div>
                  <Link to={`/dashboard/browse/${j.id}`}><IconBriefcase size={14} /> {j.title}</Link>
                  <small>{[j.location, timeAgo(j.created_at)].filter(Boolean).join(' · ')}</small>
                </div>
                <b>{fmtSalary(j.salary_min, j.salary_max)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ratings */}
      <section className="panel">
        <div className="panel-hd">
          <h2>{isWorker ? tr('What employers say') : tr('What hired workers say')}</h2>
          {p.rating?.count > 0 && <span className="chip gold">{p.rating.average} / 5</span>}
        </div>
        {!p.reviews?.length
          ? <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
              {tr('No ratings yet. A rating can only be left after a real hire through hanapbuhay.')}
            </p>
          : <ul className="jv-reviews">
              {p.reviews.map((r, i) => (
                <li key={i}>
                  <div className="jv-review-top">
                    <StarRow value={r.rating} size={13} />
                    <b>{r.by}</b>
                    <span>{[r.job_title, r.created_at && new Date(String(r.created_at).replace(' ', 'T')).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}</span>
                  </div>
                  {r.comment && <p>{r.comment}</p>}
                </li>
              ))}
            </ul>}
      </section>

    </div>
  )
}

/* ─ Ratings & Reviews ────────────────────────────────────── */
function RateCard({ item, rate, call, onSaved }) {
  const [rating, setRating] = useState(item.rating || 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(item.comment || '')
  const [open, setOpen] = useState(!item.rating)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (e) => {
    e.preventDefault()
    if (!rating) { setMsg(tr('Choose from 1 to 5 stars.')); return }
    setBusy(true); setMsg('')
    try {
      await call(rate === 'worker' ? '/reviews/worker' : '/reviews', {
        method: 'POST',
        body: { application_id: item.application_id, rating, comment: comment.trim() || null },
      })
      setMsg(tr('Saved. Thank you.'))
      setOpen(false)
      onSaved?.()
    } catch (err) {
      setMsg(err?.message || tr('Could not save your rating.'))
    } finally { setBusy(false) }
  }

  const who = item.other_name || (rate === 'worker' ? tr('the worker') : tr('the employer'))
  return (
    <li className="rv-card">
      <div className="rv-top">
        <UserAvatar id={item.other_id} name={item.other_name} picture={item.other_picture} size={42} />
        <div>
          <Link to={`/dashboard/people/${item.other_id}`}><b>{who}</b></Link>
          <small>{[item.job_title, item.company].filter(Boolean).join(' · ')}</small>
        </div>
        {item.rating
          ? <span className="rv-done"><StarRow value={item.rating} size={14} /> {tr('Rated')}</span>
          : <span className="chip gold">{tr('Not rated yet')}</span>}
      </div>

      {!open ? (
        <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(true)}>
          {item.rating ? tr('Edit my rating') : tr('Rate now')}
        </button>
      ) : (
        <form onSubmit={save} className="rv-form">
          <div className="rv-stars" role="radiogroup" aria-label={tr('Rating out of 5')}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`}
                onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
                className={(hover || rating) >= n ? 'on' : ''}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
            <span>{['', tr('Poor'), tr('Fair'), tr('Good'), tr('Very good'), tr('Excellent')][hover || rating] || ''}</span>
          </div>
          <textarea rows={3} value={comment} maxLength={1000} onChange={e => setComment(e.target.value)}
            placeholder={rate === 'worker'
              ? tr('How was their work? Were they on time, careful, easy to work with?')
              : tr('How was this employer? Did they pay as agreed and treat you fairly?')} />
          {msg && <p className="rv-msg">{msg}</p>}
          <div className="rv-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? <span className="spin" /> : tr('Save rating')}</button>
            <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(false)}>{tr('Cancel')}</button>
            <small>{tr('Your rating is public on their profile.')}</small>
          </div>
        </form>
      )}
    </li>
  )
}

export function Reviews({ call, user }) {
  const [data, setData] = useState(null)
  const [mine, setMine] = useState(null)
  const isAdmin = user?.role === 'admin'

  const load = useCallback(() => {
    if (isAdmin) return
    call('/reviews/pending').then(setData).catch(() => setData({ items: [], enabled: false }))
    call(`/social/profile/${user.id}`).then(r => setMine(r.profile)).catch(() => {})
  }, [call, user?.id, isAdmin])
  useEffect(() => { load() }, [load])

  if (isAdmin) return <AdminReviewModeration call={call} />

  const items = data?.items || []
  const todo = items.filter(i => i.rating === null)
  const done = items.filter(i => i.rating !== null)

  return (
    <div className="page-inner">

      {mine && (
        <div className="panel rv-mine">
          <div>
            <p className="eyebrow">{tr('My rating')}</p>
            {mine.rating?.count > 0
              ? <h2><StarRow value={mine.rating.average} size={18} /> {mine.rating.average} <small>{`${tr('from')} ${mine.rating.count} ${mine.rating.count === 1 ? tr('rating') : tr('ratings')}`}</small></h2>
              : <h2 style={{ fontSize: 18 }}>{tr('No ratings yet')}</h2>}
            <p>{tr('Shown on your public profile.')}</p>
          </div>
          <Link to={`/dashboard/people/${user.id}`} className="btn btn-light btn-sm">{tr('View my public profile')} <IconArrow size={13} /></Link>
        </div>
      )}

      {!data ? <BrandLoader compact label="Loading…" /> : (
        <>
          <section className="panel">
            <div className="panel-hd">
              <h2>{tr('Waiting for your rating')}</h2>
              <span className="chip gold">{todo.length}</span>
            </div>
            {todo.length === 0
              ? <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
                  {items.length === 0
                    ? tr('Nothing to rate yet. Once a hire goes through hanapbuhay it appears here.')
                    : tr('You have rated everyone. Thank you.')}
                </p>
              : <ul className="rv-list">{todo.map(i => <RateCard key={i.application_id} item={i} rate={data.rate} call={call} onSaved={load} />)}</ul>}
          </section>

          {done.length > 0 && (
            <section className="panel">
              <div className="panel-hd"><h2>{tr('Ratings you gave')}</h2><span className="chip navy">{done.length}</span></div>
              <ul className="rv-list">{done.map(i => <RateCard key={i.application_id} item={i} rate={data.rate} call={call} onSaved={load} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ─ Admin: hide an abusive review (both directions) ──────── */
function AdminReviewModeration({ call }) {
  const [about, setAbout] = useState('employer')
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    call(`/admin/reviews?type=${about}&filter=${filter}`)
      .then(r => setRows(r.reviews || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [call, about, filter])
  useEffect(() => { load() }, [load])

  const toggle = async (r) => {
    try {
      await call(`/admin/reviews/${r.id}?type=${about}`, { method: 'PATCH', body: { hidden: !r.is_hidden, type: about } })
      load()
    } catch { /* ignore */ }
  }

  return (
    <div className="page-inner">

      <div className="sn-tabs" role="tablist" style={{ marginBottom: 12 }}>
        {[['employer', 'About employers'], ['worker', 'About workers']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={about === id} onClick={() => setAbout(id)}>{label}</button>
        ))}
      </div>
      <div className="tc-chips" style={{ marginBottom: 14 }}>
        {[['all', 'All'], ['low', '1–2 stars'], ['hidden', 'Hidden']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      {loading ? <BrandLoader compact label="Loading…" />
        : rows.length === 0 ? <div className="panel" style={{ color: 'var(--muted)' }}>No reviews in this view.</div>
        : <ul className="rv-list">
            {rows.map(r => (
              <li key={r.id} className="rv-card">
                <div className="rv-top">
                  <StarRow value={r.rating} size={15} />
                  <div>
                    <b>{about === 'worker' ? r.worker_name : r.employer_name}</b>
                    <small>rated by {about === 'worker' ? r.employer_name : r.worker_name} · {r.job_title || '—'}{r.company ? ` (${r.company})` : ''}</small>
                  </div>
                  {r.is_hidden && <span className="chip red">Hidden</span>}
                </div>
                {r.comment && <p style={{ fontSize: 14, color: 'var(--text)', margin: '2px 0 10px', whiteSpace: 'pre-line' }}>{r.comment}</p>}
                <button type="button" className={`btn btn-sm ${r.is_hidden ? 'btn-primary' : 'btn-light'}`} onClick={() => toggle(r)}>
                  {r.is_hidden ? 'Show again' : 'Hide this review'}
                </button>
              </li>
            ))}
          </ul>}
    </div>
  )
}
