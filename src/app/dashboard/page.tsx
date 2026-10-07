'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useIsAdmin } from '@/hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, GraduationCap, ClipboardList, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, loading } = useUser()
  const isAdmin = useIsAdmin()
  // (unused role hook removed)
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    if (user.role === 'admin') {
      router.replace('/admin')
    } else if (user.role === 'teacher') {
      router.replace('/teacher')
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  const welcomeMessage = isAdmin 
    ? 'Welcome to Admin Dashboard' 
    : 'Welcome to Teacher Dashboard'

  const stats = isAdmin ? [
    {
      title: 'Manage Teachers',
      description: 'Add and manage teacher accounts',
      icon: Users,
      href: '/admin/teachers',
      color: 'bg-green-500'
    },
    {
      title: 'Manage Classes',
      description: 'Create and assign classes',
      icon: GraduationCap,
      href: '/admin/classes',
      color: 'bg-green-500'
    },
    {
      title: 'Manage Students',
      description: 'Register and manage students',
      icon: Users,
      href: '/admin/students',
      color: 'bg-amber-500'
    },
    {
      title: 'View Attendance',
      description: 'Monitor daily attendance',
      icon: ClipboardList,
      href: '/admin/attendance',
      color: 'bg-orange-500'
    }
  ] : [
    {
      title: 'My Classes',
      description: 'View your assigned classes',
      icon: GraduationCap,
      href: '/teacher/classes',
      color: 'bg-green-500'
    },
    {
      title: 'Take Attendance',
      description: 'Mark student attendance',
      icon: ClipboardList,
      href: '/teacher/attendance',
      color: 'bg-green-500'
    },
    {
      title: 'Attendance History',
      description: 'View past attendance records',
      icon: Calendar,
      href: '/teacher/history',
      color: 'bg-amber-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {welcomeMessage}
        </h1>
        <p className="text-gray-600 mt-2">
          Hello, {user.name}! Here&apos;s what you can do today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{stat.title}</CardTitle>
                  <CardDescription>{stat.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-lg">{user.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-lg">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Role</p>
              <p className="text-lg capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-lg capitalize">{user.status}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
