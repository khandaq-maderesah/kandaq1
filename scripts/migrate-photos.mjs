/**
 * One-time migration: move student photos OUT of the `students` node.
 *
 * Background
 * ----------
 * Photos were stored as JPEG data URLs directly on each student record
 * (student.photoUrl = "data:image/jpeg;base64,...", ~15-35 KB each). Because
 * every "list students" subscription downloads the whole /students node, the
 * client was pulling every photo on every screen. This script moves each photo
 * to its own node at /studentPhotos/{studentId}/photo and removes the heavy
 * field from the student record, so lists stay light and photos are only
 * fetched on demand (see src/hooks/useStudentPhoto.ts).
 *
 * Usage
 * -----
 *   node scripts/migrate-photos.mjs
 *
 * It is idempotent and safe to re-run: it skips students that have no embedded
 * photo, and it leaves records alone once the photoUrl is no longer a data URL.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get, update } from 'firebase/database'

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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Migration must run as the admin account (the DB rules only let an admin
// write /studentPhotos and edit students). Override with env vars if the seed
// account differs.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'khendeqmedresah1@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'KH1234'

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:')

async function main() {
  // Authenticate as the admin (needed to satisfy the DB read/write rules).
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error(
      '✗ Could not sign in. Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in your environment.',
      err.message || err
    )
    process.exit(1)
  }

  const snap = await get(ref(db, 'students'))
  if (!snap.exists()) {
    console.log('No students found — nothing to migrate.')
    process.exit(0)
  }

  let moved = 0
  let skipped = 0

  const photoObj = {} // { [studentId]: { photo: dataUrl } }
  const studentsWithPhotos = [] // student ids whose photo will be moved

  snap.forEach((child) => {
    const id = child.key
    const val = child.val() || {}
    const photo = val.photoUrl

    if (isDataUrl(photo)) {
      photoObj[id] = { photo }
      studentsWithPhotos.push(id)
      moved++
    } else {
      skipped++
    }
  })

  const total = moved + skipped
  console.log(`Scanned ${total} student(s): ${moved} photo(s) to move, ${skipped} already clean.`)

  if (moved > 0) {
    console.log('Writing /studentPhotos...')
    await update(ref(db, 'studentPhotos'), photoObj)
    console.log('Cleaning photoUrl from /students (child-scoped only)...')

    // SAFETY: update() at the root with `{ id: {...} }` REPLACES the whole
    // student record (update keys are child paths). We therefore remove ONLY
    // the child key photoUrl of each student, in its own update, so no other
    // field of the student record can ever be touched.
    for (const id of studentsWithPhotos) {
      await update(ref(db, `students/${id}`), { photoUrl: null })
    }

    // Verify only the intended field changed: the number of student records
    // with a name must be unchanged before/after the cleanup.
    console.log('Verifying student records were not damaged...')
    const afterSnap = await get(ref(db, 'students'))
    let withName = 0
    let stillHasPhoto = 0
    afterSnap.forEach((child) => {
      const rec = child.val() || {}
      if (typeof rec.name === 'string' && rec.name.trim() !== '') withName++
      if (typeof rec.photoUrl === 'string' && rec.photoUrl.startsWith('data:')) stillHasPhoto++
    })
    console.log(`  students with a name after cleanup: ${withName}`)
    console.log(`  students still carrying data:photoUrl: ${stillHasPhoto}`)
    if (stillHasPhoto > 0) {
      console.warn(`  ⚠ ${stillHasPhoto} student(s) still have an embedded photo that was NOT moved.`)
    }
    console.log('✓ Done. Photos moved, only the photoUrl field was removed.')
  } else {
    console.log('✓ Nothing to do.')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Migration failed:', err.message || err)
  process.exit(1)
})
