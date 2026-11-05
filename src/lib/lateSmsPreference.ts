/**
 * Whether the Ustaz wants to text the parents of LATE students too (after
 * saving attendance). Remembered on this device; off until they turn it on,
 * because texting late students is optional and absence texts are the duty.
 */
const KEY = 'kmms_text_late_parents'

export function readLateSmsPreference(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeLateSmsPreference(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* private mode: the choice just is not remembered */
  }
}
