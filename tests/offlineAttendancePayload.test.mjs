import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Source-level invariants for the offline attendance feature.
 *
 * Realtime Database rule `attendance/$attendanceId/.write`
 * (database.rules.json) grants an Ustaz write only when
 * `newData.child('teacherId').val() === auth.uid`.
 * A queued record that omits `teacherId` is therefore rejected by Firebase
 * the moment the device syncs, silently losing the attendance taken offline.
 * These assertions guard that payload contract at build time.
 */

const root = path.resolve('src')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

describe('Offline attendance payload invariants', () => {
  test('the queue record contract carries the owning Ustaz identity', () => {
    const lib = read('lib/offlineAttendance.ts')
    assert.match(
      lib,
      /teacherId\??\s*:\s*string/,
      'QueuedAttendanceRecord must declare an optional teacherId field'
    )
    assert.match(
      lib,
      /markedBy\??\s*:\s*string/,
      'QueuedAttendanceRecord must declare an optional markedBy field'
    )
  })

  test('every offline enqueue payload in the Ustaz attendance page identifies the marking Ustaz', () => {
    const page = read('app/teacher/attendance/page.tsx')
    const blocks = [...page.matchAll(/recordsToEnqueue\.push\(\{([\s\S]*?)\n\s*\}\)/g)].map(
      (match) => match[1]
    )

    assert.ok(
      blocks.length > 0,
      'Expected at least one offline enqueue payload in src/app/teacher/attendance/page.tsx'
    )

    blocks.forEach((block, index) => {
      assert.match(
        block,
        /teacherId\s*:/,
        `Offline enqueue payload #${index + 1} omits teacherId and would be rejected by database.rules.json`
      )
      assert.match(
        block,
        /markedBy\s*:/,
        `Offline enqueue payload #${index + 1} omits markedBy`
      )
    })
  })

  test('the auto-sync hook forwards the Ustaz identity to the database write', () => {
    const hook = read('hooks/useOfflineAttendanceSync.ts')
    assert.match(
      hook,
      /teacherId\s*:\s*record\.teacherId/,
      'The sync write must forward record.teacherId so database.rules.json accepts it'
    )
    assert.match(
      hook,
      /markedBy\s*:\s*record\.markedBy/,
      'The sync write must forward record.markedBy'
    )
  })
})
