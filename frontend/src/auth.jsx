import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'
import { requestGoogleToken } from './google.js'

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

export function AuthProvider({ children }) {
  const [tokens, setTokens] = useState(read)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

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
    call('/auth/me').then((r) => alive && setUser(r.user)).catch(() => { }).finally(() => alive && setReady(true))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accept = (r, remember = true) => {
    save({ access_token: r.tokens.access_token, refresh_token: r.tokens.refresh_token }, remember)
    setUser(r.user)
    return r
  }

  const value = {
    user, ready, tokens,
    call,
    login: async (email, password, remember = true) => accept(await api('/auth/login', { method: 'POST', body: { email, password } }), remember),
    register: async (form) => accept(await api('/auth/register', { method: 'POST', body: form })),
    google: async (account_type) => {
      const access_token = await requestGoogleToken()
      return accept(await api('/auth/google', { method: 'POST', body: { access_token, account_type } }))
    },
    chooseType: async (account_type) => {
      const r = await call('/auth/account-type', { method: 'POST', body: { account_type } })
      setUser(r.user)
      return r.user
    },
    updateUser: (u) => setUser((prev) => ({ ...prev, ...u })),
    logout: async () => {
      try { if (tokens) await api('/auth/logout', { method: 'POST', body: { refresh_token: tokens.refresh_token } }) } catch { /* ignore */ }
      save(null); setUser(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

