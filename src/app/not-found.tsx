'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  const t = useTranslations('landing.notFound')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="text-6xl font-semibold tabular-nums tracking-tight text-primary">{t('code')}</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('description')}</p>
      <Link href="/" className={buttonVariants({ className: 'mt-6' })}>
        {t('home')}
      </Link>
    </div>
  )
}
