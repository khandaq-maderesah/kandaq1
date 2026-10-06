'use client'

import { useAuth } from '@/context/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  allowedRoles,
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isTeacher } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push(redirectTo)
      return
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const hasAccess = allowedRoles.some(role => {
        if (role === 'admin') return isAdmin
        if (role === 'teacher') return isTeacher
        return false
      })

      if (!hasAccess) {
        // Redirect to appropriate dashboard based on role
        if (isAdmin) {
          router.push('/admin')
        } else if (isTeacher) {
          router.push('/teacher')
        } else {
          router.push(redirectTo)
        }
      }
    }
  }, [user, loading, allowedRoles, isAdmin, isTeacher, router, redirectTo, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const hasAccess = allowedRoles.some(role => {
      if (role === 'admin') return isAdmin
      if (role === 'teacher') return isTeacher
      return false
    })

    if (!hasAccess) {
      return null
    }
  }

  return <>{children}</>
}
