import type messages from './messages/en'
import type { Locale } from './config'

// Type-checks translation keys: t('nav.dashboard') etc. must exist in English.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale
    Messages: typeof messages
  }
}
