'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { TeacherNav } from '@/components/TeacherNav'

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <div className="min-h-screen overflow-x-hidden bg-slate-50">
        <TeacherNav />
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
