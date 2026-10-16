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

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
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
