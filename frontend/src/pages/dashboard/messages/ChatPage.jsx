/**
 * ChatPage: the chat screen every role uses (Firebase Realtime Database).
 *
 * Each role still has its own page and route (WorkerMessages, EmployerMessages,
 * ClientMessages, AdminMessages in this folder): they pass the help text for that role,
 * and the dashboard mounts them with key={user.id}, so signing out and in as someone
 * else never shows the last person's chats.
 *
 *   texts = { start, empty, pick }   the three sentences that differ per role
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { IconMsgCircle, IconX, IconEdit, IconSend, IconSearch, IconUsers, IconBack, IconCheck } from '../../../components/icons.jsx'
import BrandLoader from '../../../components/BrandLoader.jsx'
import UserAvatar from '../../../components/Avatar.jsx'
import { db, firebaseConfigured, ensureFirebaseAuth } from '../../../firebase.js'
import { ref as dbRef, push, onValue, query, orderByChild, limitToLast, set, update, increment } from 'firebase/database'
import { tr } from '../../../lang/dash.js'

/* ─ Messages page ───────────────────────────────────────── */
// Helper: stable thread key from two user IDs (always same order)
function threadKey(a, b) { return [Number(a), Number(b)].sort((x,y) => x-y).join('_') }

const ROLE_LABEL = { worker: 'Worker', employer: 'Employer', hirer: 'Client' }

