// Help & Support: customer service between users and the hanapbuhay admin team.
// Users send a help request (ticket); every admin sees it in the Support inbox and
// answers it there. Separate from Messages, which is worker ↔ employer chat.
import { useCallback, useEffect, useRef, useState } from 'react'
import BrandLoader from '../../components/BrandLoader.jsx'
import { Link, useSearchParams } from 'react-router-dom'
import { IconHelp, IconPlus, IconSend, IconCheck, IconBack, IconSearch, IconMail, IconPhone, IconPin, IconShield, IconClock } from '../../components/icons.jsx'
import '../../styles/support.css'
import { tr } from '../../lang/dash.js'
import ShotPicker, { ShotStrip } from '../../components/ShotPicker.jsx'

/* The topics a person can ask about, in their own terms. The ids are the server's
   (SupportController::CATEGORIES); only the words and examples change per role. */
const TOPICS = {
  worker: [
    ['jobs', 'Jobs & applications', 'e.g. My application still shows “Applied” after a week'],
    ['verification', 'Certificates & Skills Passport', 'e.g. My TESDA certificate was not accepted'],
    ['account', 'Account & sign-in', 'e.g. I can’t sign in with Google'],
    ['report', 'Report a job or employer', 'e.g. A job post asks me to pay before hiring'],
    ['other', 'Other', 'A short summary of what you need'],
  ],
  employer: [
    ['jobs', 'Job posts & applicants', 'e.g. My post does not show in search'],
    ['payment', 'Payments & hiring package', 'e.g. I paid but my package did not change'],
    ['verification', 'Business verification', 'e.g. My business permit was not accepted'],
    ['account', 'Account & sign-in', 'e.g. I need to change the account email'],
    ['report', 'Report a worker or problem', 'e.g. An applicant used a fake certificate'],
    ['other', 'Other', 'A short summary of what you need'],
  ],
  hirer: [
    ['jobs', 'Requests & workers', 'e.g. No worker has replied to my request'],
    ['payment', 'Payments & Service Buyer Pass', 'e.g. I paid but my pass did not change'],
    ['verification', 'Verification', 'e.g. How do I get the verified badge?'],
    ['account', 'Account & sign-in', 'e.g. I can’t sign in with Google'],
    ['report', 'Report a worker or problem', 'e.g. A worker did not show up and kept the deposit'],
    ['other', 'Other', 'A short summary of what you need'],
  ],
}
const topicsFor = user => TOPICS[user?.account_type] || TOPICS.worker
const MAX = 3000

/** Request ids look like 261114-K3F9 (date + 4 characters); anything else is ignored. */
const ticketId = v => (/^\d{6}-[A-Z0-9]{4}$/.test(v || '') ? v : null)

/** Tell the shell to refresh the sidebar badge (it rides on the notifications poll). */
const pingBadge = () => window.dispatchEvent(new Event('hb:support'))

