/**
 * Ethiopian calendar helpers.
 *
 * Uses the ECMA-402 Intl API with the "ethiopic" calendar (Amete Mihret – ERA1,
 * ~7–8 years behind the proleptic Gregorian calendar), which is the official
 * civil calendar in Ethiopia. Falls back gracefully to the Gregorian date when
 * the runtime does not support the ethiopic calendar.
 */

export interface EthiopianParts {
  year: number
  /** 1..13 (month 13 is Pagume). */
  month: number
  day: number
}

/** Names of the 13 Ethiopian months in Amharic (Ge'ez script). */
export const ETHIOPIAN_MONTHS = [
  'መስከረም', // Meskerem
  'ጥቅምት', // Tikimt
  'ህዳር', // Hidar
  'ታህሳስ', // Tahsas
  'ጥር', // Tir
  'የካቲት', // Yekatit
  'መጋቢት', // Megabit
  'ሚያዝያ', // Miazia
  'ግንቦት', // Ginbot
  'ሰኔ', // Sene
  'ሐምሌ', // Hamle
  'ነሐሴ', // Nehase
  'ጳጉሜ', // Pagume
]

let cachedFormat: Intl.DateTimeFormat | null | undefined

// A sample Gregorian date that must fall inside the Ethiopian calendar: 11 Sep 2015.
const SAMPLE = new Date(Date.UTC(2015, 8, 11))

// English month names as returned by the en-GB ethiopic formatter. This is an
// internal capability check only — it is NOT user-facing, so it intentionally
// stays in English (the matching here verifies the runtime switched to the
// Ethiopian calendar, since even the numeric formatter still returns English
// month names while formatted as a full date string).
const MONTH_MARKERS =
  /Meskerem|Tikimt|Hidar|Tahsas|Tir|Yekatit|Megabit|Miazia|Ginbot|Sene|Hamle|Nehase|Pagume/i

function getFormat(): Intl.DateTimeFormat | null {
  if (cachedFormat !== undefined) return cachedFormat
  try {
    // The long-form output (e.g. "6 Pagumen 2007 ERA1") contains an English month
    // name, letting us confirm the calendar switched to Ethiopic rather than
    // silently staying on the Gregorian calendar.
    const check = new Intl.DateTimeFormat('en-GB-u-ca-ethiopic', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (!MONTH_MARKERS.test(check.format(SAMPLE))) {
      cachedFormat = null
      return null
    }
    // Numeric formatter used to extract the Ethiopian month/day/year parts.
    cachedFormat = new Intl.DateTimeFormat('en-GB-u-ca-ethiopic', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    return cachedFormat
  } catch {
    cachedFormat = null
    return null
  }
}

/** Convert a date string (YYYY-MM-DD or ISO) to Ethiopian calendar parts, or null when unsupported/invalid. */
export function toEthiopianParts(dateStr?: string): EthiopianParts | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const fmt = getFormat()
  if (!fmt) return null

  let year = NaN
  let month = NaN
  let day = NaN
  for (const part of fmt.formatToParts(d)) {
    // Cast to string: some engines report the Ethiopian year as "relatedYear",
    // which is not part of TypeScript's DateTimeFormatPart type union.
    const type = part.type as string
    if (type === 'year' || type === 'relatedYear') year = Number(part.value)
    else if (type === 'month') month = Number(part.value)
    else if (type === 'day') day = Number(part.value)
  }
  if (Number.isNaN(year) || month < 1 || month > 13 || Number.isNaN(day)) return null
  return { year, month, day }
}

/** Full Ethiopian label, e.g. "Tahsas 22, 1962". */
export function ethiopianDateLabel(dateStr?: string): string | undefined {
  const p = toEthiopianParts(dateStr)
  if (!p) return undefined
  return `${p.day} ${ETHIOPIAN_MONTHS[p.month - 1]} ${p.year}`
}

/** Compact Ethiopian date "YYYY-MM-DD". */
export function ethiopianDateShort(dateStr?: string): string | undefined {
  const p = toEthiopianParts(dateStr)
  if (!p) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}