import { initializeApp } from 'firebase/app'
import { getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase in the BROWSER only.
//
// During `next build` (static prerendering / SSG) this module is evaluated on
// the server, where `window` is undefined and the NEXT_PUBLIC_* env vars may
// not be present. Initializing Firebase there would throw
// (auth/invalid-api-key) and break the build. By guarding on `window`, the
// build/SSG never touches Firebase, while the running browser app initializes
// it normally with the deployed env vars.

let _app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Database | null = null

if (typeof window !== 'undefined') {
  try {
    _app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
    _auth = getAuth(_app)
    _db = getDatabase(_app)

    // PWA & Mobile Native Experience: Keep Ustaz/Admin signed in across app reopens.
    // Use LOCAL persistence so the user stays logged in even when the app or window is closed.
    setPersistence(_auth, browserLocalPersistence).catch((err) => {
      console.warn('Could not set browserLocalPersistence:', err)
    })
  } catch (err) {
    console.error('Firebase initialization failed. Check NEXT_PUBLIC_FIREBASE_* env vars.', err)
  }
}

// The `auth`/`db` below are used by the app inside browser event handlers, so
// non-null assertion is safe: they are populated synchronously above whenever
// the app runs in a browser.
export const auth: Auth = _auth!
export const db: Database = _db!
export const app: FirebaseApp = _app!

export default app
