/** Languages the app is translated into. English is the source language. */
export const LOCALES = ['en', 'am', 'ar', 'om', 'so'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Each language's own name for itself (shown in the language switcher). */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  am: 'አማርኛ',
  ar: 'العربية',
  om: 'Afaan Oromoo',
  so: 'Soomaali',
}

export const LOCALE_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  am: 'ltr',
  ar: 'rtl',
  om: 'ltr',
  so: 'ltr',
}

/** localStorage key for the chosen language (also read by the inline script in the root layout). */
export const LOCALE_STORAGE_KEY = 'khandaq_locale'

/** localStorage key: who picked this device's language (a uid, or SIGNED_OUT_CHOOSER). */
export const LOCALE_CHOOSER_KEY = 'khandaq_locale_chosen_by'

/** Marks a language picked on a signed-out screen; the next account to sign in takes it. */
export const SIGNED_OUT_CHOOSER = 'signed-out'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * The language an account's saved profile puts on this device, or null to keep
 * what the device shows. A language picked on the device always stays: the
 * profile can be older than that choice (its save may have failed), and only
 * fills in where this person has not chosen, such as a first sign-in here or a
 * phone last set by someone else.
 */
export function localeFromAccount(chosenBy: string | null, uid: string, saved: unknown): Locale | null {
  if (chosenBy === uid || chosenBy === SIGNED_OUT_CHOOSER) return null
  return isLocale(saved) ? saved : null
}

/** Wait before retrying a language file that failed to load (attempt starts at 1). */
export function localeRetryDelayMs(attempt: number): number {
  return Math.min(60_000, 2_000 * 2 ** (attempt - 1))
}

/** Best match for the browser's preferred languages, falling back to English. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}
