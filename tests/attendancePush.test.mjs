import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const { sunsetAt, clockTime, teacherReminderTime, isTeacherReminderDue, reminderInstant, zonedClock, REMINDER_BEFORE_SUNSET_MINUTES } =
  await import('../src/lib/sunset.ts')
const { isTrustedPushEndpoint, missingClassesByTeacher, buildAttendancePush, buildUnsentSmsPush, isPushDue, ADMIN_SMS_PAGE, ATTENDANCE_PAGE } =
  await import('../src/lib/attendancePush.ts')
const { generateSmsMessage, generateLateSmsMessage, generateGroupSmsMessage, generateLateGroupSmsMessage } = await import(
  '../src/lib/smsMessage.ts'
)

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))

/** The Ustaz is reminded an hour and a half before sunset, Ethiopian time. */
describe('Sunset and the reminder time', () => {
  test('sunset in Addis Ababa is in the expected range all year (Ethiopian time)', () => {
    for (let month = 1; month <= 12; month++) {
      const date = `2026-${String(month).padStart(2, '0')}-15`
      const sunset = minutes(clockTime(sunsetAt(date), 'Africa/Addis_Ababa'))
      assert.ok(sunset >= 17 * 60 + 40 && sunset <= 18 * 60 + 55, `${date} sunset ${sunset}`)
    }
  })

  test('known days: late June is the latest sunset, November among the earliest', () => {
    const june = minutes(clockTime(sunsetAt('2026-06-21')))
    const november = minutes(clockTime(sunsetAt('2026-11-15')))
    assert.ok(june > november + 30)
  })

  test('the reminder is exactly an hour and a half before sunset', () => {
    assert.equal(REMINDER_BEFORE_SUNSET_MINUTES, 90)
    for (const date of ['2026-01-10', '2026-06-21', '2026-10-31']) {
      const diff = sunsetAt(date).getTime() - reminderInstant(date).getTime()
      assert.equal(diff, 90 * 60_000)
      assert.equal(minutes(teacherReminderTime(date)), minutes(clockTime(sunsetAt(date))) - 90)
    }
  })

  test('through the year the reminder stays between 16:20 and 17:25 (the two evening runs cover that)', () => {
    for (let d = new Date('2026-01-01T00:00:00Z'); d < new Date('2027-01-01T00:00:00Z'); d = new Date(d.getTime() + 86_400_000)) {
      const m = minutes(teacherReminderTime(d.toISOString().slice(0, 10)))
      assert.ok(m >= 16 * 60 + 20 && m <= 17 * 60 + 25, d.toISOString())
    }
  })

  test('the reminder time is a clock time in the school timezone', () => {
    // 2026-10-31: sunset about 18:03 in Addis -> reminder about 16:33.
    const time = teacherReminderTime('2026-10-31', 'Africa/Addis_Ababa')
    assert.match(time, /^16:\d{2}$/)
    // The same instant on a UTC wall clock is three hours earlier.
    assert.equal(minutes(teacherReminderTime('2026-10-31', 'UTC')), minutes(time) - 180)
  })

  test('isTeacherReminderDue follows the Ethiopian clock, not the device clock', () => {
    // 12:00 UTC = 15:00 in Addis: before the reminder. 15:00 UTC = 18:00 in Addis: after it.
    assert.equal(isTeacherReminderDue(new Date('2026-10-31T12:00:00Z'), 'Africa/Addis_Ababa'), false)
    assert.equal(isTeacherReminderDue(new Date('2026-10-31T15:00:00Z'), 'Africa/Addis_Ababa'), true)
    // Just after midnight in Addis the new day's reminder has not come yet.
    assert.equal(isTeacherReminderDue(new Date('2026-10-31T22:30:00Z'), 'Africa/Addis_Ababa'), false)
  })

  test('zonedClock gives the Ethiopian date, time and weekday', () => {
    const clock = zonedClock(new Date('2026-11-01T22:30:00Z'), 'Africa/Addis_Ababa') // 01:30 Monday 2 Nov
    assert.deepEqual(clock, { date: '2026-11-02', time: '01:30', weekday: 1 })
  })
})

