'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  LogOut,
  User,
  Settings,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/useAuth'
import { AbsenceAlertBell } from '@/components/AbsenceAlertBell'
import { AttendanceReminderBell } from '@/components/AttendanceReminderBell'
import { AnnouncementBell } from '@/components/AnnouncementBell'

export function AdminNav() {
  const pathname = usePathname()
  const logout = useLogout()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/teachers', label: 'Users', icon: Users },
    { href: '/admin/classes', label: 'Classes', icon: GraduationCap },
    { href: '/admin/students', label: 'Students', icon: GraduationCap },
    { href: '/admin/exams', label: 'Results', icon: FileText },
    { href: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="bg-gradient-to-r from-green-700 via-green-700 to-amber-700 shadow-lg sticky top-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
            <Image src="/image/khandaq-logo.png" alt="Khandaq Madresah logo" width={36} height={36} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70 shadow-md" />
            <span className="font-bold text-xl text-white drop-shadow-sm">
              Admin Panel
            </span>
          </Link>

          <div className="hidden lg:flex flex-1 min-w-0 items-center justify-start space-x-1 overflow-x-auto pl-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive =
                pathname === link.href ||
                (link.href !== '/dashboard' && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'group relative flex items-center space-x-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white text-green-700 shadow-md shadow-green-900/30 scale-[1.03]'
                      : 'text-white/85 hover:bg-white/15 hover:text-white'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      !isActive && 'group-hover:scale-110'
                    )}
                  />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <AttendanceReminderBell />
            <AbsenceAlertBell />
            <AnnouncementBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="rounded-full border border-white/40 bg-white/10 px-4 text-white shadow-sm backdrop-blur transition-all duration-200 hover:bg-white hover:text-red-600 hover:shadow-md"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>

        <div className="lg:hidden pb-3">
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = link.icon
              const isActive =
                pathname === link.href ||
                (link.href !== '/dashboard' && pathname.startsWith(link.href))

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-white text-green-700 shadow-sm'
                      : 'text-white/85 hover:bg-white/15 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
