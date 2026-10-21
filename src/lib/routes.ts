import type { UserRole } from '@/types'

/** Where a user lands after sign-in (or when they open a page they can't use). */
export function homePathFor(role: UserRole | undefined, hasSchool: boolean): string {
  if (role === 'superadmin') return hasSchool ? '/admin' : '/superadmin'
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return '/login'
}

/**
 * The screen the installed app should open on for this account, remembered by
 * the service worker. A superadmin's opened school lives in sessionStorage and
 * is gone after a restart, so their start screen is always the school list.
 */
export function offlineHomeFor(role: UserRole | undefined): string | null {
  if (role === 'superadmin') return '/superadmin'
  if (role === 'admin') return '/admin'
  if (role === 'teacher') return '/teacher'
  return null
}
