'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NextIntlClientProvider, IntlErrorCode, type IntlError } from 'next-intl'
import enMessages from './messages/en'
import {
  DEFAULT_LOCALE,
  LOCALE_CHOOSER_KEY,
  LOCALE_DIR,
  LOCALE_STORAGE_KEY,
  SIGNED_OUT_CHOOSER,
  detectBrowserLocale,
  isLocale,
  localeFromAccount,
  localeRetryDelayMs,
  type Locale,
} from './config'

type Messages = typeof enMessages

// Only the active language is downloaded; English is bundled as the fallback.
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<{ default: unknown }>> = {
  am: () => import('./messages/am'),
  ar: () => import('./messages/ar'),
  om: () => import('./messages/om'),
  so: () => import('./messages/so'),
}

/** Missing translations fall back to the English text, key by key. */
function withFallback(base: unknown, override: unknown): unknown {
  if (!override || typeof override !== 'object') return override ?? base
  if (!base || typeof base !== 'object') return override
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    out[k] = withFallback(out[k], v)
  }
  return out
}

async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === 'en') return enMessages
  const mod = await loaders[locale]()
  return withFallback(enMessages, mod.default) as Messages
}

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSetting(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

function readStoredLocale(): Locale | null {
  const v = readSetting(LOCALE_STORAGE_KEY)
  return isLocale(v) ? v : null
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALE_DIR[locale]
}

interface LocaleContextValue {
  locale: Locale
  /** The person at this device picked a language; `uid` is null when signed out. */
  chooseLocale: (locale: Locale, uid: string | null) => void
  /**
   * Applies a profile just read from the server. Never pass a cached profile:
   * it can be older than the person's last choice.
   */
  applyAccountLocale: (uid: string, saved: unknown) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

export function useLocaleSettings(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocaleSettings must be used within I18nProvider')
  return ctx
}

function onIntlError(error: IntlError) {
  // A missing key already falls back to English; only log real problems.
  if (error.code === IntlErrorCode.MISSING_MESSAGE) return
  console.error(error)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)
  const [messages, setMessages] = useState<Messages>(enMessages)
  // Server render and first client render are identical (English, hidden
  // until the stored language is known) to avoid a hydration mismatch and a
  // flash of English for other-language users.
  const [ready, setReady] = useState(false)
  // A language file that failed to load, waiting for another try.
  const [retry, setRetry] = useState<{ locale: Locale; attempt: number } | null>(null)
  // Files load at different speeds: only the latest request may take effect.
  const latestSwitch = useRef(0)

  const switchTo = useCallback(async (next: Locale, attempt = 0) => {
    const id = ++latestSwitch.current
    setRetry(null)
    try {
      const loaded = await loadMessages(next)
      if (id !== latestSwitch.current) return
      setMessages(loaded)
      setLocaleState(next)
      applyDocumentLocale(next)
    } catch (err) {
      if (id !== latestSwitch.current) return
      console.error('Failed to load translations for', next, err)
      setRetry({ locale: next, attempt: attempt + 1 })
    } finally {
      if (id === latestSwitch.current) setReady(true)
    }
  }, [])

  useEffect(() => {
    switchTo(readStoredLocale() ?? detectBrowserLocale())
  }, [switchTo])

  // On a weak connection the file can fail to arrive. The app stays usable in
  // English meanwhile, and the language comes back without a reload.
  useEffect(() => {
    if (!retry) return
    const again = () => switchTo(retry.locale, retry.attempt)
    const timer = navigator.onLine ? setTimeout(again, localeRetryDelayMs(retry.attempt)) : undefined
    window.addEventListener('online', again)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', again)
    }
  }, [retry, switchTo])

  const chooseLocale = useCallback(
    (next: Locale, uid: string | null) => {
      writeSetting(LOCALE_STORAGE_KEY, next)
      writeSetting(LOCALE_CHOOSER_KEY, uid ?? SIGNED_OUT_CHOOSER)
      switchTo(next)
    },
    [switchTo]
  )

  const applyAccountLocale = useCallback(
    (uid: string, saved: unknown) => {
      const chosenBy = readSetting(LOCALE_CHOOSER_KEY)
      if (chosenBy === SIGNED_OUT_CHOOSER) writeSetting(LOCALE_CHOOSER_KEY, uid)
      const next = localeFromAccount(chosenBy, uid, saved)
      if (!next) return
      // The device no longer shows the previous person's pick.
      writeSetting(LOCALE_CHOOSER_KEY, null)
      if (next === readStoredLocale()) return
      writeSetting(LOCALE_STORAGE_KEY, next)
      switchTo(next)
    },
    [switchTo]
  )

  return (
    <LocaleContext.Provider value={{ locale, chooseLocale, applyAccountLocale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="Africa/Addis_Ababa"
        onError={onIntlError}
      >
        {ready ? children : <div className="min-h-screen bg-background" aria-busy="true" />}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}
