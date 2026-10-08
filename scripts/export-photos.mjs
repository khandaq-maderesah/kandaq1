/**
 * Export ALL student photos as real image files to disk.
 *
 * Photos live in Firebase Realtime Database at /studentPhotos/{studentId}/photo
 * as JPEG data-URLs (that's how the app serves them). This script downloads
 * every photo, decodes it, and writes a .jpg file named:
 *
 *     backups/student-photos/<studentId>__<studentName>.jpg
 *
 * plus a manifest CSV mapping each student to their photo file, so you can:
 *   - browse/backup every photo,
 *   - identify the 65 'photo only' students (their record needs a name), and
 *   - cross-reference with needs-parent-phone.csv.
 *
 * Usage:
 *   npm run export:photos
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getDatabase, ref, get } from 'firebase/database'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const OUT_DIR = join(root, 'backups', 'student-photos')

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

/** Decode a data URL like "data:image/jpeg;base64,...." -> { ext, buffer }. */
function dataUrlToFile(dataUrl) {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl || '')
  if (!m) return null
  const mime = m[1]
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  return { ext, buffer: Buffer.from(m[2], 'base64') }
}

function safeName(name) {
  return String(name || 'no-name')
    .replace(/[^\w\u0600-\u06FF\u1200-\u137F]+/g, '_')
    .trim()
    .slice(0, 60)
}

async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in.', err.message || err)
    process.exit(1)
  }

  const [studentsSnap, photosSnap] = await Promise.all([
    get(ref(db, 'students')),
    get(ref(db, 'studentPhotos')),
  ])
  const students = studentsSnap.exists() ? studentsSnap.val() : {}
  const photos = photosSnap.exists() ? photosSnap.val() : {}

  mkdirSync(OUT_DIR, { recursive: true })

  const photoIds = Object.keys(photos)
  console.log(`\nphotos on record: ${photoIds.length}`)

  const manifest = []
  let written = 0
  let missing = 0
  let totalKB = 0

  for (const id of photoIds) {
    const entry = photos[id]
    const dataUrl = entry && entry.photo ? entry.photo : null
    const student = students[id] || {}
    const name = safeName(student.name || 'photo-only')

    if (!dataUrl) {
      missing++
      console.log(`  ⚠ ${id} (${name}): no photo value`)
      continue
    }

    const file = dataUrlToFile(dataUrl)
    if (!file) {
      missing++
      console.log(`  ⚠ ${id} (${name}): photo is not a base64 data URL`)
      continue
    }

    const filename = `${safeName(id)}__${name}.${file.ext}`
    writeFileSync(join(OUT_DIR, filename), file.buffer)
    written++
    totalKB += file.buffer.length / 1024
    manifest.push({
      studentId: id,
      name: student.name || '(photo only — re-enter name)',
      className: student.className || '',
      photoFile: filename,
    })
  }

  const manifestPath = join(root, 'backups', 'student-photos-manifest.csv')
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = ['studentId,name,className,photo']
  manifest.forEach((r) => lines.push([r.studentId, r.name, r.className, r.photo].map(esc).join(',')))
  writeFileSync(manifestPath, '\uFEFF' + lines.join('\r\n'))

  console.log(`\n✓ Wrote ${written} photo file(s) to:`)
  console.log(`  ${OUT_DIR}`)
  console.log(`  (total ~${Math.round(totalKB).toLocaleString()} KB)`)
  console.log(`\n✓ Manifest CSV:`)
  console.log(`  ${manifestPath}`)
  if (missing) console.log(`⚠ ${missing} photo id(s) had no usable image.`)

  const photoOnly = manifest.filter((r) => r.name.includes('photo only') || r.name === 'photo-only')
  console.log(`\nPhoto-only students (need a name): ${photoOnly.length}`)
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Export failed:', err.message || err)
  process.exit(1)
})