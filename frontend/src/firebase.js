// ─ Firebase Realtime Database (chat) ──────────────────────
// Chat messages are stored ONLY here, never in the MySQL database.
// The browser signs in to Firebase with a token issued by our API
// (POST /api/auth/firebase-token) so the security rules in
// firebase-database.rules.json can restrict each chat to its two users.
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
}

export const firebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.databaseURL)

let app = null
let db = null
let auth = null

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig)
  db = getDatabase(app)
  auth = getAuth(app)
}

/**
 * Sign in to Firebase as the current hanapbuhay user.
 * Resolves true when signed in as `userId`. Resolves false when the server has no
 * Firebase service account yet; chat then only works if the database rules are open.
 */
export async function ensureFirebaseAuth(call, userId) {
  if (!auth) return false
  if (auth.currentUser && auth.currentUser.uid === String(userId)) return true
  try {
    const r = await call('/auth/firebase-token', { method: 'POST' })
    if (!r?.token) return false
    await signInWithCustomToken(auth, r.token)
    return true
  } catch (e) {
    console.warn('[firebase] sign-in unavailable:', e?.message || e)
    return false
  }
}

export async function firebaseSignOut() {
  try { if (auth) await signOut(auth) } catch { /* ignore */ }
}
// auth.jsx calls this on sign-out without importing (and downloading) Firebase itself
globalThis.__hbFirebaseSignOut = firebaseSignOut

export { db }
export default app
