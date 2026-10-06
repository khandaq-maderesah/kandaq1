/**
 * Full database export (safety backup).
 *
 * Exports every top-level node to a timestamped local JSON file under backups/.
 * Run this BEFORE any migration, recovery, or destructive script.
 *
 * Usage:
 *   node scripts/backup-db.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const BACKUP_DIR = join(root, 'backups')

// Vercel build containers are temporary, so a local database dump would only
// add upload/build work and would not be retained after the build.
if (process.env.VERCEL === '1') {
  console.log('Skipping local database backup during Vercel build.')
  process.exit(0)
}

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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'ansarmadresah@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Ansarm@1234'

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})
const db = getDatabase(app)

// Top-level nodes to export.
const NODES = [
  'users',
  'classes',
  'students',
  'studentPhotos',
  'attendance',
  'absentAlerts',
  'missingAttendanceAlerts',
  'exams',
  'announcements',
  'audit',
  'settings',
]

async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.', err.message || err)
    process.exit(1)
  }

  const dump = {}
  let total = 0
  const skipped = []
  for (const node of NODES) {
    try {
      const snap = await get(ref(db, node))
      if (snap.exists()) {
        dump[node] = snap.val()
        const count = Object.keys(snap.val()).length
        total += count
        console.log(`  ${node.padEnd(28)} ${count}`)
      } else {
        console.log(`  ${node.padEnd(28)} (empty)`)
      }
    } catch (err) {
      skipped.push(node)
      console.log(`  ${node.padEnd(28)} (skipped: ${err.message || err})`)
    }
  }

  if (skipped.length) {
    console.log(`\n⚠ ${skipped.length} node(s) could not be read (permission denied): ${skipped.join(', ')}`)
    console.log('  Publish the updated database.rules.json (studentPhotos root .read) then re-run to get them.')
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const file = join(BACKUP_DIR, `rtdb-${ts}.json`)
  writeFileSync(file, JSON.stringify(dump, null, 2))
  console.log(`\n✓ Backup written: ${file}`)
  console.log(`  Total records: ${total}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Backup failed:', err.message || err)
  process.exit(1)
})