'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleShell } from '@/components/shell/RoleShell'

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <RoleShell>{children}</RoleShell>
    </ProtectedRoute>
  )
}
