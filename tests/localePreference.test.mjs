import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SIGNED_OUT_CHOOSER, localeFromAccount, localeRetryDelayMs } from '../src/i18n/config.ts'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** Users reported the app turning English by itself while they worked. */
describe('A language picked on the device stays', () => {
  test('the profile never overrides what this person picked here', () => {
    assert.equal(localeFromAccount('user-1', 'user-1', 'en'), null)
  })

  test('a language picked on the sign-in page stays after signing in', () => {
    assert.equal(localeFromAccount(SIGNED_OUT_CHOOSER, 'user-1', 'en'), null)
  })

  test('the profile fills in on a first sign-in on this device', () => {
    assert.equal(localeFromAccount(null, 'user-1', 'am'), 'am')
  })

  test('on a shared phone the next person gets their own language', () => {
    assert.equal(localeFromAccount('user-1', 'user-2', 'so'), 'so')
  })

  test('a profile without a valid language changes nothing', () => {
    assert.equal(localeFromAccount(null, 'user-1', undefined), null)
    assert.equal(localeFromAccount('user-1', 'user-2', 'Amharic'), null)
  })
})

describe('Only a fresh profile can change the language', () => {
  const auth = read('src/context/AuthContext.tsx')

  test('the two places that read the server apply it, and no cached path does', () => {
    const calls = auth.match(/applyAccountLocale\(profile\.uid, profile\.language\)/g) ?? []
    assert.equal(calls.length, 2)
    assert.match(auth, /applySchool\(resolvedSchool\)\s+\}\s+applyAccountLocale\(profile\.uid/)
    assert.match(auth, /lastLogin[\s\S]{0,120}applyAccountLocale\(profile\.uid/)
  })

  test('the language pickers record who chose', () => {
    for (const path of ['src/components/shell/LanguageSwitcher.tsx', 'src/app/profile/page.tsx']) {
      assert.match(read(path), /chooseLocale\(value, user\?\.uid \?\? null\)/, path)
    }
  })
})

describe('A language file that fails to load', () => {
  const provider = read('src/i18n/I18nProvider.tsx')

  test('is tried again, soon at first, then at most once a minute', () => {
    assert.equal(localeRetryDelayMs(1), 2_000)
    assert.equal(localeRetryDelayMs(2), 4_000)
    assert.equal(localeRetryDelayMs(3), 8_000)
    assert.equal(localeRetryDelayMs(50), 60_000)
  })

  test('is tried again when the connection returns and the failure is remembered', () => {
    assert.match(provider, /setRetry\(\{ locale: next, attempt: attempt \+ 1 \}\)/)
    assert.match(provider, /addEventListener\('online', again\)/)
  })

  test('a slower, older request cannot replace the latest choice', () => {
    assert.match(provider, /if \(id !== latestSwitch\.current\) return\s+setMessages\(loaded\)/)
  })
})