export default function ChatPage({ call, user, texts }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const toUserId = searchParams.get('to') || searchParams.get('userId')
  const [rawThreads, setRawThreads] = useState([])
  const [profiles,  setProfiles]  = useState({})      // partner id -> { full_name, picture, ... } from the API
  const [active,    setActive]   = useState(null)     // partner user object
  const [msgs,      setMsgs]     = useState([])
  const [text,      setText]     = useState('')
  const [sending,   setSending]  = useState(false)
  const [loading,   setLoading]  = useState(false)
  const [searching, setSearching] = useState(false)
  const [search,    setSearch]   = useState('')
  const [results,   setResults]  = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [threadFilter, setThreadFilter] = useState('')
  const [fbReady,   setFbReady]  = useState(false)
  const [fbError,   setFbError]  = useState('')
  const bottomRef  = useRef()
  const inputRef   = useRef()
  const threadsRef = useRef([])
  const fetching   = useRef(new Set())

  // Chat lives ONLY in Firebase Realtime Database. Nothing here reads or writes MySQL messages.
  const fbFail = (err) => {
    console.warn('[chat] Firebase error:', err?.message || err)
    setFbError(tr('Chat isn’t available right now. Please try again in a few minutes. If it keeps happening, contact support.'))
  }

  // ── Sign in to Firebase as this user ──────────────────────
  useEffect(() => {
    if (!firebaseConfigured || !db || !user?.id) return
    let alive = true
    ensureFirebaseAuth(call, user.id).finally(() => { if (alive) setFbReady(true) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ── Conversation list: threads/{me} ───────────────────────
  useEffect(() => {
    if (!fbReady || !user?.id) return
    const tRef = dbRef(db, `threads/${user.id}`)
    const unsub = onValue(tRef, snap => {
      const data = snap.val() || {}
      const arr = Object.entries(data)
        .map(([key, v]) => ({ ...v, _key: key, partner_id: Number(v.partner_id) }))
        .filter(v => v.partner_id)
        .sort((a, b) => (b.last_ts || 0) - (a.last_ts || 0))
      threadsRef.current = arr
      setRawThreads(arr)
    }, fbFail)
    return () => unsub()
  }, [fbReady, user?.id])

  // ── Partner names and photos come from the API, never from chat data ──
  useEffect(() => {
    const missing = [...new Set(rawThreads.map(t => t.partner_id))].filter(id => id && !profiles[id] && !fetching.current.has(id)).slice(0, 25)
    missing.forEach(id => {
      fetching.current.add(id)
      call(`/users/${id}`).then(r => { if (r?.user) setProfiles(p => ({ ...p, [id]: r.user })) }).catch(() => {})
    })
  }, [rawThreads, profiles, call])

  const threads = useMemo(() => rawThreads.map(t => ({
    ...t,
    partner_name: profiles[t.partner_id]?.full_name || t.partner_name || 'User',
    partner_avatar: profiles[t.partner_id]?.picture || '',
  })), [rawThreads, profiles])

  // ── Auto-open conversation when ?to= is present in URL ────
  useEffect(() => {
    if (!toUserId || !user?.id) return
    const pid = Number(toUserId)
    if (!pid || pid === user.id) return
    if (active && Number(active.id) === pid) return
    if (profiles[pid]) { setActive(profiles[pid]); return }
    call(`/users/${pid}`).then(r => { if (r?.user) { setProfiles(p => ({ ...p, [pid]: r.user })); setActive(r.user) } }).catch(() => {})
  }, [toUserId, user?.id, profiles, active?.id, call])

  // ── Live messages for the open conversation ───────────────
  useEffect(() => {
    if (!fbReady || !active?.id || !user?.id) { setMsgs([]); return }
    setLoading(true)
    const tKey = threadKey(user.id, active.id)
    const mRef = query(dbRef(db, `messages/${tKey}/msgs`), orderByChild('ts'), limitToLast(200))
    const unsub = onValue(mRef, snap => {
      const data = snap.val() || {}
      setMsgs(Object.entries(data).map(([id, m]) => ({ ...m, _id: id })).sort((a, b) => (a.ts || 0) - (b.ts || 0)))
      setLoading(false)
      // mark as read for me
      const t = threadsRef.current.find(x => String(x.partner_id) === String(active.id))
      if (t && Number(t.unread) > 0) set(dbRef(db, `threads/${user.id}/${tKey}/unread`), 0).catch(() => {})
    }, (err) => { setLoading(false); fbFail(err) })
    return () => unsub()
  }, [fbReady, active?.id, user?.id])

  // ── Auto-scroll to bottom ─────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  /**
   * Who can I message?  The old list was a bare name search, so an empty inbox was a
   * dead end: you had to already know someone's name. It now asks the social graph for
   * the people this account actually has a reason to talk to — connections first, then
   * the employers they applied to (or the workers who applied to them), then people in
   * their town — each with the reason shown. Typing still searches everyone.
   */
  useEffect(() => {
    if (!searching) return
    setContactsLoading(true)
    const q = search.trim()
    const timer = setTimeout(async () => {
      try {
        const r = await call(`/social/suggestions${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        setResults((r?.people || []).filter(u => u.id !== user?.id))
      } catch {
        // the social tables may not exist yet: fall back to the plain name search
        try {
          const r = await call(`/auth/search-users?q=${encodeURIComponent(q)}`)
          setResults((r?.users || []).filter(u => u.id !== user?.id))
        } catch { setResults([]) }
      } finally {
        setContactsLoading(false)
      }
    }, q ? 300 : 0)

    return () => clearTimeout(timer)
  }, [searching, search, call, user?.id])

  // the people worth offering before anyone opens the search, so the empty state is useful
  const [contacts, setContacts] = useState([])
  useEffect(() => {
    if (!user?.id) return
    call('/social/network?kind=connections')
      .then(r => setContacts(r.people || []))
      .catch(() => setContacts([]))
  }, [call, user?.id])

  // ── Send message: straight to Firebase ────────────────────
  async function send(e) {
    e.preventDefault()
    const clean = text.trim().slice(0, 2000)
    if (!clean || !active || sending || !fbReady) return
    setSending(true)
    setText('')
    inputRef.current?.focus()

    const ts = Date.now()
    const tKey = threadKey(user.id, active.id)
    const myName = user.full_name || 'User'
    try {
      await push(dbRef(db, `messages/${tKey}/msgs`), {
        from: String(user.id),
        sender_id: user.id,
        sender_name: myName,
        body: clean,
        ts,
      })
      const preview = clean.slice(0, 80)
      await Promise.all([
        update(dbRef(db, `threads/${user.id}/${tKey}`), {
          partner_id: Number(active.id), partner_name: active.full_name || 'User', body: preview, last_ts: ts, unread: 0,
        }),
        update(dbRef(db, `threads/${active.id}/${tKey}`), {
          partner_id: Number(user.id), partner_name: myName, body: preview, last_ts: ts, unread: increment(1),
        }),
      ])
      // Content-free in-app ping so the other person is told they have a message
      call('/messages/notify', { method: 'POST', body: { receiver_id: active.id } }).catch(() => {})
      setFbError('')
    } catch (err) {
      console.error('Send failed:', err)
      setText(clean)
      fbFail(err)
    } finally {
      setSending(false)
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

  if (!firebaseConfigured) {
    return (
      <div style={{ padding: '28px' }}>
        <div className="panel" style={{ textAlign: 'center', padding: '44px 20px' }}>
          <IconMsgCircle size={30} />
          <h3 style={{ margin: '10px 0 4px' }}>{tr("Chat is not available yet")}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{tr("The messaging service has not been set up. Please try again later.")}</p>
        </div>
      </div>
    )
  }

  // ── Main chat UI ──────────────────────────────────────────
  const activeInfo = active ? { ...active, ...(profiles[active.id] || {}) } : null
  const shownThreads = threadFilter.trim()
    ? threads.filter(t => `${t.partner_name} ${t.body || ''}`.toLowerCase().includes(threadFilter.trim().toLowerCase()))
    : threads
  // suggestions arrive with a reason; show them under that reason, in the order the server ranked them
  const groups = []
  for (const u of results) {
    const key = u.reason || 'On hanapbuhay'
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, people: [] }; groups.push(g) }
    g.people.push(u)
  }
  const starters = activeInfo ? startersFor(user, activeInfo) : []

  return (
    <div className="msgs-page">
      {fbError && <div className="msgs-error" role="alert">{fbError}</div>}

      <div className={`messages-layout${active ? ' has-active' : ''}`}>
        {/* ── left: conversations, or the "new message" picker ── */}
        <aside className="msg-sidebar">
          {!searching ? (
            <>
              <div className="msg-sidebar-hd">
                <h2>{tr('Chats')}</h2>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setSearching(true)}>
                  <IconEdit size={14} /> {tr('New message')}
                </button>
              </div>
              {threads.length > 0 && (
                <label className="msg-find">
                  <IconSearch size={15} />
                  <input value={threadFilter} onChange={e => setThreadFilter(e.target.value)} placeholder={tr('Search conversations')} aria-label={tr('Search conversations')} />
                </label>
              )}
              <div className="msg-threads">
                {!fbReady ? <BrandLoader compact label={tr('Loading chats…')} />
                  : threads.length === 0 ? (
                    <div className="msg-blank">
                      <IconMsgCircle size={36} />
                      <p className="msg-blank-h">{tr('No conversations yet')}</p>
                      <p className="msg-blank-p">{tr(texts.start)}</p>
                      {contacts.length > 0 && (
                        <div className="msg-blank-list">
                          {contacts.slice(0, 5).map(c => (
                            <button type="button" key={c.id} className="msg-contact" onClick={() => openThread(c)}>
                              <UserAvatar user={c} size={34} />
                              <span className="msg-contact-main">
                                <span className="msg-contact-name">{c.full_name}</span>
                                <span className="msg-contact-meta">{tr(ROLE_LABEL[c.account_type] || 'User')}{c.location ? ` · ${c.location}` : ''}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setSearching(true)}>
                        <IconEdit size={13} /> {tr('Start a new chat')}
                      </button>
                    </div>
                  )
                  : shownThreads.length === 0 ? <p className="msg-none">{tr('No conversation matches “{q}”.', { q: threadFilter })}</p>
                  : shownThreads.map(t => (
                    <button type="button" key={t.partner_id}
                      className={`msg-thread-item${String(active?.id) === String(t.partner_id) ? ' active' : ''}${t.unread > 0 ? ' unread' : ''}`}
                      onClick={() => openThread({ id: t.partner_id, full_name: t.partner_name, picture: t.partner_avatar, ...(profiles[t.partner_id] || {}) })}>
                      <UserAvatar id={t.partner_id} name={t.partner_name} picture={t.partner_avatar} user={profiles[t.partner_id]} size={44} />
                      <span className="msg-thread-meta">
                        <span className="msg-thread-top">
                          <span className="msg-thread-name">{t.partner_name}</span>
                          <span className="msg-thread-time">{t.last_ts ? whenShort(t.last_ts) : ''}</span>
                        </span>
                        <span className="msg-thread-bottom">
                          <span className="msg-thread-preview">{t.body}</span>
                          {t.unread > 0 && <span className="msg-unread">{t.unread > 9 ? '9+' : t.unread}</span>}
                        </span>
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <>
              <div className="msg-sidebar-hd">
                <button type="button" className="msg-back" onClick={() => { setSearching(false); setSearch('') }} aria-label={tr('Back to chats')}>
                  <IconBack size={18} />
                </button>
                <h2>{tr('New message')}</h2>
              </div>
              <label className="msg-find">
                <IconSearch size={15} />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('Search by name or town')} aria-label={tr('Search people')} />
                {search && <button type="button" onClick={() => setSearch('')} aria-label={tr('Clear')}><IconX size={13} /></button>}
              </label>
              <div className="msg-threads">
                {contactsLoading && results.length === 0 ? <BrandLoader compact label={tr('Finding people…')} />
                  : results.length === 0 ? (
                    <div className="msg-blank">
                      <IconUsers size={34} />
                      <p className="msg-blank-h">{search.trim() ? tr('No one found') : tr('No suggestions yet')}</p>
                      <p className="msg-blank-p">{search.trim() ? tr('Check the spelling, or search by town.') : tr(texts.empty)}</p>
                    </div>
                  )
                  : groups.map(g => (
                    <div key={g.key} className="msg-group">
                      <p className="msg-group-h">{tr(g.key)}</p>
                      {g.people.map(u => (
                        <button type="button" key={u.id} className="msg-contact" onClick={() => openThread(u)}>
                          <UserAvatar user={u} size={40} />
                          <span className="msg-contact-main">
                            <span className="msg-contact-name">{u.full_name}{u.is_verified && <i className="msg-vchk" title={tr('Verified')}><IconCheck size={9} /></i>}</span>
                            <span className="msg-contact-meta">{tr(ROLE_LABEL[u.account_type] || 'User')}{u.location ? ` · ${u.location}` : ''}</span>
                          </span>
                          <IconMsgCircle size={16} />
                        </button>
                      ))}
                    </div>
                  ))}
              </div>
            </>
          )}
        </aside>

        {/* ── right: the conversation ── */}
        <section className="msg-chat">
          {!activeInfo ? (
            <div className="msg-empty">
              <span className="msg-empty-ic"><IconMsgCircle size={30} /></span>
              <h3>{tr('Your messages')}</h3>
              <p>{tr(texts.pick)}</p>
              <button type="button" className="btn btn-primary" onClick={() => setSearching(true)}>
                <IconEdit size={14} /> {tr('New message')}
              </button>
            </div>
          ) : (
            <>
              <header className="msg-chat-hd">
                <button type="button" className="msg-back msg-back-m" onClick={() => setActive(null)} aria-label={tr('Back to chats')}><IconBack size={18} /></button>
                <UserAvatar user={activeInfo} size={42} />
                <div className="msg-chat-who">
                  <b>{activeInfo.full_name}</b>
                  <small>{[tr(ROLE_LABEL[activeInfo.account_type] || 'User'), activeInfo.location].filter(Boolean).join(' · ')}</small>
                </div>
                <Link to={`/dashboard/people/${activeInfo.id}`} className="btn btn-light btn-sm">{tr('View profile')}</Link>
              </header>

              <div className="msg-chat-body">
                {loading && <BrandLoader compact label={tr('Loading messages…')} />}
                {!loading && msgs.length === 0 && (
                  <div className="msg-start">
                    <UserAvatar user={activeInfo} size={64} />
                    <b>{activeInfo.full_name}</b>
                    <p>{tr('This is the start of your conversation. Say hello, or pick a message below.')}</p>
                    <div className="msg-starters">
                      {starters.map(t => (
                        <button type="button" key={t} onClick={() => { setText(t); inputRef.current?.focus() }}>{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => {
                  const mine = String(m.sender_id) === String(user.id)
                  const showDate = i === 0 || new Date(msgs[i - 1].ts).toDateString() !== new Date(m.ts).toDateString()
                  const grouped = i > 0 && String(msgs[i - 1].sender_id) === String(m.sender_id) && !showDate && m.ts - msgs[i - 1].ts < 5 * 60 * 1000
                  return (
                    <div key={m._id || i}>
                      {showDate && <div className="msg-day"><span>{dayLabel(m.ts)}</span></div>}
                      <div className={`msg-row ${mine ? 'mine' : 'theirs'}${grouped ? ' grouped' : ''}`}>
                        <div className={`bubble ${mine ? 'mine' : 'theirs'}`}>{m.body}</div>
                        {!grouped || i === msgs.length - 1 ? <div className="bubble-time">{fmt12(m.ts)}</div> : null}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <form className="msg-chat-footer" onSubmit={send}>
                <div className="msg-input-wrap">
                  <textarea
                    ref={inputRef}
                    placeholder={tr('Message {name}…', { name: activeInfo.full_name?.split(' ')[0] || tr('them') })}
                    value={text}
                    onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                    rows={1}
                    maxLength={2000}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e) } }}
                  />
                </div>
                <button type="submit" className="msg-send" disabled={!text.trim() || sending} aria-label={tr('Send')}>
                  {sending ? <span className="spin" /> : <IconSend size={18} />}
                </button>
              </form>
              <p className="msg-hint">{tr('Enter to send · Shift + Enter for a new line')}</p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

/** "9:41 AM" today, "Mon" this week, "Nov 3" before that */
function whenShort(ts) {
  const d = new Date(ts), now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  if (now - d < 6 * 864e5) return d.toLocaleDateString('en-PH', { weekday: 'short' })
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function dayLabel(ts) {
  const d = new Date(ts), now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return tr('Today')
  if (d.toDateString() === y.toDateString()) return tr('Yesterday')
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Ready-made first messages, depending on who is talking to whom. */
function startersFor(me, them) {
  const iWork = me?.account_type === 'worker'
  const theyWork = them?.account_type === 'worker'
  if (iWork && !theyWork) return [
    tr('Hello! I am interested in the job you posted.'),
    tr('Is the position still open?'),
    tr('When can I come for an interview?'),
  ]
  if (!iWork && theyWork) return [
    tr('Hi! Thank you for applying. Are you available for an interview?'),
    tr('Can you send photos of your past work?'),
    tr('When can you start?'),
  ]
  return [tr('Hello!'), tr('Good day! May I ask something?')]
}
