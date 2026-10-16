'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleShell } from '@/components/shell/RoleShell'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <RoleShell>{children}</RoleShell>
    </ProtectedRoute>
  )
}
