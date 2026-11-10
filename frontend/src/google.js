const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '251811791555-mvl6ocpp50plffnudmqk8lnr5fnj106l.apps.googleusercontent.com'
let loading

function loadGsi() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Couldn’t load Google. Check your connection.'))
    document.head.appendChild(s)
  })
  return loading
}

// Opens the Google popup and resolves with an access token.
export async function requestGoogleToken() {
  if (!CLIENT_ID) throw new Error('Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).')
  await loadGsi()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'openid email profile',
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error('Google sign-in was cancelled.'))),
      error_callback: (e) =>
        reject(new Error(e?.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed. Allow popups and try again.')),
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}
