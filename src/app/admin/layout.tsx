'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminNav } from '@/components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <div className="min-h-screen overflow-x-hidden bg-slate-50">
        <AdminNav />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
