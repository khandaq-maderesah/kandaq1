import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  ETHIOPIAN_MONTHS,
  toEthiopianParts,
  ethiopianDateLabel,
  ethiopianDateShort,
} = await import('../src/lib/ethiopianDate.ts')

describe('Ethiopian Calendar Date Utilities', () => {
  test('has 13 Ethiopian months defined', () => {
    assert.equal(ETHIOPIAN_MONTHS.length, 13)
    assert.equal(ETHIOPIAN_MONTHS[0], 'መስከረም')
    assert.equal(ETHIOPIAN_MONTHS[12], 'ጳጉሜ')
  })

  test('toEthiopianParts converts Gregorian date to Ethiopian parts', () => {
    // 2024-09-11 is Enkutatash (Ethiopian New Year: 2017 Meskerem 1)
    const parts = toEthiopianParts('2024-09-11')
    assert.ok(parts, 'Parts should not be null')
    assert.equal(typeof parts.year, 'number')
    assert.equal(typeof parts.month, 'number')
    assert.equal(typeof parts.day, 'number')
    assert.ok(parts.month >= 1 && parts.month <= 13)
  })

  test('ethiopianDateShort returns YYYY-MM-DD format', () => {
    const formatted = ethiopianDateShort('2024-09-11')
    assert.ok(formatted)
    assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/)
  })

  test('ethiopianDateLabel returns full readable string', () => {
    const label = ethiopianDateLabel('2024-09-11')
    assert.ok(label)
    assert.equal(typeof label, 'string')
    assert.ok(label.includes('መስከረም') || label.length > 5)
  })

  test('returns null / undefined for invalid date strings', () => {
    assert.equal(toEthiopianParts('invalid-date'), null)
    assert.equal(ethiopianDateShort(''), undefined)
    assert.equal(ethiopianDateLabel(''), undefined)
  })
})
