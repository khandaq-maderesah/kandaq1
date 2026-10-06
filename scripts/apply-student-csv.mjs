/**
 * Apply a filled-in student CSV back to the database.
 *
 * Reads a CSV produced by `export-students.mjs` (or any CSV with a studentId
 * column). For each row it updates ONLY the fields that are non-empty in the
 * row, writing at the per-student path (safe child merge). Empty cells are
 * never written, so you can fill just Parent Phone and leave the rest alone.
 *
 * Usage:
 *   npm run apply:students -- <file.csv>             # dry-run
 *   npm run apply:students -- <file.csv> --apply     # write
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

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'khandaqmadresah1234@gmail.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'KH1234'
const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'))
const APPLY = process.argv.slice(2).includes('--apply')

if (!fileArg) {
  console.error('Usage: npm run apply:students -- <file.csv> [--apply]')
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

/** Minimal CSV parser (handles quoted fields / embedded commas). */
function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ }
        else inQ = false
      } else cur += ch
    } else if (ch === '"') {
      inQ = true
    } else if (ch === ',') {
      row.push(cur); cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      cur += ch
    }
  }
  row.push(cur)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

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

  const raw = readFileSync(fileArg, 'utf8').replace(/^\uFEFF/, '')
  const rows = parseCsv(raw)
  if (rows.length === 0) { console.error('Empty CSV.'); process.exit(1) }

  const header = rows[0].map((h) => h.trim())
  const idIdx = header.indexOf('studentId')
  if (idIdx === -1) { console.error('CSV is missing the studentId column.'); process.exit(1) }

  const live = await readVal('students')
  const plan = []
  let missing = 0
  let changed = 0

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r]
    const sid = (cols[idIdx] || '').trim()
    if (!sid) continue
    if (!live[sid]) { missing++; continue }

    const fields = {}
    let any = false
    for (let c = 0; c < header.length; c++) {
      if (c === idIdx) continue
      const key = header[c]
      const val = (cols[c] ?? '').trim()
      if (val === '') continue
      const prevRaw = live[sid][key]
      const prev = prevRaw === undefined || prevRaw === null ? '' : String(prevRaw).trim()
      if (val === '') continue
      if (prev === val) continue
      fields[key] = val
      any = true
    }
    if (any) { plan.push({ sid, fields }); changed++ }
  }

  console.log(`\nCSV rows (excl. header): ${rows.length - 1}`)
  console.log(`  students found in DB   : ${rows.length - 1 - missing}`)
  console.log(`  with field changes      : ${changed}`)
  console.log(`  not found in DB (skipped): ${missing}`)

  mkdirSync(BACKUP_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const payload = {}
  plan.forEach(({ sid, fields }) => (payload[sid] = fields))
  const reportFile = join(BACKUP_DIR, `student-csv-update-${ts}${APPLY ? '-applied' : '-dryrun'}.json`)
  writeFileSync(reportFile, JSON.stringify(payload, null, 2))
  console.log(`\nPlan written to: ${reportFile}`)

  if (!APPLY) {
    console.log('Dry-run complete. Re-run with --apply to write.')
    process.exit(0)
  }

  let written = 0
  for (const { sid, fields } of plan) {
    await update(ref(db, `students/${sid}`), fields)
    written++
  }
  console.log(`\n✓ Wrote ${written} student update(s).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('✗ Failed:', err.message || err)
  process.exit(1)
})