'use client'

import { Languages } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocaleSettings } from '@/i18n/I18nProvider'
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/config'
import { useAuth } from '@/context/AuthContext'
import { updateUser } from '@/lib/database'
import { cn } from '@/lib/utils'

/** Language picker. A signed-in user's choice is saved to their profile. */
export function LanguageSwitcher({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const t = useTranslations('common')
  const { locale, setLocale } = useLocaleSettings()
  const { user } = useAuth()

  const change = (value: string) => {
    if (!isLocale(value) || value === locale) return
    setLocale(value)
    if (user) {
      updateUser(user.uid, { language: value }).catch(() => {
        /* the local choice still applies */
      })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={showLabel ? 'sm' : 'icon'} className={cn('text-muted-foreground', className)} aria-label={t('language')}>
          <Languages />
          {showLabel && <span>{LOCALE_NAMES[locale]}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={change}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'}>
              {LOCALE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
