import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'

const {
  hasName,
  parseBackupData,
  parseBackupFile,
} = await import('../scripts/restore-students-from-backup.mjs')

describe('Database Backup & Restore Pipeline Validation', () => {
  test('hasName accurately verifies student name field', () => {
    assert.equal(hasName({ name: 'Bilal Ahmed' }), true)
    assert.equal(hasName({ name: '' }), false)
    assert.equal(hasName({ name: '   ' }), false)
    assert.equal(hasName({ name: null }), false)
    assert.equal(hasName(null), false)
  })

  test('parseBackupData parses modern multi-tenant schoolData backups', () => {
    const multiTenantBackup = {
      users: { u1: { role: 'teacher' } },
      schoolInfo: { sch1: { status: 'active' } },
      schoolData: {
        sch1: {
          classes: { c1: { name: 'Class 1' } },
          students: {
            s1: { name: 'Fatima Zahra', classId: 'c1', parentPhone: '0911000000' },
            s2: { name: 'Omar Farooq', classId: 'c1', parentPhone: '0911111111' },
          },
        },
        sch2: {
          students: {
            s3: { name: 'Zaynab Ali', classId: 'c2' },
          },
        },
      },
    }

    const students = parseBackupData(multiTenantBackup)
    assert.equal(Object.keys(students).length, 3)
    assert.equal(students.s1.name, 'Fatima Zahra')
    assert.equal(students.s1.schoolId, 'sch1')
    assert.equal(students.s2.name, 'Omar Farooq')
    assert.equal(students.s3.schoolId, 'sch2')
  })

  test('parseBackupData parses legacy { students: { ... } } backups', () => {
    const legacyBackup = {
      students: {
        s10: { name: 'Khalid Walid', classId: 'c1' },
        s11: { name: 'Aisha Siddiq', classId: 'c2' },
      },
    }

    const students = parseBackupData(legacyBackup)
    assert.equal(Object.keys(students).length, 2)
    assert.equal(students.s10.name, 'Khalid Walid')
    assert.equal(students.s11.name, 'Aisha Siddiq')
  })

  test('parseBackupData rejects invalid formats', () => {
    assert.throws(() => parseBackupData(null), /Invalid backup data/)
    assert.throws(() => parseBackupData([]), /Invalid backup data/)
    assert.throws(() => parseBackupData({ schoolData: {} }), /Could not find a "students" record collection/)
  })

  test('parseBackupFile reads uncompressed and gzipped backup files identically', () => {
    const tmpDir = os.tmpdir()
    const jsonPath = path.join(tmpDir, `test-backup-${Date.now()}.json`)
    const gzPath = path.join(tmpDir, `test-backup-${Date.now()}.json.gz`)

    const payload = {
      schoolData: {
        sch1: {
          students: {
            s99: { name: 'Hamza Abdul', classId: 'c9', parentPhone: '0922334455' },
          },
        },
      },
    }

    try {
      const jsonContent = JSON.stringify(payload)
      fs.writeFileSync(jsonPath, jsonContent, 'utf8')
      fs.writeFileSync(gzPath, zlib.gzipSync(jsonContent))

      const fromJson = parseBackupFile(jsonPath)
      const fromGz = parseBackupFile(gzPath)

      assert.deepEqual(fromJson, fromGz)
      assert.equal(fromJson.s99.name, 'Hamza Abdul')
      assert.equal(fromJson.s99.schoolId, 'sch1')
    } finally {
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath)
      if (fs.existsSync(gzPath)) fs.unlinkSync(gzPath)
    }
  })
})
