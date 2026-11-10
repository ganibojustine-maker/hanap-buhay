// ─ Firebase Configuration ─────────────────────────────────
// HanapBuhay Real-time Messaging via Firebase Realtime Database
//
// HOW TO SET UP (one-time, 5 minutes):
//  1. Go to https://console.firebase.google.com
//  2. Create a new project named "hanapbuhay"
//  3. Add a Web App → copy the firebaseConfig values below
//  4. Go to "Realtime Database" → Create database → Start in test mode
//  5. Replace the values below with your actual config
//
import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
}

// Check if Firebase is configured
export const firebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.databaseURL)

let app = null
let db  = null

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig)
  db  = getDatabase(app)
}

export { db }
export default app
