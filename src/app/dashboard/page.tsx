'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { homePathFor } from '@/components/ProtectedRoute'

/** Generic entry point: sends each user to their role's home screen. */
export default function DashboardPage() {
  const { user, school, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    router.replace(homePathFor(user.role, !!school))
  }, [loading, user, school, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
