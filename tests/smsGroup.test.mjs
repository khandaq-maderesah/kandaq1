import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const { detectSmsPlatform, uniquePhones, smsHref, groupSmsHref, dominantLanguage } = await import('../src/lib/smsLink.ts')
const { generateGroupSmsMessage } = await import('../src/lib/smsMessage.ts')

describe('Group SMS to the parents of absent students', () => {
  test('numbers are cleaned and de-duplicated, placeholders dropped', () => {
    assert.deepEqual(uniquePhones(['0911 223 344', '0911223344', '—', '', undefined, '+251 922 000 111']), ['0911223344', '+251922000111'])
  })

  test('one recipient opens the SMS app with the message filled in', () => {
    assert.equal(smsHref('0911223344', 'Hi there'), 'sms:0911223344?body=Hi%20there')
  })

  test('several recipients: Android style by default, iPhone style on iOS, nothing when empty', () => {
    assert.equal(groupSmsHref(['0911', '0922'], 'Hi', 'other'), 'sms:0911,0922?body=Hi')
    assert.equal(groupSmsHref(['0911', '0922'], 'Hi', 'ios'), 'sms:/open?addresses=0911,0922&body=Hi')
    assert.equal(groupSmsHref(['—', ''], 'Hi', 'other'), null)
    assert.equal(detectSmsPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios')
    assert.equal(detectSmsPlatform('Mozilla/5.0 (Linux; Android 14)'), 'other')
  })

  test('the group message uses the language most parents share, Amharic when unknown', () => {
    assert.equal(dominantLanguage(['Somali', 'Amharic', 'Somali']), 'Somali')
    assert.equal(dominantLanguage([undefined, null]), 'Amharic')
    for (const language of ['Amharic', 'Afaan Oromoo', 'Somali', 'Arabic', 'English']) {
      const text = generateGroupSmsMessage(language, { name: 'Khendeq Madrasa', nameAm: 'ኸንደቅ መድረሳ' })
      assert.ok(text.length > 20, `${language} message missing`)
    }
    assert.match(generateGroupSmsMessage('English', { name: 'Khendeq' }), /^From Khendeq/)
  })

  test('the Ustaz dashboard offers a group text and per-student texts; the admin list is grouped by class', () => {
    const teacher = fs.readFileSync(path.resolve('src/app/teacher/page.tsx'), 'utf8')
    assert.match(teacher, /absent\.sendSmsAll/)
    assert.match(teacher, /rowSmsHref\(r\)/)
    const admin = fs.readFileSync(path.resolve('src/app/admin/page.tsx'), 'utf8')
    assert.match(admin, /absentGroups\.map\(\(group\)/)
    assert.match(admin, /absent\.sendSmsAll/)
    const reports = fs.readFileSync(path.resolve('src/app/admin/weekly-reports/page.tsx'), 'utf8')
    assert.match(reports, /daily\.title/)
  })
})
