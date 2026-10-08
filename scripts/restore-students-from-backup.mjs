/**
 * Restore student records (and ONLY students) from a Firebase RTDB export file.
 *
 * Use this when you obtain a pre-migration backup of the database:
 *   - A Cloud Storage backup JSON from "Automated backups", or
 *   - Any export taken earlier (Console → Data tab → ⋮ → Export JSON), or
 *   - The rtdb-*.json files our own backup:db script created.
 *
 * The file should either be a full RTDB export ({ "students": {…}, … }) or a
 * file whose top-level keys are student ids. For each id present in the file:
 *   - if the id is missing or damaged in the live DB, the record is written
 *     back with update() at the STUDENT path (safe child merge — never
 *     overwrites other nodes/fields);
 *   - if the live student is intact, ONLY the extra fields that exist in the
 *     backup (parentPhone, parentEmail, etc.) are added/fixed, and the live
 *     record's current fields are preserved.
 *
 * Usage:
 *   node scripts/restore-students-from-backup.mjs <backup.json>            # dry-run
 *   node scripts/restore-students-from-backup.mjs <backup.json> --apply
 *
 * .gz files are decompressed automatically.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { gunzipSync } from 'zlib'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get, update } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const BACKUP_DIR = join(root, 'backups')

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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'khendeqmedresah1@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'KH1234'
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const APPLY = process.argv.slice(2).includes('--apply')

if (!fileArg) {
  console.error('Usage: node scripts/restore-students-from-backup.mjs <backup.json[.gz]> [--apply]')
  process.exit(1)
}

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

async function readVal(path) {
  const snap = await get(ref(db, path))
  return snap.exists() ? snap.val() : {}
}

function hasName(rec) {
  return rec && typeof rec.name === 'string' && rec.name.trim().length > 0
}

function parseBackupFile(path) {
  let raw
  if (path.endsWith('.gz')) raw = gunzipSync(readFileSync(path))
  else raw = readFileSync(path, 'utf8')
  const data = JSON.parse(raw)
  // Accept both { students: {..} } full exports and bare { id: rec } objects.
  if (data.students && typeof data.students === 'object' && !Array.isArray(data.students)) {
    return data.students
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data
  }
  throw new Error('Could not find a "students" record collection in the file.')
}
async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.', err.message || err)
    process.exit(1)
  }

  console.log(`\nReading backup: ${fileArg}`)
  const backup = parseBackupFile(fileArg)
  const backupIds = Object.keys(backup)
  console.log(`  backup contains ${backupIds.length} student record(s)`)

  const live = await readVal('students')
  console.log(`  live /students contains ${Object.keys(live).length} record(s)`)

  const toWrite = []
  let willAdd = 0 // missing entirely
  let willFix = 0 // exists but comes back with more/healthier fields
  let skip = 0 // exists and matches (nothing to add)

  for (const id of backupIds) {
    const rec = backup[id]
    if (!rec || typeof rec !== 'object') continue
    const liveRec = live[id]

    if (!liveRec) {
      toWrite.push({ id, fields: { id, ...rec } })
      willAdd++
      continue
    }
    if (!hasName(liveRec) && hasName(rec)) {
      toWrite.push({ id, fields: rec })
      willFix++
      continue
    }
    // Exists and already named: only backfill fields the live record lacks.
    const missing = {}
    for (const [k, v] of Object.entries(rec)) {
      if (v === null || v === undefined || v === '') continue
      const hasInLive = k in liveRec && liveRec[k] !== undefined && liveRec[k] !== null && liveRec[k] !== ''
      if (!hasInLive) missing[k] = v
    }
    if (Object.keys(missing).length) {
      toWrite.push({ id, fields: missing })
      willFix++
    } else {
      skip++
    }
  }

  console.log(`  to add (missing)      : ${willAdd}`)
  console.log(`  to fix/enrich (merge) : ${willFix}`)
  console.log(`  already matching      : ${skip}`)

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const payload = {}
  toWrite.forEach(({ id, fields }) => (payload[id] = fields))
  const reportFile = join(BACKUP_DIR, `restored-students-${ts}${APPLY ? '-applied' : '-dryrun'}.json`)
  writeFileSync(reportFile, JSON.stringify(payload, null, 2))
  console.log(`\nPlan written to: ${reportFile}`)

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write.')
    process.exit(0)
  }

  let written = 0
  for (const { id, fields } of toWrite) {
    // SAFE: update at the STUDENT path; only listed child keys change.
    await update(ref(db, `students/${id}`), fields)
    written++
  }
  console.log(`\n✓ Wrote ${written} student update(s).`)

  const check = await readVal('students')
  const named = Object.values(check).filter((r) => hasName(r)).length
  const withPhone = Object.values(check).filter(
    (r) => typeof r.parentPhone === 'string' && r.parentPhone.trim() !== ''
  ).length
  console.log(
    `✓ Verification: ${Object.keys(check).length} students, ${named} named, ${withPhone} with parentPhone.`
  )
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Failed:', err.message || err)
  process.exit(1)
})