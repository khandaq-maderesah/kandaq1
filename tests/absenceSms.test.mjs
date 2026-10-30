import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { absenceSmsId, findUnsentAbsenceSms, groupByUstaz, SMS_GRACE_MINUTES } = await import('../src/lib/absenceSms.ts')

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** After saving attendance the Ustaz texts the parents of the absent; the admin hears when they did not. */
describe('Absence SMS follow-up', () => {
  const now = new Date('2026-11-02T10:00:00Z')
  const classes = [
    { id: 'c1', name: 'Level 1', section: 'A', teacherId: 'u1' },
    { id: 'c2', name: 'Level 2', teacherId: 'u2' },
  ]
  const users = [
    { uid: 'u1', name: 'Ustaz One', phone: '0911' },
    { uid: 'u2', name: 'Ustaz Two' },
  ]
  const mark = (over) => ({
    classId: 'c1',
    className: 'Level 1',
    date: '2026-11-02',
    status: 'absent',
    teacherId: 'u1',
    markedBy: 'u1',
    markedAt: '2026-11-02T08:00:00Z',
    ...over,
  })
  const run = (attendance, logs = [], extra = {}) => findUnsentAbsenceSms({ attendance, logs, classes, users, now, ...extra })

  test('one id per class and day', () => {
    assert.equal(absenceSmsId('2026-11-02', 'c1'), '2026-11-02_c1')
  })

  test('absences with no SMS record are listed once per class day, with the Ustaz and count', () => {
    const rows = run([mark({}), mark({}), mark({ classId: 'c2', teacherId: 'u2', markedBy: 'u2' })])
    assert.equal(rows.length, 2)
    const one = rows.find((r) => r.classId === 'c1')
    assert.deepEqual(
      { teacher: one.teacherName, phone: one.phone, absent: one.absentCount, section: one.section },
      { teacher: 'Ustaz One', phone: '0911', absent: 2, section: 'A' }
    )
  })

  test('an SMS record for the day clears it, unless more students were marked absent since', () => {
    assert.equal(run([mark({}), mark({})], [{ classId: 'c1', date: '2026-11-02', absentCount: 2 }]).length, 0)
    assert.equal(run([mark({}), mark({})], [{ classId: 'c1', date: '2026-11-02', absentCount: 1 }]).length, 1)
  })

  test('present, late and excused students never need a text', () => {
    assert.equal(run([mark({ status: 'present' }), mark({ status: 'late' }), mark({ status: 'excused' })]).length, 0)
  })

  test('attendance an admin marked is not the Ustaz to blame', () => {
    assert.equal(run([mark({ markedBy: 'admin1' })]).length, 0)
  })

  test('the Ustaz gets a few minutes to finish texting before the admin is told', () => {
    const justSaved = new Date(now.getTime() - (SMS_GRACE_MINUTES - 1) * 60_000).toISOString()
    const longAgo = new Date(now.getTime() - (SMS_GRACE_MINUTES + 1) * 60_000).toISOString()
    assert.equal(run([mark({ markedAt: justSaved })]).length, 0)
    assert.equal(run([mark({ markedAt: longAgo })]).length, 1)
  })

  test('days before tracking started, or older than a week, are not flagged', () => {
    assert.equal(run([mark({ date: '2026-10-30' })]).length, 0)
    const late = new Date('2026-11-20T10:00:00Z')
    assert.equal(findUnsentAbsenceSms({ attendance: [mark({ date: '2026-11-02' })], logs: [], classes, users, now: late }).length, 0)
  })

  test('grouped by Ustaz, the one who skipped most days first', () => {
    const rows = run([
      mark({ date: '2026-11-02' }),
      mark({ date: '2026-11-01' }),
      mark({ classId: 'c2', teacherId: 'u2', markedBy: 'u2' }),
    ])
    const groups = groupByUstaz(rows)
    assert.deepEqual(groups.map((g) => [g.teacherName, g.days.length]), [['Ustaz One', 2], ['Ustaz Two', 1]])
  })

  test('rules: an Ustaz writes only their own class-day record, with the server time; the admin reads it', () => {
    const node = JSON.parse(read('database.rules.json')).rules.schoolData.$schoolId.absenceSms
    assert.match(node['.read'], /schoolId/)
    assert.deepEqual(node['.indexOn'], ['date'])
    const write = node.$id['.write']
    assert.match(write, /newData\.child\('teacherId'\)\.val\(\) === auth\.uid/)
    assert.match(write, /\$id === newData\.child\('date'\)\.val\(\) \+ '_' \+ newData\.child\('classId'\)\.val\(\)/)
    assert.match(write, /newData\.child\('sentAt'\)\.val\(\) === now/)
    assert.match(write, /teacherIds\//)
  })

  test('saving attendance offers the SMS dialog, the admin sees the list, banner and badge', () => {
    const page = read('src/app/teacher/attendance/page.tsx')
    assert.match(page, /<AbsenceSmsDialog/)
    assert.equal((page.match(/offerSms\(\)/g) ?? []).length, 3, 'online, offline and connection-loss saves all offer it')
    assert.match(read('src/components/admin/UstazAttendanceMonitor.tsx'), /<UnsentSmsList/)
    assert.match(read('src/app/admin/page.tsx'), /<UnsentSmsBanner/)
    assert.match(read('src/components/shell/RoleShell.tsx'), /<UnsentSmsNotifier/)
    assert.match(read('src/components/shell/nav.ts'), /attendance', icon: ClipboardCheck, badge: 'unsentSms'/)
  })
})

describe('Move requests', () => {
  test('the Ustaz sends no class; the admin chooses it when approving', () => {
    const dialog = read('src/components/requests/StudentChangeDialogs.tsx')
    const transfer = dialog.slice(dialog.indexOf('export function RequestTransferDialog'), dialog.indexOf('export function AdminArchiveDialog'))
    assert.doesNotMatch(transfer, /toClassId|toClassName|targetClass/)
    const db = read('src/lib/database/index.ts')
    assert.match(db, /targetClassId \?\? request\.toClassId/)
    assert.match(db, /requests\/\$\{request\.id\}\/toClassName/)
    assert.match(read('src/app/admin/requests/page.tsx'), /disabled=\{saving \|\| \(needsClass && !chosenClass\)\}/)
  })
})

describe('Super admin school card', () => {
  test('shows no email addresses', () => {
    assert.doesNotMatch(read('src/app/superadmin/page.tsx'), /\ba\.email\b/)
  })
})
