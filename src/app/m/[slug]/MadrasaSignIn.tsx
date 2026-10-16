'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, SearchX } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathFor } from '@/components/ProtectedRoute'
import { SignInView, type SignInBrand } from '@/components/auth/SignInView'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/page'
import { rememberBrandSlug } from '@/lib/brandMemory'

export function MadrasaSignIn({ brand }: { brand: SignInBrand }) {
  const { user, loading, school } = useAuth()
  const router = useRouter()

  // This device signs in through this madrasa from now on.
  useEffect(() => {
    rememberBrandSlug(brand.slug)
  }, [brand.slug])

  // Opening the installed app while already signed in goes straight in.
  const belongsHere = !!user && (user.role === 'superadmin' || user.schoolId === brand.schoolId)
  useEffect(() => {
    if (!loading && user && belongsHere) router.replace(homePathFor(user.role, !!school))
  }, [loading, user, belongsHere, school, router])

  if (loading || belongsHere) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  return <SignInView brand={brand} />
}

export function MadrasaNotFound() {
  const t = useTranslations('auth.madrasaNotFound')

  // A stale remembered link should not keep sending people here.
  useEffect(() => {
    rememberBrandSlug(null)
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <EmptyState
        icon={SearchX}
        title={t('title')}
        description={t('description')}
        action={
          <Link href="/login" className={buttonVariants()}>
            {t('action')}
          </Link>
        }
        className="w-full max-w-md"
      />
    </div>
  )
}