describe('Attendance reminder push', () => {
  const classes = [
    { id: 'c1', name: 'Level 1', section: 'A', teacherId: 'u1' },
    { id: 'c2', name: 'Level 2', teacherId: 'u2', teacherIds: { u2: true, u3: true } },
    { id: 'c3', name: 'Level 3', teacherId: 'u1', isActive: false },
    { id: 'c4', name: 'Level 4', teacherId: '' },
    { id: 'c5', name: 'Level 5', teacherId: 'u1' },
  ]

  test('each Ustaz is asked about the classes with no attendance today (shared classes ask everyone)', () => {
    const byTeacher = missingClassesByTeacher(classes, new Set(['c5']))
    assert.deepEqual([...byTeacher.keys()].sort(), ['u1', 'u2', 'u3'])
    assert.deepEqual(byTeacher.get('u1').map((c) => c.id), ['c1'])
    assert.deepEqual(byTeacher.get('u3').map((c) => c.id), ['c2'])
  })

  test('nothing is sent to an Ustaz whose classes all have attendance', () => {
    assert.equal(missingClassesByTeacher(classes, new Set(['c1', 'c2', 'c5'])).size, 0)
  })

  test('the notification names the classes, opens the attendance page and has one tag per day', () => {
    const texts = { title: 'Time', body: 'Missing: {classes}', action: 'Take attendance' }
    const p = buildAttendancePush(texts, [{ id: 'c1', name: 'Level 1', section: 'A' }, { id: 'c2', name: 'Level 2' }], '2026-11-02', 'en')
    assert.equal(p.body, 'Missing: Level 1 · A, Level 2')
    assert.equal(p.action, 'Take attendance')
    assert.equal(p.url, ATTENDANCE_PAGE)
    assert.equal(ATTENDANCE_PAGE, '/teacher/attendance')
    assert.equal(p.tag, 'attendance-reminder-2026-11-02')
  })

  test('a long list of classes is shortened', () => {
    const many = ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ id: `c${i}`, name: n }))
    assert.equal(buildAttendancePush({ title: '', body: '{classes}', action: '' }, many, '2026-11-02', 'en').body, 'A, B, C +2')
  })

  test('only the browsers’ push services are ever contacted', () => {
    assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true)
    assert.equal(isTrustedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true)
    assert.equal(isTrustedPushEndpoint('https://web.push.apple.com/abc'), true)
    assert.equal(isTrustedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'), true)
    assert.equal(isTrustedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false)
    assert.equal(isTrustedPushEndpoint('https://metadata.google.internal/computeMetadata/v1/'), false)
    assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com.evil.example/x'), false)
    assert.equal(isTrustedPushEndpoint('https://fcm.googleapis.com:8443/x'), false)
    assert.equal(isTrustedPushEndpoint('not a url'), false)
    assert.equal(isTrustedPushEndpoint(undefined), false)
  })

  test('the service worker shows a button and a tap opens the attendance page', () => {
    const sw = read('public/sw.js')
    assert.match(sw, /actions: data\.action \? \[\{ action: 'open', title: data\.action \}\] : \[\]/)
    assert.match(sw, /tag: data\.tag/)
    assert.match(sw, /client\.navigate\(target\)/)
    assert.match(sw, /clients\.openWindow\(target\)/)
  })

  test('two evening runs reach everyone within about 15 minutes of their time', () => {
    // Runs at 16:45 and 17:10 (see scripts/gcp-setup.ps1).
    const runs = ['16:45', '17:10']
    const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
    for (let m = 16 * 60 + 30; m <= 17 * 60 + 20; m++) {
      const reminder = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      const sentAt = runs.find((run) => isPushDue(run, reminder))
      assert.ok(sentAt, `${reminder} is never sent`)
      assert.ok(Math.abs(toMin(sentAt) - m) <= 15, `${reminder} sent at ${sentAt}`)
    }
    assert.equal(isPushDue('16:30', '17:00'), false)
    assert.equal(isPushDue('16:50', '17:00'), true)
  })

  test('both Cloud Scheduler runs are set up', () => {
    const setup = read('scripts/gcp-setup.ps1')
    assert.match(setup, /attendance-push-early/)
    assert.match(setup, /'45 16 \* \** 1-6'/)
    assert.match(setup, /attendance-push-late/)
    assert.match(setup, /'10 17 \* \* 1-6'/)
  })

  test('the server sends once per Ustaz per day, from the sunset-based time, never on Sunday', () => {
    const server = read('src/lib/attendancePushServer.ts')
    assert.match(server, /weekday === 0/)
    assert.match(server, /isPushDue\(time, teacherReminderTime\(date, timeZone\)\)/)
    assert.match(server, /attendancePushLog\/\$\{date\}\/\$\{uid\}/)
    assert.match(server, /isTrustedPushEndpoint/)
    assert.match(server, /statusCode/)
  })

  test('admins get the list of Ustazes who did not text the parents', () => {
    const texts = { title: 'Parents not texted', body: '{ustazes} did not text the parents.', action: 'See who' }
    const p = buildUnsentSmsPush(texts, ['Ustaz A', 'Ustaz B', 'Ustaz A'], '2026-11-02', 'en')
    assert.equal(p.body, 'Ustaz A, Ustaz B did not text the parents.')
    assert.equal(p.url, ADMIN_SMS_PAGE)
    assert.equal(ADMIN_SMS_PAGE, '/admin/attendance#ustaz')
    assert.equal(p.tag, 'unsent-sms-2026-11-02')
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => `Ustaz ${n}`)
    assert.equal(buildUnsentSmsPush({ ...texts, body: '{ustazes}' }, many, '2026-11-02', 'en').body, 'Ustaz A, Ustaz B, Ustaz C, Ustaz D +2')
  })

  test('the admin push uses the same unsent-SMS list as the admin screen, once a day, to admins only', () => {
    const server = read('src/lib/attendancePushServer.ts')
    assert.match(server, /findUnsentAbsenceSms\(\{ attendance, logs, classes, users, now \}\)/)
    assert.match(server, /admin\.role !== 'admin'/)
    assert.match(server, /smsPushLog\/\$\{date\}\/\$\{admin\.uid\}/)
    assert.match(read('src/app/api/cron/missing-attendance/route.ts'), /sendAdminUnsentSmsPushes\(\)/)
    assert.match(read('src/app/admin/page.tsx'), /<AdminPushOptIn \/>/)
    assert.match(read('src/components/admin/UstazAttendanceMonitor.tsx'), /<AdminPushOptIn \/>/)
  })

  test('the cron route needs the shared secret', () => {
    const route = read('src/app/api/cron/attendance-push/route.ts')
    assert.match(route, /Bearer \$\{secret\}/)
    assert.match(route, /status: 401/)
  })

  test('the in-app reminder (bell) and the server use the same sunset time as the push', () => {
    assert.match(read('src/lib/attendanceReminder.ts'), /isTeacherReminderDue\(now, timeZone\)/)
    assert.match(read('src/lib/attendanceReminderServer.ts'), /teacherReminderTime\(date, timeZone\)/)
  })

  test('rules: a user writes only their own device subscriptions, only HTTPS endpoints', () => {
    const node = JSON.parse(read('database.rules.json')).rules.schoolData.$schoolId.pushSubs.$uid
    assert.equal(node['.read'], "auth != null && auth.uid === $uid")
    assert.match(node['.write'], /auth\.uid === \$uid/)
    assert.match(node['.write'], /schoolId/)
    assert.match(node.$subId['.validate'], /beginsWith\('https:\/\/'\)/)
  })

  test('the dashboard offers the opt-in and the banner', () => {
    assert.match(read('src/app/teacher/page.tsx'), /<AttendanceReminderCard/)
    const card = read('src/components/teacher/AttendanceReminderCard.tsx')
    assert.match(card, /<PushOptIn/)
    assert.match(card, /href=\{ATTENDANCE_PAGE\}/)
    assert.match(read('src/components/PushOptIn.tsx'), /enablePush\(uid, locale\)/)
  })
})

