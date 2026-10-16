'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NextIntlClientProvider, IntlErrorCode, type IntlError } from 'next-intl'
import enMessages from './messages/en'
import {
  DEFAULT_LOCALE,
  LOCALE_DIR,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  isLocale,
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

function readStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALE_DIR[locale]
}

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
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

  const switchTo = useCallback(async (next: Locale) => {
    try {
      const loaded = await loadMessages(next)
      setMessages(loaded)
      setLocaleState(next)
      applyDocumentLocale(next)
    } catch (err) {
      console.error('Failed to load translations for', next, err)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    switchTo(readStoredLocale() ?? detectBrowserLocale())
  }, [switchTo])

  const setLocale = useCallback(
    (next: Locale) => {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      switchTo(next)
    },
    [switchTo]
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
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
