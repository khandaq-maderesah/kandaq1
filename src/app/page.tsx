'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  Languages,
  LogIn,
  PhoneCall,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { homePathFor } from '@/components/ProtectedRoute'

const FEATURES: { key: 'attendance' | 'students' | 'exams' | 'parents' | 'reports' | 'languages'; icon: LucideIcon }[] = [
  { key: 'attendance', icon: ClipboardCheck },
  { key: 'students', icon: Users },
  { key: 'exams', icon: FileText },
  { key: 'parents', icon: PhoneCall },
  { key: 'reports', icon: BarChart3 },
  { key: 'languages', icon: Languages },
]

export default function Home() {
  const t = useTranslations('landing')
  const tc = useTranslations('common')
  const { user, loading, school } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace(homePathFor(user.role, !!school))
    }
  }, [loading, user, school, router])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/image/logo-mark.png"
              alt=""
              width={40}
              height={40}
              priority
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="truncate font-semibold text-foreground">{tc('appName')}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher showLabel />
            <ThemeToggle />
            <Link href="/login" className={buttonVariants({ size: 'sm' })}>
              <LogIn className="rtl:rotate-180" />
              {t('nav.signIn')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
            <Image
              src="/image/logo-full.png"
              alt={tc('appName')}
              width={540}
              height={715}
              priority
              className="mb-8 h-44 w-auto object-contain sm:h-56"
            />
            <span className="mb-5 inline-flex items-center rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {t('hero.eyebrow')}
            </span>
            <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              {t('hero.subtitle')}
            </p>
            <div className="mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
              <Link href="/login" className={buttonVariants({ size: 'lg' })}>
                {t('hero.cta')}
                <ArrowRight className="rtl:rotate-180" />
              </Link>
              <a href="#features" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
                {t('hero.secondary')}
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {t('features.title')}
              </h2>
              <p className="mt-3 text-muted-foreground">{t('features.subtitle')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {FEATURES.map(({ key, icon: Icon }) => (
                <div key={key} className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{t(`features.${key}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`features.${key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground sm:px-6">
          {t('footer.copyright', { year: String(new Date().getFullYear()) })}
        </div>
      </footer>
    </div>
  )
}
