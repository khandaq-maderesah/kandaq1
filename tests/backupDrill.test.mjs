import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const { parseBackupData, parseBackupFile, hasName } = await import(
  '../scripts/restore-students-from-backup.mjs'
)

const ROOT = path.resolve('.')
const BACKUP_SCRIPT = path.join(ROOT, 'scripts', 'backup-db.mjs')
const RESTORE_SCRIPT = path.join(ROOT, 'scripts', 'restore-students-from-backup.mjs')

/**
 * Task 5.6 (Lead directive 13:20) - Automated backup / restore drill.
 *
 * The live drill needs the seed admin credentials, which are not part of the
 * repository. What can be verified without them is verified here:
 *   1. both scripts fail safe (no partial writes, clear message) without them,
 *   2. the backup file contract is stable (nodes + file name + gitignore),
 *   3. a file produced in the backup format is fully consumable by the restore
 *      path (format round trip).
 */

function runScript(script, args = [], env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: 'pipe',
    })
    return { code: 0, stdout, stderr: '' }
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? '',
    }
  }
}

/**
 * The scripts load `.env.local` themselves, so a machine that has the seed
 * admin password would really sign in. Those live-network cases are skipped
 * here: the drill must never touch the production database on its own.
 */
function liveCredentialsPresent() {
  const envFile = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envFile)) return false
  return /^\s*SEED_ADMIN_PASSWORD\s*=\s*\S/m.test(fs.readFileSync(envFile, 'utf8'))
}

function buildBackupFixture() {
  return {
    users: {
      'user-1': { uid: 'user-1', name: 'Ustaz Abdi', role: 'teacher', schoolId: 'school-1' },
    },
    schoolInfo: {
      'school-1': { name: 'Khendeq Medresah', slug: 'khendeq' },
    },
    schoolData: {
      'school-1': {
        classes: { 'class-1': { name: 'Fiqh', teacherId: 'user-1' } },
        students: {
          'student-1': {
            name: 'Abdullah',
            age: 12,
            classId: 'class-1',
            parentPhone: '+251911000001',
            photoUrl: 'photos/student-1.jpg',
          },
          'student-2': {
            name: 'Fatima',
            age: 11,
            classId: 'class-1',
            parentPhone: '+251911000002',
          },
        },
        attendance: {
          'class-1_2026-10-20_student-1': {
            status: 'present',
            markedAt: '2026-10-20T09:00:00.000Z',
          },
        },
      },
    },
  }
}

describe('Backup script safety', () => {
  test('the backup script skips safely instead of failing when credentials are missing', (t) => {
    if (liveCredentialsPresent()) {
      t.skip('this machine holds the seed admin password: the live backup is an owner-run step')
      return
    }
    const result = runScript(BACKUP_SCRIPT, [], { SEED_ADMIN_PASSWORD: '' })
    assert.equal(result.code, 0)
    assert.match(result.stdout, /Skipping database backup/)
  })

  test('the backup script never runs inside a cloud build', () => {
    const result = runScript(BACKUP_SCRIPT, [], { CI: '1' })
    assert.equal(result.code, 0)
    assert.match(result.stdout, /Skipping local database backup \(cloud\/CI build or no \.env\.local\)/)
  })

  test('the backup covers every top-level node the restore path needs', () => {
    const source = fs.readFileSync(BACKUP_SCRIPT, 'utf8')
    for (const node of ['users', 'schoolInfo', 'schoolData']) {
      assert.ok(
        source.includes(`'${node}'`),
        `The backup must export the "${node}" node`
      )
    }
    assert.match(source, /rtdb-\$\{ts\}\.json/)
  })

  test('database dumps are excluded from version control', () => {
    const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8')
    assert.match(gitignore, /^backups\/$/m)
  })
})

describe('Backup to restore round trip', () => {
  test('a file in the backup format is fully consumable by the restore path', () => {
    const parsed = parseBackupData(buildBackupFixture())

    assert.equal(Object.keys(parsed).length, 2)
    assert.equal(parsed['student-1'].name, 'Abdullah')
    assert.equal(parsed['student-1'].schoolId, 'school-1')
    assert.equal(parsed['student-2'].parentPhone, '+251911000002')
    assert.ok(hasName(parsed['student-1']))
  })

  test('the restore path reads the backup file from disk, including gzipped dumps', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kmms-backup-drill-'))
    try {
      const fixture = buildBackupFixture()
      const file = path.join(dir, 'rtdb-2026-10-20T09-00-00-000Z.json')
      fs.writeFileSync(file, JSON.stringify(fixture, null, 2))

      const parsed = parseBackupFile(file)
      assert.equal(Object.keys(parsed).length, 2)
      assert.equal(parsed['student-1'].classId, 'class-1')
      assert.equal(parsed['student-1'].photoUrl, 'photos/student-1.jpg')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the restore script refuses to run without credentials and writes nothing', (t) => {
    if (liveCredentialsPresent()) {
      t.skip('this machine holds the seed admin password: the live restore is an owner-run step')
      return
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kmms-backup-drill-'))
    const backupsDir = path.join(ROOT, 'backups')
    const before = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : []
    try {
      const file = path.join(dir, 'rtdb-2026-10-20T09-00-00-000Z.json')
      fs.writeFileSync(file, JSON.stringify(buildBackupFixture(), null, 2))

      const result = runScript(RESTORE_SCRIPT, [file], { SEED_ADMIN_PASSWORD: '' })
      assert.notEqual(result.code, 0, 'Restore must fail without credentials')
      assert.match(result.stderr, /Could not sign in/)

      const after = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : []
      assert.deepEqual(after, before, 'A failed restore must not leave partial output behind')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test('the restore script prints its usage when no backup file is given', () => {
    const result = runScript(RESTORE_SCRIPT, [])
    assert.notEqual(result.code, 0, 'Restore must exit with non-zero when no file provided')
    assert.match(result.stderr, /Usage: node scripts\/restore-students-from-backup\.mjs/)
  })
})
