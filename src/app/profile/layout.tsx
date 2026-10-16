'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RoleShell } from '@/components/shell/RoleShell'

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <RoleShell>{children}</RoleShell>
    </ProtectedRoute>
  )
}