/** Late students get their own, different SMS, and the Ustaz decides whether to send it. */
describe('Late student SMS', () => {
  const school = { name: 'Khendeq', nameAm: 'ኸንደቅ' }
  const languages = ['Amharic', 'Afaan Oromoo', 'Somali', 'Arabic', 'English']

  test('the late message differs from the absence message in every language, for one parent and for a group', () => {
    for (const language of languages) {
      for (const gender of ['male', 'female']) {
        const late = generateLateSmsMessage('Umar', gender, language, school)
        assert.notEqual(late, generateSmsMessage('Umar', gender, language, school), `${language}/${gender}`)
        assert.ok(late.includes('Umar') || language === 'Amharic' || language === 'Arabic')
      }
      assert.notEqual(generateLateGroupSmsMessage(language, school), generateGroupSmsMessage(language, school), language)
    }
  })

  test('English late text says late, not absent', () => {
    const text = generateLateSmsMessage('Umar', 'male', 'English', school)
    assert.match(text, /was late to the medreseh today/)
    assert.doesNotMatch(text, /absent/)
    assert.match(generateLateGroupSmsMessage('English', school), /your child was late/)
  })

  test('gendered languages follow the child', () => {
    assert.match(generateLateSmsMessage('Umar', 'female', 'Arabic', school), /الطالبة Umar المحترم/)
    assert.match(generateLateSmsMessage('Umar', 'female', 'Arabic', school), /تأخّرت/)
    assert.match(generateLateSmsMessage('Umar', 'male', 'Arabic', school), /تأخّر عن/)
    assert.match(generateLateSmsMessage('ኡመር', 'female', 'Amharic', school), /ዘግይታ መምጣቷን/)
    assert.match(generateLateSmsMessage('ኡመር', 'male', 'Amharic', school), /ዘግይቶ መምጣቱን/)
    assert.match(generateLateSmsMessage('Umar', 'female', 'Somali', school), /ay ku soo daahday/)
  })

  test('the dialog has a switch for late students, remembered, and never records them for the admin', () => {
    const dialog = read('src/components/teacher/AbsenceSmsDialog.tsx')
    assert.match(dialog, /role="switch"/)
    assert.match(dialog, /writeLateSmsPreference/)
    assert.match(dialog, /kind === 'absent' && reachableAbsent\.every/)
    assert.match(dialog, /generateLateSmsMessage/)
    assert.match(dialog, /generateLateGroupSmsMessage/)
  })

  test('the attendance page passes late students and offers a button when only some came late', () => {
    const page = read('src/app/teacher/attendance/page.tsx')
    assert.match(page, /late=\{lateStudents\}/)
    assert.match(page, /saveBar\.sendLate/)
    assert.match(page, /readLateSmsPreference\(\)/)
  })
})
