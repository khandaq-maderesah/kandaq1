import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const LOCALES = ['en', 'am', 'ar', 'om', 'so']

/** The "offline" label must never cover the Save bar at the bottom of the screen. */
describe('Offline label', () => {
  const source = read('src/components/NetworkStatus.tsx')

  test('sits at the top, under the app bar, not at the bottom where the save bars are', () => {
    const className = source.match(/className="no-print[^"]*"/)?.[0] ?? ''
    assert.match(className, /\btop-\[4\.25rem\]/)
    assert.doesNotMatch(className, /\bbottom-/)
    // Below popovers and dialogs (z-50), above the page and the app bar (z-20).
    assert.match(className, /z-\[25\]/)
  })

  test('shows the short label and keeps the full sentence as tooltip and screen-reader text', () => {
    assert.match(source, /t\('offline\.short'\)/)
    assert.match(source, /title=\{t\('offline\.banner'\)\}/)
    assert.match(source, /aria-label=\{t\('offline\.banner'\)\}/)
  })

  test('every language has a short label that stays on one line', () => {
    for (const locale of LOCALES) {
      const offline = JSON.parse(read(`src/i18n/messages/${locale}/common.json`)).offline
      assert.ok(offline.short && offline.short.length <= 24, `${locale}: ${offline.short}`)
      assert.ok(offline.banner.length > offline.short.length || locale === 'en', locale)
    }
  })

  test('the sticky save bars sit below it in the stacking order', () => {
    // The attendance and report save bars are z-10: the label (z-25) would only ever overlap them if it were at the bottom.
    assert.match(read('src/app/teacher/attendance/page.tsx'), /sticky bottom-0 z-10/)
  })
})
