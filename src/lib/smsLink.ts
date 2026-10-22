/**
 * Links that open the phone's own SMS app (no server, no cost to the madrasa).
 *
 * One recipient: `sms:<number>?body=...` works everywhere. Several recipients
 * (a group text to every absent student's parent): Android and most phones
 * take `sms:<a>,<b>?body=...`; iPhone needs `sms:/open?addresses=<a>,<b>&body=...`.
 */
export type SmsPlatform = 'ios' | 'other'

export function detectSmsPlatform(userAgent: string): SmsPlatform {
  return /iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : 'other'
}

/** Cleans and de-duplicates phone numbers; empty or placeholder values are dropped. */
export function uniquePhones(numbers: (string | undefined | null)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of numbers) {
    const phone = (raw || '').replace(/[^\d+]/g, '')
    if (!phone || seen.has(phone)) continue
    seen.add(phone)
    out.push(phone)
  }
  return out
}

export function smsHref(phone: string, body: string): string {
  return `sms:${phone}?body=${encodeURIComponent(body)}`
}

/** A group text to several numbers, or null when there is nobody to text. */
export function groupSmsHref(numbers: string[], body: string, platform: SmsPlatform): string | null {
  const phones = uniquePhones(numbers)
  if (phones.length === 0) return null
  const list = phones.join(',')
  if (platform === 'ios') return `sms:/open?addresses=${list}&body=${encodeURIComponent(body)}`
  return `sms:${list}?body=${encodeURIComponent(body)}`
}

/** The language most parents of a group use (Amharic when unknown). */
export function dominantLanguage(languages: (string | undefined | null)[]): string {
  const counts = new Map<string, number>()
  for (const l of languages) if (l) counts.set(l, (counts.get(l) ?? 0) + 1)
  let best = 'Amharic'
  let bestCount = 0
  counts.forEach((count, language) => {
    if (count > bestCount) {
      best = language
      bestCount = count
    }
  })
  return best
}
