/**
 * Backfill `createdByName` / `createdByRole` on student records that are
 * missing them, by resolving `createdBy` (the Firebase auth UID) against the
 * `/users` node.
 *
 * Why: the student card shows "Created By" from `createdByName` when present.
 * Older records (and CSV-imported / teacher-registered students) sometimes only
 * stored the raw auth UID, which made the card show gibberish like
 * "9pE8DIgi...". Teachers also can't read the full /users node, so resolving
 * the name up-front and storing it on the student fixes every view.
 *
 * Safety: writes ONLY `createdByName` / `createdByRole` at the per-student path
 * (safe child merge) for students that are missing both.
 *
 * Usage:
 *   node scripts/backfill-createdByName.mjs            # dry-run
 *   node scripts/backfill-createdByName.mjs --apply    # write
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get, update } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const BACKUP_DIR = join(root, 'backups')

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
const APPLY = process.argv.slice(2).includes('--apply')

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

async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in.', err.message || err)
    process.exit(1)
  }

  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY-RUN (nothing written)'}`)

  const [students, users, classes] = await Promise.all([
    readVal('students'),
    readVal('users'),
    readVal('classes'),
  ])
  const userById = new Map(Object.entries(users).map(([uid, u]) => [uid, u]))
  const classById = new Map(Object.entries(classes).map(([id, c]) => [id, c]))

  const updates = {}
  let needName = 0
  let classTeacher = 0
  let fromUsers = 0
  let knownSystem = 0
  let unresolved = 0

  for (const [id, s] of Object.entries(students)) {
    if (!s) continue
    const hasName = s.createdByName && String(s.createdByName).trim() !== ''
    if (hasName) continue
    needName++

    let name = ''
    let role = ''

    const cls = s.classId ? classById.get(s.classId) : undefined
    const teacherId = cls?.teacherId
    const teacherName = cls?.teacherName

    if (teacherId) {
      const u = userById.get(teacherId)
      if (u && u.name && String(u.name).trim()) {
        name = `Ustaz ${String(u.name).trim()}`
        role = 'teacher'
        classTeacher++
      }
    }
    if (!name && teacherName && String(teacherName).trim()) {
      name = `Ustaz ${teacherName}`
      role = 'teacher'
      classTeacher++
    }
    if (!name) {
      const by = s.createdBy || ''
      if (by === 'admin') {
        name = 'Admin'
        role = 'admin'
      } else if (by === 'system:auto-recover') {
        name = 'System (auto-recovered)'
        role = 'system'
        knownSystem++
      } else {
        const u = userById.get(by)
        if (u && u.name) {
          name = String(u.name)
          role = u.role === 'teacher' ? 'teacher' : 'admin'
          fromUsers++
        } else {
          unresolved++
        }
      }
    }

    if (name) updates[id] = { createdByName: name, createdByRole: role }
  }

  console.log(`\nstudents missing createdByName  : ${needName}`)
  console.log(`  class-assigned ustaz          : ${classTeacher}`)
  console.log(`  resolved from /users (create) : ${fromUsers}`)
  console.log(`  known system/admin            : ${knownSystem}`)
  console.log(`  unresolved (deleted account)  : ${unresolved} -> will show 'Admin'`)

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportFile = join(BACKUP_DIR, `backfill-createdByName-${ts}${APPLY ? '-applied' : '-dryrun'}.json`)
  writeFileSync(reportFile, JSON.stringify(updates, null, 2))
  console.log(`\nPlan written to: ${reportFile}`)

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write.')
    process.exit(0)
  }

  let written = 0
  for (const [id, fields] of Object.entries(updates)) {
    await update(ref(db, `students/${id}`), fields)
    written++
  }
  console.log(`\n✓ Wrote ${written} student record(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Failed:', err.message || err)
  process.exit(1)
})