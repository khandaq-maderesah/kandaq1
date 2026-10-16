'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminNav } from '@/components/AdminNav'
import { useAuth } from '@/context/AuthContext'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { school } = useAuth()

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      {/* Keyed by school: a superadmin switching schools remounts every page and
          live subscription, so nothing from the previous school lingers. */}
      <div key={school?.id ?? 'none'} className="min-h-screen overflow-x-hidden bg-slate-50">
        <AdminNav />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
