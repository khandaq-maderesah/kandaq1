'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, ClipboardCheck, ClipboardX, Copy, DoorClosed, DoorOpen, MessageSquare, Phone, Search, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, StatCard } from '@/components/ui/page'
import { useEthiopianDate } from '@/hooks/useEthiopianDate'
import { useTeacherCheckIns } from '@/hooks/useTeacherData'
import { UnsentSmsList } from '@/components/admin/UnsentSmsList'
import { AdminPushOptIn } from '@/components/admin/AdminPushOptIn'
import { buildPresenceRows, filterPresence, presenceSummary, type PresenceFilter } from '@/lib/teacherCheckIn'
import type { Class, User, Attendance } from '@/types'

interface Props {
  classes: Class[]
  users: User[]
  attendance: Attendance[]
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * Who is in class: every Ustaz of every active class, whether they tapped
 * "I am in class" on the chosen day, and whether the class's student
 * attendance was taken. Absent Ustazes sort first so the admin can call them.
 */
export default function UstazAttendanceMonitor({ classes, users, attendance }: Props) {
  const t = useTranslations('ustazPresence.board')
  const format = useFormatter()
  const eth = useEthiopianDate()
  const [date, setDate] = useState(todayIso)
  const [filter, setFilter] = useState<PresenceFilter>('all')
  const [query, setQuery] = useState('')

  const checkIns = useTeacherCheckIns(date)
  const loading = checkIns === undefined

  const rows = useMemo(
    () => buildPresenceRows({ classes, users, checkIns: checkIns ?? [], attendance, date }),
    [classes, users, checkIns, attendance, date]
  )
  const summary = presenceSummary(rows)
  const visible = filterPresence(rows, filter, query)
  const isToday = date === todayIso()
  const ethDate = eth.format(date)
  const time = (ms: number) => format.dateTime(new Date(ms), { timeStyle: 'short' })

  const copyNumber = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      toast.success(t('copied'))
    } catch {
      /* clipboard blocked: the number is still visible on the call link */
    }
  }

  const filters: PresenceFilter[] = ['all', 'inClass', 'notYet']
  return (
    <div className="space-y-4">
      <UnsentSmsList />
      <AdminPushOptIn />

      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Label htmlFor="presence-date">{t('date')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="presence-date"
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value || todayIso())}
                className="w-auto"
              />
              {!isToday && (
                <Button type="button" size="sm" variant="outline" onClick={() => setDate(todayIso())}>
                  {t('today')}
                </Button>
              )}
            </div>
            {ethDate && <p className="text-xs text-muted-foreground">{t('ethiopianDate', { date: ethDate })}</p>}
          </div>

        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label={t('stats.total')} value={format.number(summary.total)} icon={Users} onClick={() => setFilter('all')} />
        <StatCard label={t('stats.inClass')} value={format.number(summary.inClass)} icon={DoorOpen} tone="success" onClick={() => setFilter('inClass')} />
        <StatCard label={t('stats.notYet')} value={format.number(summary.notYet)} icon={DoorClosed} tone="destructive" onClick={() => setFilter('notYet')} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label={t('filters.label')} className="inline-flex w-fit rounded-lg border bg-muted p-1">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'min-h-9 rounded-md px-3 text-sm font-medium transition-colors',
                filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label={t('search')}
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-9"
          />
        </div>
      </div>

      {isToday && !loading && summary.total > 0 && summary.notYet === 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('allIn')}
        </p>
      )}

      {summary.total === 0 ? (
        <EmptyState icon={Users} title={t('empty')} />
      ) : visible.length === 0 ? (
        <EmptyState icon={Search} title={t('emptyFilter')} />
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const inClass = r.checkedInAt !== null
            const name = r.teacherName || t('unknownUstaz')
            return (
              <li
                key={r.key}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between',
                  !inClass && !loading && 'border-destructive/40'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      inClass ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    )}
                    aria-hidden="true"
                  >
                    {name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.className}
                      {r.section ? ` · ${r.section}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!loading && (
                    <Badge variant={inClass ? 'success' : 'destructive'}>
                      {inClass ? <DoorOpen /> : <DoorClosed />}
                      {inClass ? t('badge.inClass', { time: time(r.checkedInAt as number) }) : t('badge.notYet')}
                    </Badge>
                  )}
                  <Badge variant={r.attendanceTaken ? 'info' : 'secondary'}>
                    {r.attendanceTaken ? <ClipboardCheck /> : <ClipboardX />}
                    {r.attendanceTaken ? t('attendanceTaken') : t('attendanceMissing')}
                  </Badge>
                  {r.phone && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`tel:${r.phone}`}
                        aria-label={t('call', { name })}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-accent"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                      <a
                        href={`sms:${r.phone}`}
                        aria-label={t('sms', { name })}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary transition-colors hover:bg-accent"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyNumber(r.phone)}
                        aria-label={t('copy')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
