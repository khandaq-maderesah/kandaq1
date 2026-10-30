'use client'

import { useAuth } from '@/context/AuthContext'
import { AbsenceAlertBell } from '@/components/AbsenceAlertBell'
import { AttendanceReminderBell } from '@/components/AttendanceReminderBell'
import { AnnouncementBell } from '@/components/AnnouncementBell'
import { UnsentSmsNotifier } from '@/components/admin/UnsentSmsNotifier'
import { AppShell } from './AppShell'
import { adminNav, superadminNav, teacherNav, type NavSection } from './nav'

/** AppShell with the navigation and notification bells for the user's role. */
export function RoleShell({ children }: { children: React.ReactNode }) {
  const { user, school, isAdmin, isTeacher } = useAuth()

  let sections: NavSection[] = superadminNav
  let actions: React.ReactNode = null

  if (isAdmin) {
    // A superadmin inside a medreseh keeps the platform menu on top; the
    // medreseh's own pages follow under their own heading.
    sections =
      user?.role === 'superadmin'
        ? [
            { title: 'platform', items: superadminNav.flatMap((s) => s.items) },
            ...adminNav.map((s, i) => (i === 0 ? { ...s, title: 'currentSchool' as const } : s)),
          ]
        : adminNav
    actions = (
      <>
        <UnsentSmsNotifier />
        <AttendanceReminderBell dark={false} />
        <AbsenceAlertBell dark={false} />
        <AnnouncementBell dark={false} />
      </>
    )
  } else if (isTeacher) {
    sections = teacherNav
    actions = (
      <>
        <AttendanceReminderBell dark={false} />
        <AbsenceAlertBell teacherOnly dark={false} />
        <AnnouncementBell dark={false} />
      </>
    )
  }

  return (
    // Keyed by school: a superadmin switching schools remounts every page and
    // live subscription, so nothing from the previous school lingers.
    <AppShell key={school?.id ?? 'none'} sections={sections} actions={actions}>
      {children}
    </AppShell>
  )
}
