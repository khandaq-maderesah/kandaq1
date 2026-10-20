'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { sendPasswordResetEmail } from 'firebase/auth'
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { getAuthErrorKey, type AuthErrorInfo } from '@/lib/firebase/authErrors'
import { useLogin } from '@/hooks/useAuth'
import { useAuth } from '@/context/AuthContext'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LanguageSwitcher } from '@/components/shell/LanguageSwitcher'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { homePathFor } from '@/components/ProtectedRoute'
import { useEffect } from 'react'

/** A madrasa's public branding, for the branded sign-in page at /m/{slug}. */
export interface SignInBrand {
  schoolId: string
  slug: string
  name: string
  appName: string
  logoUrl: string
}

/**
 * Email + password sign-in. Without `brand` it is the default MMS sign-in; with
 * `brand` it shows the madrasa's logo/name and only accepts its accounts.
 */
export function SignInView({ brand }: { brand?: SignInBrand }) {
  const t = useTranslations('auth')
  const tc = useTranslations('common')
  const { user, loading: authLoading, school } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<AuthErrorInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [sending, setSending] = useState(false)

  const loginUser = useLogin()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(homePathFor(user.role, !!school))
    }
  }, [authLoading, user, school, router])

  const errorText = (info: AuthErrorInfo) => t(`errors.${info.key}`, { code: info.code })

  const handleForgotPassword = async () => {
    setResetSent(false)
    setResetError('')
    if (!email.trim()) {
      setResetError(t('forgot.emailRequired'))
      return
    }
    setSending(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (err) {
      const info = getAuthErrorKey(err)
      if (info.key === 'unknown' || info.key === 'unknownWithCode' || info.key === 'configuration') {
        console.error('Password reset failed', err)
        setResetError(t('forgot.failed'))
      } else {
        setResetError(errorText(info))
      }
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (forgotMode) {
      await handleForgotPassword()
      return
    }

    setIsLoading(true)
    const result = await loginUser(email, password, brand ? { schoolId: brand.schoolId } : undefined)

    if (result.success) {
      // Go straight to the right dashboard. The `profile` was read during
      // login, so we skip the extra /dashboard -> /admin (or /teacher)
      // navigation and its accompanying layout + fresh data subscriptions.
      const role = result.profile?.role
      // A platform admin signing in through a madrasa link opens that madrasa.
      router.replace(role ? homePathFor(role, role !== 'superadmin' || !!brand) : '/dashboard')
    } else {
      setError(result.error)
    }

    setIsLoading(false)
  }

  const switchMode = (forgot: boolean) => {
    setForgotMode(forgot)
    setError(null)
    setResetSent(false)
    setResetError('')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        {brand ? (
          <span />
        ) : (
          <Link href="/" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-muted-foreground')}>
            <ArrowLeft className="rtl:rotate-180" />
            {t('backHome')}
          </Link>
        )}
        <div className="flex items-center gap-1">
          <LanguageSwitcher showLabel />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center pt-8 text-center">
            {brand ? (
              // Madrasa logos come from Firebase Storage (any size/aspect).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" width={96} height={96} className="mb-3 h-24 w-24 object-contain" />
            ) : (
              <Image
                src="/image/logo-full.png"
                alt=""
                width={540}
                height={715}
                priority
                className="mb-3 h-28 w-auto object-contain"
              />
            )}
            <p className="text-sm font-medium text-muted-foreground">{brand ? brand.name : tc('appTagline')}</p>
            <CardTitle className="text-2xl">{forgotMode ? t('forgot.title') : t('title')}</CardTitle>
            <CardDescription>{forgotMode ? t('forgot.subtitle') : t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!forgotMode && error && (
                <Alert variant="destructive">
                  <AlertDescription>{errorText(error)}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{tc('fields.email')}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    dir="ltr"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="ps-10 text-start"
                    required
                  />
                </div>
              </div>

              {forgotMode ? (
                <>
                  {resetError && (
                    <Alert variant="destructive">
                      <AlertDescription>{resetError}</AlertDescription>
                    </Alert>
                  )}
                  {resetSent && (
                    <Alert variant="success">
                      <AlertDescription>{t('forgot.sent')}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={sending}>
                    {sending ? <Loader2 className="animate-spin" /> : <KeyRound />}
                    {sending ? t('forgot.sending') : t('forgot.send')}
                  </Button>

                  <div className="text-center">
                    <Button type="button" variant="link" onClick={() => switchMode(false)}>
                      {t('forgot.back')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">{tc('fields.password')}</Label>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => switchMode(true)}
                      >
                        {t('forgotPassword')}
                      </Button>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pe-11 ps-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute end-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="animate-spin" />}
                    {isLoading ? t('signingIn') : t('signIn')}
                  </Button>
                </>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">{t('noAccount')}</p>
          </CardContent>
        </Card>
      </main>
      {brand && (
        <footer className="pb-6 text-center text-xs text-muted-foreground">{t('poweredBy')}</footer>
      )}
    </div>
  )
}
