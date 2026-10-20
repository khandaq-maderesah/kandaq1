'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { UserRole } from '@/types'
import { signInPath } from '@/lib/brandMemory'
import { OfflineScreen } from '@/components/OfflineScreen'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

/** Where a user lands after sign-in (or when they open a page they can't use). */
export function homePathFor(role: UserRole | undefined, hasSchool: boolean): string {
  if (role === 'superadmin') return hasSchool ? '/admin' : '/superadmin'
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/login'
}

export function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isTeacher, isSuperAdmin, school, stalled, offline } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // 'admin' pages work on the current school, so a superadmin may use them
  // once a school is opened (isAdmin covers that case).
  const hasAccess =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => {
      if (role === 'superadmin') return isSuperAdmin
      if (role === 'admin') return isAdmin
      if (role === 'teacher') return isTeacher
      return false
    })

  useEffect(() => {
    if (loading) return

    if (!user) {
      // Offline without a usable session: the offline screen explains why
      // nothing happens, instead of bouncing to a sign-in page that cannot
      // reach the server either.
      if (stalled) return
      router.push(redirectTo ?? signInPath())
      return
    }

    if (!hasAccess) {
      router.push(homePathFor(user.role, !!school))
    }
  }, [user, loading, hasAccess, school, router, redirectTo, pathname, stalled])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" aria-hidden="true"></div>
      </div>
    )
  }

  if (!user) {
    // Offline without a usable session: say so instead of bouncing to a
    // sign-in page that cannot reach the server either.
    return stalled && offline ? <OfflineScreen /> : null
  }

  if (!hasAccess) return null

  return <>{children}</>
}
