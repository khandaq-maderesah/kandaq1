'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  GraduationCap,
  ClipboardList,
  Calendar,
  LogOut,
  User,
  Users,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/hooks/useAuth'
import { AbsenceAlertBell } from '@/components/AbsenceAlertBell'
import { AttendanceReminderBell } from '@/components/AttendanceReminderBell'
import { AnnouncementBell } from '@/components/AnnouncementBell'


export function TeacherNav() {
  const pathname = usePathname()
  const logout = useLogout()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const links = [
    { href: '/teacher/classes', label: 'My Classes', icon: GraduationCap },
    { href: '/teacher/students', label: 'Students', icon: Users },
    { href: '/teacher/exams', label: 'Exams & Results', icon: FileText },
    { href: '/teacher/attendance', label: 'Take Attendance', icon: ClipboardList },
    { href: '/teacher/history', label: 'History', icon: Calendar },
    { href: '/profile', label: 'Profile', icon: User },
  ]

  return (
    <nav className="bg-gradient-to-r from-green-100 via-emerald-100 to-amber-100 border-b border-green-200 shadow-sm sticky top-0 z-30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <Link href="/dashboard" className="flex items-center space-x-2 flex-shrink-0">
            <Image src="/image/khandaq-logo.png" alt="Khendeq Medresah logo" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
            <span className="font-bold text-xl text-gray-900">
              Teacher Panel
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex flex-1 min-w-0 items-center justify-start space-x-1 overflow-x-auto pl-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname.startsWith(link.href)
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-1 whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-green-50 text-green-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Logout Button */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <AttendanceReminderBell dark={false} />
            <AbsenceAlertBell teacherOnly dark={false} />
            <AnnouncementBell dark={false} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || pathname.startsWith(link.href)
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium',
                    isActive
                      ? 'bg-green-50 text-green-600'
                      : 'text-gray-600 hover:bg-gray-50'
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
