import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'
import { requestGoogleToken } from './google.js'
// Firebase (chat) is only downloaded when Messages is opened, so it is not imported here.
// On sign-out, end its session through the SDK if it was loaded; otherwise delete the
// session Firebase saved in the browser, so the next person on this phone can't reuse it.
function firebaseSignOut() {
  if (globalThis.__hbFirebaseSignOut) return globalThis.__hbFirebaseSignOut()
  try { indexedDB.deleteDatabase('firebaseLocalStorageDb') } catch { /* private mode etc. */ }
}

/**
 * Everything one account leaves in the browser, cleared on sign-out and whenever a different
 * account signs in on the same device: chat sign-in, cached photos, saved filters, drafts.
 * Pages also remount per account (Dashboard is keyed by user id), so no page keeps the
 * previous person's messages, applicants or billing on screen.
 */
const KEEP = new Set(['hanapbuhay_lang', 'hb_install_dismissed_until', 'hb_cookie_notice'])
function clearAccountState() {
  firebaseSignOut()
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store).forEach(k => {
        if (k === 'hb_tokens' || k === 'hb_user' || KEEP.has(k)) return
        if (k.startsWith('hb_') || k.startsWith('hb-') || k.startsWith('hanapbuhay_saved')) store.removeItem(k)
      })
    } catch { /* storage blocked */ }
  }
  try { window.dispatchEvent(new CustomEvent('hb:signed-out')) } catch { /* ignore */ }
}

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

const KEY = 'hb_tokens'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY)) } catch { return null } }
// remember=true -> localStorage (stays signed in); false -> sessionStorage (until tab closes)
const write = (t, remember) => {
  try {
    const target = remember === undefined ? (sessionStorage.getItem(KEY) ? sessionStorage : localStorage) : (remember ? localStorage : sessionStorage)
    localStorage.removeItem(KEY); sessionStorage.removeItem(KEY)
    if (t) target.setItem(KEY, JSON.stringify(t))
  } catch { /* storage blocked */ }
}

// The signed-in user is also kept next to the tokens, so a returning visitor sees the app
// at once instead of a loading screen while the server answers /auth/me (on Render's free
// plan a sleeping server takes 30–60 s to wake). /auth/me still runs in the background:
// it refreshes these details, and a rejected session signs the person out.
const UKEY = 'hb_user'
const readUser = () => { try { return JSON.parse(localStorage.getItem(UKEY) || sessionStorage.getItem(UKEY)) } catch { return null } }
const writeUser = (u) => {
  try {
    localStorage.removeItem(UKEY); sessionStorage.removeItem(UKEY)
    if (!u) return
    const store = sessionStorage.getItem(KEY) ? sessionStorage : localStorage
    try { store.setItem(UKEY, JSON.stringify(u)) }
    catch { store.setItem(UKEY, JSON.stringify({ ...u, picture: null })) } // big photo over the storage quota
  } catch { /* storage blocked */ }
}

export function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(read)
  const [user, setUserState] = useState(() => (read() ? readUser() : null))
  // ready = we know who is signed in (from the saved session, or the server's answer)
  const [signedOut, setSignedOut] = useState(false)
  const [ready, setReady] = useState(() => !read() || !!readUser())

  const setUser = useCallback((u) => {
    setUserState(prev => {
      const next = typeof u === 'function' ? u(prev) : u
      writeUser(next)
      return next
    })
  }, [])

  const save = useCallback((t, remember) => { write(t, remember); setTokens(t) }, [])

  // authenticated call with one automatic refresh on 401
  const call = useCallback(async (path, opts = {}) => {
    const cur = tokens || read()
    try {
      return await api(path, { ...opts, token: cur?.access_token })
    } catch (e) {
      if (e.status === 401 && cur?.refresh_token) {
        try {
          const r = await api('/auth/refresh', { method: 'POST', body: { refresh_token: cur.refresh_token } })
          if (r?.tokens?.access_token) {
            const t = { access_token: r.tokens.access_token, refresh_token: r.tokens.refresh_token }
            save(t)
            return await api(path, { ...opts, token: t.access_token })
          }
        } catch {
          save(null)
          setUser(null)
        }
      }
      throw e
    }
  }, [tokens, save])

  useEffect(() => {
    let alive = true
    if (!tokens) { setReady(true); return }
    call('/auth/me')
      .then((r) => { if (alive && r?.user) setUser(r.user) })
      .catch((e) => {
        // the server rejected the session (call() already tried the refresh token): sign out.
        // A network error or a slow-waking server keeps the saved session on screen.
        if (alive && e?.status === 401) { save(null); setUser(null) }
      })
      .finally(() => alive && setReady(true))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accept = (r, remember = true) => {
    setSignedOut(false)
    if (!r?.tokens?.access_token) throw new Error(r?.error || 'Sign-in did not complete. Please try again.')
    // a different account on this device: drop whatever the last one left behind
    const last = readUser()
    if (last && r.user && Number(last.id) !== Number(r.user.id)) clearAccountState()
    save({ access_token: r.tokens.access_token, refresh_token: r.tokens.refresh_token }, remember)
    setUser(r.user)
    return r
  }

  const value = {
    user, ready, tokens, signedOut,
    call,
    login: async (email, password, remember = true) => accept(await api('/auth/login', { method: 'POST', body: { email, password } }), remember),
    register: async (form) => accept(await api('/auth/register', { method: 'POST', body: form })),
    verifyEmail: async (token) => accept(await api('/auth/verify-email', { method: 'POST', body: { token } })),
    google: async (account_type, accept_terms = false) => {
      const access_token = await requestGoogleToken()
      return accept(await api('/auth/google', { method: 'POST', body: { access_token, account_type, accept_terms } }))
    },
    // the Terms or Privacy Policy changed since this account last agreed
    acceptTerms: async () => {
      const r = await call('/auth/accept-terms', { method: 'POST', body: { accept: true } })
      if (r?.user) setUser(r.user)
      return r
    },
    chooseType: async (account_type) => {
      const r = await call('/auth/account-type', { method: 'POST', body: { account_type } })
      setUser(r.user)
      return r.user
    },
    updateUser: (u) => setUser((prev) => ({ ...prev, ...u })),
    // The server signs out every other device and returns fresh tokens for this one
    changePassword: async (current_password, new_password) => {
      const r = await call('/auth/change-password', { method: 'POST', body: { current_password, new_password } })
      if (r?.tokens?.access_token) save({ access_token: r.tokens.access_token, refresh_token: r.tokens.refresh_token })
      if (r?.user) setUser(r.user)
      return r
    },
    logout: async () => {
      try { if (tokens) await api('/auth/logout', { method: 'POST', body: { refresh_token: tokens.refresh_token } }) } catch { /* ignore */ }
      clearAccountState()
      setSignedOut(true)   // the next sign-in starts at the dashboard, not at the page the last person was on
      save(null); setUser(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

