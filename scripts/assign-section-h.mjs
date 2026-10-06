// Assign the photo-only students to Section H on their class.
// Matches by the '(photo only...' placeholder name or missing name + a saved
// photo, updates ONLY `section` (and `className` if it's missing) per student.
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get, update } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const BACKUP_DIR = join(root, 'backups')

function loadEnvFile(p) {
  try {
    const c = readFileSync(p, 'utf8')
    for (const l of c.split(/\r?\n/)) {
      const line = l.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {}
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

function isPhotoOnly(s) {
  if (!s || !s.name) return false
  return /photo only/i.test(String(s.name))
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
  const [students, classes] = await Promise.all([readVal('students'), readVal('classes')])

  const TARGET_SECTION = 'H'
  const TARGET_CLASS_NAME = 'Grade 1'
  const targets = [] // { id }
  const sectionHClass = Object.entries(classes).find(
    ([cid, c]) =>
      String(c.name || '').trim().toLowerCase() === TARGET_CLASS_NAME.toLowerCase() &&
      String((c.section ?? '').toString()).trim().toUpperCase() === TARGET_SECTION
  )

  if (!sectionHClass) {
    console.error(`No class found for '${TARGET_CLASS_NAME} / Section ${TARGET_SECTION}'.`)
    process.exit(1)
  }
  const classIdH = sectionHClass[0]
  const classNameH = sectionHClass[1].name
  console.log(`Target class: ${classNameH} ${sectionHClass[1].section ? `Section ${sectionHClass[1].section}` : ''} (${classIdH})`)

  for (const [id, s] of Object.entries(students)) {
    if (!s) continue
    if (!isPhotoOnly(s) && !(s.name === undefined && s.photoUrl)) continue
    targets.push(id)
  }

  const unique = targets.filter((id, i) => targets.indexOf(id) === i)
  console.log(`photo-only students to assign to ${TARGET_CLASS_NAME} Section ${TARGET_SECTION}: ${unique.length}`)

  const updates = {}
  unique.forEach((id) => {
    updates[id] = {
      section: TARGET_SECTION,
      classId: classIdH,
      className: classNameH,
    }
  })

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportFile = join(BACKUP_DIR, `assign-sectionH-${ts}${APPLY ? '-applied' : '-dryrun'}.json`)
  writeFileSync(reportFile, JSON.stringify(updates, null, 2))
  console.log(`Plan written to: ${reportFile}`)

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write.')
    process.exit(0)
  }

  let written = 0
  for (const [id, fields] of Object.entries(updates)) {
    await update(ref(db, `students/${id}`), fields)
    written++
  }
  console.log(`✓ Wrote ${written} student(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Failed:', err.message || err)
  process.exit(1)
})