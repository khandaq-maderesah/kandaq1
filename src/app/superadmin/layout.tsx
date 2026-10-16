'use client'

import Link from 'next/link'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/useAuth'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const logout = useLogout()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <div className="min-h-screen overflow-x-hidden bg-slate-50">
        <nav className="bg-gradient-to-r from-slate-900 via-green-900 to-amber-800 shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <Link href="/superadmin" className="flex items-center space-x-2">
                <Image src="/image/khandaq-logo.png" alt="Khendeq logo" width={36} height={36} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70" />
                <span className="font-bold text-xl text-white">Platform Admin</span>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="rounded-full border border-white/40 bg-white/10 px-4 text-white hover:bg-white hover:text-red-600"
              >
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          </div>
        </nav>
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
