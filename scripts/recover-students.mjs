/**
 * Recover student records damaged by the photo-migration script.
 *
 * Background: the old migration cleanup wrote
 *   update(ref(db,'students'), { [id]: { photoUrl: null } })
 * update() treats each top-level key as a CHILD PATH and REPLACES the value
 * there (it does not merge deeper), so every photo-bearing student record was
 * replaced with `{ photoUrl: null }` — destroying name/class/phones/etc.
 *
 * This script rebuilds those students from surviving data:
 *   /attendance -> studentName, classId, className, date
 *   /exams      -> rows[studentId].studentName + rollNumber
 *   /absentAlerts -> name, className
 *   /classes    -> name + section lookup
 *   /studentPhotos -> photos (those were saved correctly and are untouched)
 *
 * It only ever writes to the per-student path (safe merge) and never modifies
 * the intact students.
 *
 * Fields that existed ONLY on the wiped records cannot be restored from the DB
 * (parentPhone, parentName, parentEmail, parentLanguage, address, gender,
 * age/dateOfBirth). Re-enter these manually or restore a Firebase backup.
 *
 * Usage:
 *   node scripts/recover-students.mjs            # dry-run, writes nothing
 *   node scripts/recover-students.mjs --apply    # rebuild missing students
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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'khandaqmadresah1234@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'KH1234'
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

function hasName(rec) {
  return rec && typeof rec.name === 'string' && rec.name.trim().length > 0
}

/** Per student we may know: name, rollNumber, classId, className, firstDate. */
const facts = new Map()
function addFact(id, key, value) {
  if (!id || value === undefined || value === null || value === '') return
  if (!facts.has(id)) facts.set(id, {})
  const f = facts.get(id)
  if (f[key] === undefined || f[key] === '') f[key] = value
}
/** Read a node, returning {} if it's missing or the rules deny the whole-node
 * read (e.g. studentPhotos before the root-level .read rule is published). */
async function safeRead(path) {
  try {
    const val = await readVal(path)
    return val
  } catch (err) {
    console.warn(`  ⚠ Could not read /${path}: ${err.message || err}`)
    return {}
  }
}

async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.', err.message || err)
    process.exit(1)
  }

  console.log(`Mode: ${APPLY ? 'APPLY (will write to the database)' : 'DRY-RUN (nothing will be written)'}`)
  console.log('Reading /students, /classes, /attendance, /exams, /absentAlerts, /studentPhotos ...')

  const [studentsVal, classesVal, attendanceVal, examsVal, alertsVal, photosVal, auditVal] = await Promise.all([
    safeRead('students'),
    safeRead('classes'),
    safeRead('attendance'),
    safeRead('exams'),
    safeRead('absentAlerts'),
    safeRead('studentPhotos'),
    safeRead('audit'),
  ])

  const classById = {}
  for (const [id, c] of Object.entries(classesVal)) classById[id] = c

  // ---- Collect best-effort facts per studentId from surviving nodes ----
  for (const rec of Object.values(attendanceVal)) {
    if (!rec || !rec.studentId) continue
    addFact(rec.studentId, 'name', rec.studentName)
    addFact(rec.studentId, 'classId', rec.classId)
    if (rec.className && !(rec.classId && classById[rec.classId])) {
      addFact(rec.studentId, 'className', rec.className)
    }
    const f = facts.get(rec.studentId)
    if (rec.date && (!f.firstDate || rec.date < f.firstDate)) {
      f.firstDate = rec.date
    }
  }

  for (const exam of Object.values(examsVal)) {
    if (!exam || !exam.rows) continue
    for (const [sid, row] of Object.entries(exam.rows)) {
      addFact(sid, 'name', row?.studentName)
      addFact(sid, 'rollNumber', row?.rollNumber)
    }
  }

  for (const [sid, alert] of Object.entries(alertsVal)) {
    addFact(sid, 'name', alert?.name)
    addFact(sid, 'className', alert?.className)
  }

  // Audit log: every student create/update logged { action, entity:'student',
  // entityId, details:<student name> }. For the students with a photo but no
  // name anywhere else, the audit trail is often the only surviving source.
  // Prefer a non-delete entry; prefer the newest create/update.
  const auditNames = new Map() // id -> { name, ts }
  for (const entry of Object.values(auditVal)) {
    if (!entry || entry.entity !== 'student' || !entry.entityId) continue
    if (entry.action === 'delete') continue
    const name = typeof entry.details === 'string' ? entry.details.trim() : ''
    if (!name) continue
    const ts = entry.timestamp || ''
    const prev = auditNames.get(entry.entityId)
    if (!prev || ts >= prev.ts) auditNames.set(entry.entityId, { name, ts })
  }
  for (const [id, { name }] of auditNames) {
    addFact(id, 'name', name)
  }