const parse = ts => { const d = ts ? new Date(String(ts).replace(' ', 'T')) : null; return d && !isNaN(d) ? d : null }
const timeOf = d => d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
/** "Today, 3:45 PM" / "Yesterday, 9:02 AM" / "Nov 12, 3:45 PM" */
function when(ts) {
  const d = parse(ts); if (!d) return ''
  const now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return tr('Today, {time}', { time: timeOf(d) })
  if (d.toDateString() === y.toDateString()) return tr('Yesterday, {time}', { time: timeOf(d) })
  return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}, ${timeOf(d)}`
}
/** list column: "3:45 PM" today, otherwise "Nov 12" */
function short(ts) {
  const d = parse(ts); if (!d) return ''
  return d.toDateString() === new Date().toDateString() ? timeOf(d) : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function Status({ status, team }) {
  const s = {
    open: team ? 'Needs reply' : 'Waiting for reply',
    answered: team ? 'Answered' : 'Replied',
    resolved: 'Resolved',
  }[status] || status
  return <span className={`sp-status ${status}`}>{tr(s)}</span>
}

/* ─ One help request: the conversation + reply box (users and admins) ─ */
function Thread({ call, id, team, onChanged, onBack }) {
  const [t, setT] = useState(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [shots, setShots] = useState([])   // screenshots attached to the reply being written
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  const count = t?.messages?.length || 0
  // the list's reload changes with its filters; keep it out of the deps so the open
  // conversation doesn't reload (and flash) every time the admin switches tabs
  const changed = useRef(onChanged)
  changed.current = onChanged
  const onChangedNow = () => { changed.current?.(); pingBadge() }

  const load = useCallback(quiet => call(`/support/tickets/${encodeURIComponent(id)}`)
    .then(r => { setT(r.ticket); if (!quiet) { changed.current?.(); pingBadge() } })
    .catch(e => { if (!quiet) setErr(tr(e.message || 'Could not open this request.')) }), [call, id])

  useEffect(() => { setT(null); setErr(''); setText(''); setShots([]); load(false) }, [load])
  // new replies show up without a reload while the page is open
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') load(true) }, 30000)
    return () => clearInterval(iv)
  }, [load])
  useEffect(() => { const b = boxRef.current; if (b) b.scrollTop = b.scrollHeight }, [count])

  const act = async (path, body, ok) => {
    setBusy(true); setErr('')
    try {
      const r = await call(`/support/tickets/${encodeURIComponent(id)}/${path}`, { method: 'POST', body })
      setT(r.ticket); ok?.(); onChangedNow()
    } catch (e) {
      setErr(tr(e.message || 'Something went wrong. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  const send = e => {
    e.preventDefault()
    // a screenshot on its own is a valid reply: "here is what I see"
    if ((text.trim().length < 2 && shots.length === 0) || busy) return
    act('reply', { message: text, shots }, () => { setText(''); setShots([]) })
  }

  if (!t) {
    return (
      <div className="sp-thread">
        {onBack && <button type="button" className="sp-back" onClick={onBack}><IconBack size={16} /> {tr("All requests")}</button>}
        {err ? <p className="sp-err" role="alert">{err}</p>
          : <BrandLoader compact label="Loading…" />}
      </div>
    )
  }

  const first = (t.user?.full_name || '').split(' ')[0]
  return (
    <div className="sp-thread">
      {onBack && <button type="button" className="sp-back" onClick={onBack}><IconBack size={16} /> {tr("All requests")}</button>}
      <header className="sp-thread-hd">
        <div style={{ minWidth: 0 }}>
          <h2>{t.subject}</h2>
          <p>#{t.id} · {team ? t.category_label : tr(t.category_label)} {tr("· opened")} {when(t.created_at)}</p>
        </div>
        <Status status={t.status} team={team} />
      </header>

      {team && t.user && (
        <div className="sp-user">
          <b>{t.user.full_name}</b>
          <span className="sp-role">{t.user.role_label}</span>
          {t.user.is_verified && <span className="sp-verified"><IconShield size={12} /> {tr("Verified")}</span>}
          {!t.user.is_active && <span className="sp-inactive">{tr("Deactivated")}</span>}
          <span className="sp-user-line">
            <a href={`mailto:${t.user.email}`}><IconMail size={13} /> {t.user.email}</a>
            {t.user.phone && <a href={`tel:${t.user.phone}`}><IconPhone size={13} /> {t.user.phone}</a>}
            {t.user.location && <span><IconPin size={13} /> {t.user.location}</span>}
          </span>
        </div>
      )}

      <ol className="sp-msgs" ref={boxRef} aria-label={tr("Conversation")}>
        {t.messages.map(m => {
          const mine = team ? m.from_admin : !m.from_admin
          return (
            <li key={m.id} className={`${mine ? 'mine' : 'theirs'}${m.from_admin ? ' team' : ''}`}>
              <div className="sp-bubble">
                <span className="sp-author">{m.from_admin && !team && <IconHelp size={13} />}{team ? m.author : tr(m.author)}</span>
                <div className="sp-body">{m.body}</div>
                <ShotStrip shots={m.shots} />
                <time dateTime={String(m.created_at).replace(' ', 'T')}>{when(m.created_at)}</time>
              </div>
            </li>
          )
        })}
      </ol>

      {!team && t.status === 'open' && (
        <p className="sp-note"><IconClock size={14} /> {tr("Sent to the hanapbuhay team. You’ll see the reply here and get an email when they answer.")}</p>
      )}
      {t.status === 'resolved' && (
        <p className="sp-note"><IconCheck size={14} /> {tr("Marked resolved.")} {team ? tr("A reply opens it again.") : tr("Still need help? Reply below and it opens again.")}</p>
      )}

      <form className="sp-reply" onSubmit={send}>
        <label htmlFor={`sp-reply-${t.id}`} className="sr-only">{team ? tr("Reply to the user") : tr("Reply to hanapbuhay Support")}</label>
        <textarea id={`sp-reply-${t.id}`} rows={3} maxLength={MAX} value={text} disabled={busy}
          placeholder={team ? `Write your reply${first ? ` to ${first}` : ''}…` : tr("Add more details or answer the team…")}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e) }} />
        <ShotPicker shots={shots} onChange={setShots} disabled={busy} />
        {err && <p className="sp-err" role="alert">{err}</p>}
        <div className="sp-reply-actions">
          {t.status !== 'resolved'
            ? <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => act('status', { status: 'resolved' })}>
                <IconCheck size={14} /> {team ? tr("Mark resolved") : tr("My problem is solved")}
              </button>
            : team
              ? <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => act('status', { status: 'open' })}>{tr("Reopen")}</button>
              : <span />}
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || (text.trim().length < 2 && shots.length === 0)}>
            {busy ? <span className="spin" /> : <><IconSend size={14} /> {team ? tr("Send reply") : tr("Send")}</>}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─ New help request form ─ */
function NewRequest({ call, user, onCreated, onCancel }) {
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [shots, setShots] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (!category) return setErr(tr('Choose what your request is about.'))
    if (message.trim().length < 10) return setErr(tr('Tell us a bit more about the problem (at least 10 characters).'))
    setBusy(true); setErr('')
    try {
      const r = await call('/support/tickets', { method: 'POST', body: { category, subject: subject.trim(), message, shots } })
      onCreated(r.ticket)
    } catch (e2) {
      setErr(tr(e2.message || 'Could not send your request. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="sp-new" onSubmit={submit} noValidate>
      {onCancel && <button type="button" className="sp-back" onClick={onCancel}><IconBack size={16} /> {tr("All requests")}</button>}
      <h2>{tr("Ask the hanapbuhay team")}</h2>
      <p className="sp-sub">{tr("A real person from the team answers. You’ll see the reply here and by email at")} <b>{user.email}</b>.</p>

      <fieldset className="sp-topics">
        <legend>{tr("What is it about?")}</legend>
        {topicsFor(user).map(([id, label]) => (
          <label key={id} className={category === id ? 'on' : ''}>
            <input type="radio" name="sp-cat" value={id} checked={category === id} onChange={() => { setCategory(id); setErr('') }} />
            {tr(label)}
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>{tr("Subject")} <em>{tr("(optional)")}</em></span>
        <div className="in no-icon">
          <input value={subject} maxLength={150} onChange={e => setSubject(e.target.value)} placeholder={tr((topicsFor(user).find(t => t[0] === category) || topicsFor(user).at(-1))[2])} disabled={busy} />
        </div>
      </label>
      <label className="field" style={{ marginBottom: 6 }}>
        <span>{tr("Message")}</span>
        <div className="in no-icon">
          <textarea rows={6} value={message} maxLength={MAX} onChange={e => setMessage(e.target.value)} disabled={busy}
            placeholder={category === 'report'
              ? tr("Which job or person, what happened, and when. Don’t send money to anyone who asks for it before hiring.")
              : tr("What happened, what you expected, and the job or page involved.")} />
        </div>
      </label>
      <p className="sp-count" aria-live="polite">{message.length}/{MAX}</p>

      <div className="sp-shots">
        <span className="sp-shots-h">{tr("Screenshot")} <em>{tr("(optional, but it helps a lot)")}</em></span>
        <p className="sp-shots-p">{tr("A picture of the error gets you an answer in one reply instead of three.")}</p>
        <ShotPicker shots={shots} onChange={setShots} disabled={busy} />
      </div>

      {err && <p className="sp-err" role="alert">{err}</p>}
      <div className="sp-new-actions">
        {onCancel && <button type="button" className="btn btn-light" onClick={onCancel} disabled={busy}>{tr("Cancel")}</button>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ minWidth: 160 }}>
          {busy ? <span className="spin" /> : <><IconSend size={15} /> {tr("Send request")}</>}
        </button>
      </div>
    </form>
  )
}

/* ─ Quick answers, so common questions don't need to wait for a reply ─ */
function QuickAnswers({ user }) {
  const type = user.account_type
  const forgot = ['I forgot my password', <>{tr("On the sign-in page, tap")} <b>{tr("Forgot password")}</b> {tr("and we’ll email you a link. If you’re signed in, you can change it in")} <Link to="/dashboard/settings">{tr("Settings")}</Link>.</>]
  const items = type === 'employer' ? [
    ['How do I post a job?', <>Tap <b>Post a job</b> at the top. Your <Link to="/dashboard/subscription">hiring package</Link> sets how many posts can be open at once.</>],
    ['How do I find workers without waiting for applicants?', <>Open <Link to="/dashboard/talent">Find Workers</Link>, search by skill and town, and invite the good ones to apply. Contact details use one unlock credit per worker.</>],
    ['How do I get the Verified business badge?', <>Upload your DTI, SEC, Mayor’s permit or BIR 2303 in <Link to="/dashboard/profile">Business Profile</Link>. We check it within 1–2 working days.</>],
    ['I paid but my package didn’t change', <>PayMongo payments usually update within a few minutes. If not, send a request under <b>Payments & hiring package</b> with the reference number.</>],
    ['How do I feature a post?', <>In <Link to="/dashboard/jobs">My Job Posts</Link>, tap <b>Feature</b> on an open post. It shows first for 30 days and uses one featured credit.</>],
    forgot,
  ] : type === 'hirer' ? [
    ['How do I post a request?', <>Tap <b>Post a request</b> at the top. Say what needs doing, when, and your budget. Tick <b>Urgent</b> if you need someone today.</>],
    ['Nobody replied to my request', <>Add a photo and a budget, then search <Link to="/dashboard/talent">Find Workers</Link> and invite people near you directly.</>],
    ['How do I pay the worker?', <>You pay the worker directly, the way you agree in chat. hanapbuhay never asks you to pay a worker through us.</>],
    ['I paid but my pass didn’t change', <>PayMongo payments usually update within a few minutes. If not, send a request under <b>Payments & Service Buyer Pass</b> with the reference number.</>],
    forgot,
  ] : [
    ['How do I get the Verified badge?', <>Add your TESDA or other certificates in <Link to="/dashboard/passport/certificates">Skills Passport</Link>. The team checks them, and the badge turns on once approved.</>],
    ['How do I cancel an application?', <>Open <Link to="/dashboard/applied">Applications</Link> and tap <b>Withdraw</b> on that job.</>],
    ['How do employers find me?', <>Keep <b>Open to work</b> on in <Link to="/dashboard/profile">My Profile</Link>. Employers then see your Skills Passport in Find Workers and can invite you to apply.</>],
    ['A job asks me to pay before hiring', <>Never pay to get a job. Use <b>Report this job</b> on the job page, or send a request under <b>Report a job or employer</b>.</>],
    forgot,
  ]
  return (
    <section className="panel sp-faq" aria-labelledby="sp-faq-h">
      <h2 id="sp-faq-h">{tr("Quick answers")}</h2>
      {items.map(([q, a]) => (
        <details key={q}><summary>{tr(q)}</summary><p>{a}</p></details>
      ))}
    </section>
  )
}

function TicketRow({ t, active, team, onOpen }) {
  // admins: "New" only matters while it still needs work; users: a resolve is an update, not a reply
  const unread = team ? t.admin_unread && t.status !== 'resolved' : t.user_unread
  const label = team ? 'New' : t.status === 'resolved' ? 'Updated' : 'New reply'
  return (
    <li>
      <button type="button" className={`sp-row${active ? ' on' : ''}${unread ? ' unread' : ''}`} onClick={() => onOpen(t.id)} aria-current={active ? 'true' : undefined}>
        <span className="sp-row-top">
          <b>{team ? (t.user_name || tr("User")) : t.subject}</b>
          <time>{short(t.last_message_at)}</time>
        </span>
        {team && <span className="sp-row-sub">{t.subject}</span>}
        <span className="sp-row-prev">{t.last_from_admin ? (team ? tr("You: ") : tr("Support: ")) : ''}{t.preview}</span>
        <span className="sp-row-meta">
          <Status status={t.status} team={team} />
          <span>{team ? `${t.role_label} · ${t.category_label}` : tr(t.category_label)}</span>
          {unread && <span className="sp-dot">{tr(label)}</span>}
        </span>
      </button>
    </li>
  )
}

/* ─ Workers, employers and clients: /dashboard/support ─ */
export function HelpSupport({ call, user }) {
  const [params, setParams] = useSearchParams()
  const openId = ticketId(params.get('t'))
  const composing = params.get('new') === '1'
  const [tickets, setTickets] = useState(null)
  const [err, setErr] = useState('')
  const [unavailable, setUnavailable] = useState(false)   // 503: support tables not created yet (migration 017)

  const load = useCallback(() => call('/support/tickets')
    .then(r => { setTickets(r.tickets || []); setErr(''); setUnavailable(false) })
    .catch(e => {
      if (e.status === 503) { setUnavailable(true); setErr('') } else setErr(tr(e.message || 'Could not load your help requests.'))
      setTickets(t => t || [])
    }), [call])
  useEffect(() => { load() }, [load])

  const open = id => setParams(id ? { t: String(id) } : {})
  const none = tickets && tickets.length === 0

  return (
    <div className="page-inner sp">
      {!none && !composing && !unavailable && (
        <div className="page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setParams({ new: '1' })}><IconPlus size={14} /> {tr("New request")}</button>
        </div>
      )}
      {err && <p className="sp-err" role="alert" style={{ marginBottom: 14 }}>{err}</p>}

      {unavailable ? (
        <div className="sp-layout sp-first">
          <section className="panel sp-soon" role="status">
            <IconClock size={28} />
            <h2>{tr("Help & Support is almost ready")}</h2>
            <p>{tr("The hanapbuhay team is finishing the setup. Please check back in a little while. The quick answers here may already help.")}</p>
            <button type="button" className="btn btn-light btn-sm" onClick={load}>{tr("↻ Try again")}</button>
          </section>
          <QuickAnswers user={user} />
        </div>
      ) : tickets === null ? (
        <BrandLoader compact label="Loading Help & Support…" />
      ) : none && !openId ? (
        <div className="sp-layout sp-first">
          <section className="panel"><NewRequest call={call} user={user} onCreated={t => { load(); open(t.id) }} /></section>
          <QuickAnswers user={user} />
        </div>
      ) : (
        <>
          <div className={`sp-layout${openId || composing ? ' has-detail' : ''}`}>
            <aside className="panel sp-list" aria-label={tr("Your help requests")}>
              <h2>{tr("Your requests")}</h2>
              <ul>{tickets.map(t => <TicketRow key={t.id} t={t} active={t.id === openId} onOpen={open} />)}</ul>
            </aside>
            <section className="panel sp-detail">
              {composing
                ? <NewRequest call={call} user={user} onCancel={() => open(null)} onCreated={t => { load(); open(t.id) }} />
                : openId
                  ? <Thread call={call} id={openId} onChanged={load} onBack={() => open(null)} />
                  : <div className="sp-pick"><IconHelp size={30} /><p>{tr("Choose a request to see the conversation, or start a new one.")}</p>
                      <button className="btn btn-light btn-sm" onClick={() => setParams({ new: '1' })}><IconPlus size={14} /> {tr("New request")}</button></div>}
            </section>
          </div>
          <QuickAnswers user={user} />
        </>
      )}
    </div>
  )
}

/* ─ Admin: the Support inbox ─ */
const ADMIN_TABS = [['open', 'Needs reply'], ['answered', 'Answered'], ['resolved', 'Resolved'], ['all', 'All']]

export function AdminSupport({ call }) {
  const [params, setParams] = useSearchParams()
  const openId = ticketId(params.get('t'))
  const [tab, setTab] = useState('open')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState(null)
  const [counts, setCounts] = useState({ open: 0, answered: 0, resolved: 0 })
  const [err, setErr] = useState('')
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => { const h = setTimeout(() => setQuery(q.trim()), 300); return () => clearTimeout(h) }, [q])
  const load = useCallback(() => call(`/admin/support?status=${tab}${query ? `&q=${encodeURIComponent(query)}` : ''}`)
    .then(r => { setRows(r.tickets || []); setCounts(r.counts || { open: 0, answered: 0, resolved: 0 }); setErr(''); setUnavailable(false) })
    .catch(e => {
      if (e.status === 503) { setUnavailable(true); setErr('') } else setErr(tr(e.message || 'Could not load the inbox.'))
      setRows(x => x || [])
    }), [call, tab, query])
  useEffect(() => { load() }, [load])
  // new requests arrive while the inbox is open
  useEffect(() => {
    const iv = setInterval(() => { if (document.visibilityState === 'visible') load() }, 45000)
    return () => clearInterval(iv)
  }, [load])

  const open = id => setParams(id ? { t: String(id) } : {})
  const total = counts.open + counts.answered + counts.resolved

  return (
    <div className="page-inner sp">
      <div className="page-actions">
        <button className="btn btn-light btn-sm" onClick={load}>{tr("↻ Refresh")}</button>
      </div>

      {unavailable ? (
        <section className="panel sp-soon" role="status">
          <IconClock size={28} />
          <h2>{tr("The Support inbox can’t reach Firebase")}</h2>
          <p>{tr("Help requests are stored in Firebase Realtime Database through the server’s Firebase service account. Check")} <code>FIREBASE_CLIENT_EMAIL</code>, <code>FIREBASE_PRIVATE_KEY</code> {tr("and")} <code>FIREBASE_DATABASE_URL</code> {tr("in the backend settings, then press Refresh. Until then, users see an “almost ready” notice instead of the request form.")}</p>
        </section>
      ) : (<>
      <div className="sp-tools">
        <div className="ap-tabs" role="tablist" aria-label={tr("Filter requests")}>
          {ADMIN_TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`ap-tab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
              {label} <span className="sp-tab-n">{id === 'all' ? total : counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="sp-search">
          <IconSearch size={15} />
          <span className="sr-only">{tr("Search requests")}</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search name, email, subject or #id")} />
        </label>
      </div>
      {err && <p className="sp-err" role="alert" style={{ marginBottom: 14 }}>{err}</p>}

      <div className={`sp-layout${openId ? ' has-detail' : ''}`}>
        <aside className="panel sp-list" aria-label={tr("Help requests")}>
          {rows === null
            ? <BrandLoader compact label="Loading your requests…" />
            : rows.length === 0
              ? <div className="sp-empty"><IconCheck size={26} /><p>{query ? tr("No requests match your search.") : tab === 'open' ? tr("All caught up. No one is waiting for a reply.") : tr("Nothing here yet.")}</p></div>
              : <ul>{rows.map(t => <TicketRow key={t.id} t={t} team active={t.id === openId} onOpen={open} />)}</ul>}
        </aside>
        <section className="panel sp-detail">
          {openId
            ? <Thread call={call} id={openId} team onChanged={load} onBack={() => open(null)} />
            : <div className="sp-pick"><IconHelp size={30} /><p>{counts.open ? `${counts.open} ${counts.open === 1 ? 'person is' : 'people are'} waiting for a reply. Choose a request to answer it.` : tr("Choose a request to read and answer it.")}</p></div>}
        </section>
      </div>
      </>)}
    </div>
  )
}
