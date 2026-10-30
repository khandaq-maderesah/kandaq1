import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const messages = JSON.parse(read('src/i18n/messages/en/confirm.json'))

/** Hard-to-undo actions ask "are you sure?" first, naming exactly what will happen. */
describe('Confirmation dialogs', () => {
  test('sign out asks first and warns about attendance not yet synced', () => {
    const shell = read('src/components/shell/AppShell.tsx')
    assert.match(shell, /onSelect=\{\(\) => setConfirmOpen\(true\)\}/)
    assert.match(shell, /getOfflineAttendanceQueue\(\)\.length/)
    assert.doesNotMatch(shell, /onSelect=\{handleLogout\}/)
  })

  test('deactivating a user, withdrawing a request, closing registration, removing the logo and saving platform lists all ask', () => {
    assert.match(read('src/app/admin/teachers/page.tsx'), /setDeactivating\(u\)/)
    assert.match(read('src/app/teacher/requests/page.tsx'), /onClick=\{\(\) => setWithdrawing\(r\.id\)\}/)
    assert.match(read('src/app/admin/settings/page.tsx'), /registrationOpen \? \(\) => setConfirmClose\(true\)/)
    assert.match(read('src/components/branding/BrandingEditor.tsx'), /onClick=\{\(\) => setConfirmRemove\(true\)\}/)
    const lists = read('src/app/superadmin/lists/page.tsx')
    assert.match(lists, /if \(text\) setConfirmSave\(true\)/)
    assert.match(lists, /setSwitchTo\(s\)/)
  })

  test('unsaved attendance is not dropped silently when the class or day changes, on either screen', () => {
    for (const page of ['src/app/teacher/attendance/page.tsx', 'src/app/admin/attendance/page.tsx']) {
      const src = read(page)
      assert.match(src, /guard\(\(\) => setClassChoice\(next\)\)|guard\(\(\) => setClassId\(next\)\)/, page)
      assert.match(src, /guard\(\(\) => setDate\(next\)\)/, page)
      assert.match(src, /useUnsavedChangesWarning\(dirty\)/, page)
      assert.match(src, /requestBulk\('absent'\)/, page)
      assert.doesNotMatch(src, /onClick=\{\(\) => markAll\(/, `${page}: bulk buttons must ask before replacing marks`)
    }
  })

  test('a new student form with anything typed in asks before it is closed', () => {
    const src = read('src/app/admin/students/page.tsx')
    assert.match(src, /createDirty/)
    assert.match(src, /setDiscardOpen\(true\)/)
  })

  test('every confirmation text used exists in all five languages', () => {
    const keys = Object.entries(messages).flatMap(([dialog, texts]) => Object.keys(texts).map((k) => `${dialog}.${k}`))
    for (const locale of ['am', 'ar', 'om', 'so']) {
      const other = JSON.parse(read(`src/i18n/messages/${locale}/confirm.json`))
      const have = Object.entries(other).flatMap(([dialog, texts]) => Object.keys(texts).map((k) => `${dialog}.${k}`))
      assert.deepEqual(have.sort(), keys.sort(), locale)
    }
  })

  test('the dialog keeps the safe choice first and cannot be dismissed while working', () => {
    const src = read('src/components/ui/confirm-dialog.tsx')
    assert.match(src, /!busy && onOpenChange\(next\)/)
    assert.match(src, /autoFocus/)
  })
})