// ---- Which students are damaged/missing? ----
  // The destructive migration update() REPLACED each photo-bearing student with
  // { photoUrl: null } (which prunes to an empty node → the record was DELETED
  // entirely). So the victims are ids that:
  //   1) do NOT exist in /students at all (or exist without a name), AND
  //   2) HAVE a saved photo in /studentPhotos (the migration wrote those first,
  //      so /studentPhotos is a precise list of every student it touched).
  // ids absent from BOTH /students and /studentPhotos were deleted before this
  // incident and are never resurrected.
  const intact = []
  const damagedSet = new Set()
  const present = new Set(Object.keys(studentsVal))
  const photoIds = new Set(Object.keys(photosVal))

  for (const [id, rec] of Object.entries(studentsVal)) {
    if (hasName(rec)) intact.push(id)
    else damagedSet.add(id) // present but gutted (rare now)
  }
  for (const id of photoIds) {
    if (!present.has(id) || !hasName(studentsVal[id])) damagedSet.add(id)
  }

  console.log(`\n  Students currently intact     : ${intact.length}`)
  console.log(`  Students damaged/missing      : ${damagedSet.size}`)
  const withPhoto = [...damagedSet].filter((id) => photosVal[id]?.photo).length
  console.log(`  Damaged ids with a saved photo : ${withPhoto}`)

  // ---- Rebuild best-effort records ----
  const rebuilt = []
  const unresolved = []
  const nowIso = new Date().toISOString()

  for (const id of damagedSet) {
    const f = facts.get(id) || {}
    if (!f.name) {
      unresolved.push(id)
      continue
    }
    const cls = f.classId && classById[f.classId] ? classById[f.classId] : undefined
    const record = {
      id,
      name: f.name,
      isActive: true,
      createdAt: f.firstDate ? f.firstDate + 'T00:00:00.000Z' : nowIso,
      updatedAt: nowIso,
      createdBy: 'system:auto-recover',
    }
    if (cls) {
      record.classId = cls.id
      record.className = cls.name
      if (cls.section) record.section = cls.section
    } else if (f.classId) {
      record.classId = f.classId
      if (f.className) record.className = f.className
    } else if (f.className) {
      record.className = f.className
    }
    if (f.rollNumber) record.rollNumber = f.rollNumber
    rebuilt.push(record)
  }

  console.log(`\n  Rebuildable (name found) : ${rebuilt.length}`)
  if (unresolved.length) {
    console.log(`  Photo-only (no name found) : ${unresolved.length}`)
    console.log(`     -> they are NOT lost: each still has a saved photo in /studentPhotos.`)
    console.log(`     -> re-run WITH --apply --recover-unnamed to create placeholder records so`)
    console.log(`        they reappear in the roster (with their photo) for you to rename.`)
    unresolved.slice(0, 10).forEach((id) => console.log(`        - ${id}`))
    if (unresolved.length > 10) console.log(`        ... and ${unresolved.length - 10} more`)
  }

  // Write the planned rebuild to disk (even in dry-run) so it can be inspected.
  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const payload = {}
  rebuilt.forEach((r) => (payload[r.id] = r))
  // Include photo-only victims as placeholder records so the admin can see them.
  const RECOVER_UNNAMED = process.argv.slice(2).includes('--recover-unnamed')
  if (RECOVER_UNNAMED) {
    unresolved.forEach((id) => {
      if (!photosVal[id]?.photo) return
      payload[id] = {
        id,
        name: '(photo only — re-enter name)',
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: 'system:auto-recover-no-name',
      }
    })
  }
  const reportFile = join(BACKUP_DIR, `recovered-students-${ts}${APPLY ? '-applied' : '-dryrun'}.json`)
  writeFileSync(reportFile, JSON.stringify(payload, null, 2))
  console.log(`\nRecovery payload written to: ${reportFile}`)

  if (!APPLY) {
    console.log('\nDry-run complete. Inspect the payload, then re-run with:')
    console.log('  node scripts/recover-students.mjs --apply')
    console.log('  (add --recover-unnamed to ALSO create photo-only placeholder students)')
    process.exit(0)
  }

  // ---- Apply: update() at EACH STUDENT path. Top-level keys here are direct
  // child names of that student, so only those children change (safe merge). --
  let written = 0
  for (const [id, r] of Object.entries(payload)) {
    const { id: _id, ...fields } = r
    await update(ref(db, `students/${id}`), fields)
    written++
  }
  console.log(`\n✓ Applied ${written} recovered student record(s).`)

  // Re-read to confirm the roster size.
  const checkVal = await readVal('students')
  const named = Object.values(checkVal).filter((r) => hasName(r)).length
  const totalRecords = Object.keys(checkVal).length
  console.log(`✓ Verification: /students now contains ${totalRecords} record(s), ${named} with names.`)

  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Recovery failed:', err.message || err)
  process.exit(1)
})