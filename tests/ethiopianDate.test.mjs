import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const {
  ETHIOPIAN_MONTHS,
  toEthiopianParts,
  ethiopianDateLabel,
  ethiopianDateShort,
} = await import('../src/lib/ethiopianDate.ts')

describe('Ethiopian Calendar Date Utilities & Edge Cases', () => {
  test('has 13 Ethiopian months defined in Ge\'ez script', () => {
    assert.equal(ETHIOPIAN_MONTHS.length, 13)
    assert.equal(ETHIOPIAN_MONTHS[0], 'መስከረም')
    assert.equal(ETHIOPIAN_MONTHS[12], 'ጳጉሜ')
  })

  test('converts Enkutatash (Ethiopian New Year 2017) accurately', () => {
    // 2024-09-11 is 2017 Meskerem 1
    const parts = toEthiopianParts('2024-09-11')
    assert.ok(parts, 'Parts should not be null')
    assert.equal(parts.year, 2017)
    assert.equal(parts.month, 1)
    assert.equal(parts.day, 1)

    const short = ethiopianDateShort('2024-09-11')
    assert.equal(short, '2017-01-01')

    const label = ethiopianDateLabel('2024-09-11')
    assert.equal(label, '1 መስከረም 2017')
  })

  test('converts Pagume (13th Month) edge case dates correctly', () => {
    // 2024-09-06 is Pagume 1, 2016
    const parts = toEthiopianParts('2024-09-06')
    assert.ok(parts)
    assert.equal(parts.year, 2016)
    assert.equal(parts.month, 13)
    assert.equal(parts.day, 1)

    const short = ethiopianDateShort('2024-09-06')
    assert.equal(short, '2016-13-01')

    const label = ethiopianDateLabel('2024-09-06')
    assert.equal(label, '1 ጳጉሜ 2016')
  })

  test('converts Gregorian year-end / year-start within same Ethiopian year', () => {
    // 2024-12-31 is Tahsas 22, 2017
    const dec31 = toEthiopianParts('2024-12-31')
    assert.ok(dec31)
    assert.equal(dec31.year, 2017)
    assert.equal(dec31.month, 4) // Tahsas

    // 2025-01-01 is Tahsas 23, 2017 (Same Ethiopian Year!)
    const jan01 = toEthiopianParts('2025-01-01')
    assert.ok(jan01)
    assert.equal(jan01.year, 2017)
    assert.equal(jan01.month, 4)
    assert.equal(jan01.day, dec31.day + 1)
  })

  test('handles ISO strings with timestamps and timezones', () => {
    const isoUtc = toEthiopianParts('2024-09-11T00:00:00.000Z')
    assert.ok(isoUtc)
    assert.equal(isoUtc.year, 2017)
    assert.equal(isoUtc.month, 1)
    assert.equal(isoUtc.day, 1)
  })

  test('returns null / undefined for invalid date inputs gracefully without throwing', () => {
    assert.equal(toEthiopianParts('invalid-date'), null)
    assert.equal(toEthiopianParts(''), null)
    assert.equal(toEthiopianParts(undefined), null)
    assert.equal(ethiopianDateShort('invalid'), undefined)
    assert.equal(ethiopianDateShort(''), undefined)
    assert.equal(ethiopianDateLabel('invalid'), undefined)
    assert.equal(ethiopianDateLabel(''), undefined)
  })
})
