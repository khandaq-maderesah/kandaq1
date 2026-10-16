import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School as SchoolIcon,
  ClipboardCheck,
  ClipboardList,
  FileText,
  BarChart3,
  Settings,
  Inbox,
  History,
  Building2,
  type LucideIcon,
} from 'lucide-react'

/** Keys of the `nav` translation namespace used as labels. */
export type NavLabel =
  | 'dashboard'
  | 'allSchools'
  | 'users'
  | 'classes'
  | 'students'
  | 'attendance'
  | 'takeAttendance'
  | 'history'
  | 'results'
  | 'exams'
  | 'reports'
  | 'requests'
  | 'myRequests'
  | 'settings'

export interface NavItem {
  href: string
  label: NavLabel
  icon: LucideIcon
  /** Which badge counter (if any) to show next to this item. */
  badge?: 'pendingRequests' | 'requestUpdates'
  /** Match only the exact path (for section roots like /admin). */
  exact?: boolean
}

export interface NavSection {
  title?: 'overview' | 'people' | 'academics' | 'administration'
  items: NavItem[]
}

export const adminNav: NavSection[] = [
  {
    items: [{ href: '/admin', label: 'dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'people',
    items: [
      { href: '/admin/students', label: 'students', icon: GraduationCap },
      { href: '/admin/teachers', label: 'users', icon: Users },
      { href: '/admin/requests', label: 'requests', icon: Inbox, badge: 'pendingRequests' },
    ],
  },
  {
    title: 'academics',
    items: [
      { href: '/admin/classes', label: 'classes', icon: SchoolIcon },
      { href: '/admin/attendance', label: 'attendance', icon: ClipboardCheck },
      { href: '/admin/exams', label: 'results', icon: FileText },
      { href: '/admin/reports', label: 'reports', icon: BarChart3 },
    ],
  },
  {
    title: 'administration',
    items: [{ href: '/admin/settings', label: 'settings', icon: Settings }],
  },
]

/** Extra entry shown to a platform admin who opened a school. */
export const superadminBackItem: NavItem = { href: '/superadmin', label: 'allSchools', icon: Building2, exact: true }

export const teacherNav: NavSection[] = [
  {
    items: [{ href: '/teacher', label: 'dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'academics',
    items: [
      { href: '/teacher/attendance', label: 'takeAttendance', icon: ClipboardCheck },
      { href: '/teacher/classes', label: 'classes', icon: SchoolIcon },
      { href: '/teacher/students', label: 'students', icon: GraduationCap },
      { href: '/teacher/exams', label: 'exams', icon: FileText },
      { href: '/teacher/history', label: 'history', icon: History },
      { href: '/teacher/requests', label: 'myRequests', icon: ClipboardList, badge: 'requestUpdates' },
    ],
  },
]

export const superadminNav: NavSection[] = [
  {
    items: [{ href: '/superadmin', label: 'allSchools', icon: Building2, exact: true }],
  },
]
