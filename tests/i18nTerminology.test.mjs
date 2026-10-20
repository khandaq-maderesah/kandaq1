import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('i18n Islamic Educational Terminology Invariants', () => {
  const enDir = path.resolve('src/i18n/messages/en')
  const amDir = path.resolve('src/i18n/messages/am')

  function extractStringValues(obj, results = []) {
    if (typeof obj === 'string') {
      results.push(obj)
    } else if (typeof obj === 'object' && obj !== null) {
      for (const val of Object.values(obj)) {
        extractStringValues(val, results)
      }
    }
    return results
  }

  test('English translation dictionaries enforce Madrasa and Ustaz terminology', () => {
    const files = fs.readdirSync(enDir).filter(f => f.endsWith('.json'))
    assert.ok(files.length > 10, 'Expected multiple JSON dictionary files in en')

    const prohibitedEnglish = [
      /\bteachers\b/i,
      /\bteacher\b/i,
      /\bschools\b/i,
      /\bschool\b/i,
    ]

    const violations = []

    for (const file of files) {
      const content = fs.readFileSync(path.join(enDir, file), 'utf8')
      const json = JSON.parse(content)
      const values = extractStringValues(json)

      for (const str of values) {
        // Strip out allowable interpolation variables {teacher}, {school}, etc.
        const cleanedStr = str
          .replace(/\{teacher\}/gi, '')
          .replace(/\{school\}/gi, '')

        for (const pattern of prohibitedEnglish) {
          if (pattern.test(cleanedStr)) {
            violations.push({ file, str, match: cleanedStr.match(pattern)?.[0] })
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found prohibited terminology in English translations: ${JSON.stringify(violations, null, 2)}`
    )
  })

  test('Amharic translation dictionaries enforce መድረሳ and ኡስታዝ terminology', () => {
    const files = fs.readdirSync(amDir).filter(f => f.endsWith('.json'))
    assert.ok(files.length > 10, 'Expected multiple JSON dictionary files in am')

    const prohibitedAmharic = [
      'አስተማሪ',
      'አስተማሪዎች',
      'ትምህርት ቤት',
      'ትምህርት ቤቶች',
    ]

    const violations = []

    for (const file of files) {
      const content = fs.readFileSync(path.join(amDir, file), 'utf8')
      const json = JSON.parse(content)
      const values = extractStringValues(json)

      for (const str of values) {
        for (const word of prohibitedAmharic) {
          if (str.includes(word)) {
            violations.push({ file, str, word })
          }
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found prohibited terminology in Amharic translations: ${JSON.stringify(violations, null, 2)}`
    )
  })

  test('Core Islamic terminology exists in key namespaces', () => {
    const enNav = JSON.parse(fs.readFileSync(path.join(enDir, 'nav.json'), 'utf8'))
    const enCommon = JSON.parse(fs.readFileSync(path.join(enDir, 'common.json'), 'utf8'))
    const amNav = JSON.parse(fs.readFileSync(path.join(amDir, 'nav.json'), 'utf8'))
    const amCommon = JSON.parse(fs.readFileSync(path.join(amDir, 'common.json'), 'utf8'))

    assert.equal(enNav.schools, 'Madrasas')
    assert.equal(enNav.teachers, 'Ustazes')
    assert.equal(enCommon.roles.teacher, 'Ustaz')

    assert.equal(amNav.schools, 'መድረሳዎች')
    assert.equal(amCommon.roles.teacher, 'ኡስታዝ')
  })
})
