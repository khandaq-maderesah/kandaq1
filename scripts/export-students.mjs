/**
 * Export the current /students roster to a CSV you can fill in.
 *
 * Produces a spreadsheet (UTF-8 with BOM so Excel opens it correctly) with one
 * row per student and ALL known fields, including the internal `studentId`
 * column that `apply-student-csv.mjs` needs to write updates back.
 *
 * Usage:
 *   npm run export:students          # writes backups/students-export-<ts>.csv
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

const COLUMNS = [
  'studentId', // internal id — required for writing updates back
  'name',
  'rollNumber',
  'gender',
  'className',
  'section',
  'isActive',
  'parentPhone',
  'alternativePhone',
  'parentName',
  'parentEmail',
  'parentRelationship',
  'parentLanguage',
  'age',
  'dateOfBirth',
  'address',
  'city',
  'createdByName',
  'createdAt',
  'updatedAt',
]

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

async function main() {
  try {
    await signInWithEmailAndPassword(getAuth(app), ADMIN_EMAIL, ADMIN_PASSWORD)
    console.log('✓ Signed in as:', ADMIN_EMAIL)
  } catch (err) {
    console.error('✗ Could not sign in.', err.message || err)
    process.exit(1)
  }

  const snap = await get(ref(db, 'students'))
  if (!snap.exists()) {
    console.log('No students found.')
    process.exit(0)
  }

  const rows = [COLUMNS.join(',')]
  let count = 0
  snap.forEach((child) => {
    const s = child.val() || {}
    // The student id is the NODE KEY, not a stored field — export it as such.
    const row = COLUMNS.map((c) => esc(c === 'studentId' ? child.key : (s[c] ?? ''))).join(',')
    rows.push(row)
    count++
  })

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const file = join(BACKUP_DIR, `students-${ts}.csv`)
  // UTF-8 BOM so Excel opens it without mojibake.
  writeFileSync(file, '\uFEFF' + rows.join('\r\n'))
  console.log(`✓ Exported ${count} student(s) to:`)
  console.log(`  ${file}`)
  console.log('\nTo fill in missing info: open the CSV in Excel, add the parent')
  console.log('phones / other fields, save it, then run:')
  console.log('  npm run apply:students -- <path-to-csv>            (dry-run)')
  console.log('  npm run apply:students -- <path-to-csv> --apply    (write)')
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Export failed:', err.message || err)
  process.exit(1)
})