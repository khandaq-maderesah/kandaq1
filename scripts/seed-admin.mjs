/**
 * Seed the platform superadmin account.
 *
 * Creates (or updates) the user in Firebase Authentication and writes their
 * profile (role: 'superadmin', no school) to the Realtime Database at
 * /users/{uid}. The superadmin creates schools and each school's admin from
 * the /superadmin page.
 *
 * Uses the Firebase Admin SDK with your Google credentials, so no password is
 * stored or printed: a new account gets a random password and Firebase emails
 * the admin a "reset password" link to choose their own.
 *
 * Prerequisites:
 *   gcloud auth application-default login   (account with access to the project)
 *   .env.local with NEXT_PUBLIC_FIREBASE_* values
 *
 * Usage:
 *   node scripts/seed-admin.mjs
 *
 * Overrides: SEED_ADMIN_EMAIL, SEED_ADMIN_NAME
 */

import { readFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

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

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'abduha2222@gmail.com'
const NAME = process.env.SEED_ADMIN_NAME || 'Platform Admin'
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
})
const auth = getAuth(app)
const db = getDatabase(app)

/** Ask Firebase to email a password-reset link to the admin. */
async function sendResetEmail(email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    }
  )
  if (!res.ok) throw new Error(`Could not send reset email: ${await res.text()}`)
}

async function main() {
  try {
    // 1) Find or create the auth user.
    let user
    let created = false
    try {
      user = await auth.getUserByEmail(EMAIL)
      console.log('• Admin auth user already exists:', user.uid)
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err
      user = await auth.createUser({
        email: EMAIL,
        password: randomBytes(24).toString('base64url'),
        displayName: NAME,
      })
      created = true
      console.log('✓ Created new auth user:', user.uid)
    }
    const uid = user.uid

    // 2) Write (or refresh) the admin profile in Realtime Database.
    const userRef = db.ref(`users/${uid}`)
    const existing = (await userRef.get()).val() || {}
    const { schoolId: _ignored, ...rest } = existing
    await userRef.set({
      ...rest,
      uid,
      email: EMAIL,
      name: existing.name || NAME,
      role: 'superadmin',
      status: 'active',
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: existing.createdBy || uid,
    })
    // Mirror the role into the ID token (Storage rules read it).
    await auth.setCustomUserClaims(uid, { role: 'superadmin' })
    console.log('✓ Profile written to Realtime Database (role: superadmin)')

    // 3) New account: email a link so the admin sets their own password.
    if (created) {
      await sendResetEmail(EMAIL)
      console.log(`✓ Password setup email sent to ${EMAIL}`)
      console.log('  Open the link in that email, choose a password, then sign in at /login.')
    } else {
      console.log('  Existing password unchanged. Use "Forgot password" on /login if needed.')
    }
    process.exitCode = 0
    return
  } catch (err) {
    console.error('✗ Seed failed:', err.message || err)
    process.exit(1)
  }
}

main()
