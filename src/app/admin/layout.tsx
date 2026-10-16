'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleShell } from '@/components/shell/RoleShell'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <RoleShell>{children}</RoleShell>
    </ProtectedRoute>
  )
}
