/**
 * Seed the initial "super" admin account.
 *
 * Creates (or updates) the admin user in Firebase Authentication and writes
 * their profile (role: 'admin') to the Realtime Database at /users/{uid}.
 *
 * The account has "overall" access and can be used to create other admins
 * and teachers from the /admin/teachers page.
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *
 * You can override the account via environment variables:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get, set } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// --- Load .env.local into process.env (Node doesn't auto-load dotfiles) ---
function loadEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      if (process.env[key] === undefined) process.env[key] = value
    }
  } catch (err) {
    console.warn('Could not read .env.local:', err.message)
  }
}
loadEnvFile(join(root, '.env.local'))

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'khendeqmedresah1@gmail.com'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'KH1234'
const NAME = process.env.SEED_ADMIN_NAME || 'Khendeq Medresah Admin'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getDatabase(app)

async function main() {
  try {
    let uid

    // 1) Create the auth user, or sign in if the email is already registered.
    try {
      const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD)
      uid = cred.user.uid
      console.log('✓ Created new auth user:', uid)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD)
        uid = cred.user.uid
        console.log('• Admin auth user already exists (signed in):', uid)
      } else {
        throw err
      }
    }

    // 2) Write (or refresh) the admin profile in Realtime Database.
    const userRef = ref(db, `users/${uid}`)
    const existing = (await get(userRef)).val() || {}

    await set(userRef, {
      uid,
      email: EMAIL,
      name: NAME,
      role: 'admin',
      status: 'active',
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: existing.createdBy || uid,
    })

    console.log('✓ Admin profile written to Realtime Database (role: admin)')
    console.log('  Email:    ' + EMAIL)
    console.log('  Password: ' + PASSWORD)
    console.log('  You can now sign in at /login with full admin access.')
    process.exit(0)
  } catch (err) {
    console.error('✗ Seed failed:', err.message || err)
    process.exit(1)
  }
}

main()
