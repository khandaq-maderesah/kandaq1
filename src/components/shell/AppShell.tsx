'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LogOut, Menu, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { useLogout } from '@/hooks/useAuth'
import { useRequestBadges } from '@/hooks/useRequestBadges'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from './LanguageSwitcher'
import type { NavItem, NavSection } from './nav'

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
}

function initials(name: string | undefined) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
}

function Brand({ subtitle }: { subtitle?: string }) {
  const t = useTranslations('common')
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image src="/image/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold text-foreground">{t('appName')}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle ?? t('appTagline')}</p>
      </div>
    </div>
  )
}

function NavLinks({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const badges = useRequestBadges()

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              {t(`sections.${section.title}`)}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item)
            const count = item.badge ? badges[item.badge] : 0
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
                <span className="flex-1 truncate">{t(item.label)}</span>
                {count > 0 && (
                  <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-xs font-semibold leading-5 text-destructive-foreground">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function UserMenu() {
  const t = useTranslations()
  const { user } = useAuth()
  const logout = useLogout()

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  if (!user) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 pe-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground">
            {initials(user.name)}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium md:inline">{user.name}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(`common.roles.${user.role}`)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound /> {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive [&_svg]:text-destructive">
          <LogOut /> {t('nav.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The application frame for signed-in screens: sidebar navigation (drawer on
 * mobile), top bar with school name, notifications, language and user menu.
 */
export function AppShell({
  sections,
  actions,
  children,
}: {
  sections: NavSection[]
  /** Extra top-bar controls, e.g. notification bells. */
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const t = useTranslations('nav')
  const { school } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Brand subtitle={school?.name} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavLinks sections={sections} />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t('openMenu')}</DialogTitle>
          <div className="flex h-16 items-center border-b px-5">
            <Brand subtitle={school?.name} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <NavLinks sections={sections} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Dialog>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t('openMenu')}>
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            {school && <p className="truncate text-sm font-semibold text-foreground sm:text-base">{school.name}</p>}
          </div>
          <div className="flex items-center gap-1">
            {actions}
            <LanguageSwitcher />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
