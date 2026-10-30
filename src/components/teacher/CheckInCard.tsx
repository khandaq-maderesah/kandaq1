'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, DoorOpen, Loader2, WifiOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { checkInId } from '@/lib/teacherCheckIn'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Class, TeacherCheckIn } from '@/types'

const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * The Ustaz's "I am in class" button: one row per class, one tap per day.
 * Once tapped the row shows the time the admin sees.
 */
export function CheckInCard({ classes, checkIns }: { classes: Class[]; checkIns: TeacherCheckIn[] }) {
  const t = useTranslations('ustazPresence.checkIn')
  const format = useFormatter()
  const { user, offline } = useAuth()
  const [busyClassId, setBusyClassId] = useState<string | null>(null)

  if (!user || classes.length === 0) return null

  const mine = new Map(checkIns.filter((c) => c.teacherId === user.uid).map((c) => [c.classId, c.checkedInAt]))
  const time = (ms: number) => format.dateTime(new Date(ms), { timeStyle: 'short' })
  const allDone = classes.every((c) => mine.has(c.id))

  const handleCheckIn = async (c: Class) => {
    const date = todayIso()
    setBusyClassId(c.id)
    try {
      await rtdb.createTeacherCheckIn(checkInId(date, c.id, user.uid), {
        date,
        classId: c.id,
        className: c.name,
        section: c.section || undefined,
        teacherId: user.uid,
        teacherName: user.name,
      })
      toast.success(t('success', { time: time(Date.now()) }))
    } catch {
      toast.error(t('failed'))
    } finally {
      setBusyClassId(null)
    }
  }

  return (
    <section
      aria-labelledby="checkin-title"
      className={cn(
        'mb-6 rounded-xl border bg-card p-4 shadow-sm sm:p-5',
        allDone ? 'border-success/40' : 'border-primary/40'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            allDone ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
          )}
        >
          {allDone ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <DoorOpen className="h-5 w-5" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h2 id="checkin-title" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{allDone ? t('allDone') : t('description')}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {classes.map((c) => {
          const at = mine.get(c.id)
          return (
            <li key={c.id} className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate font-medium text-foreground">{c.section ? `${c.name} · ${c.section}` : c.name}</p>
              {at !== undefined ? (
                <p className="inline-flex items-center gap-2 text-sm font-medium text-success" role="status">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {t('done', { time: time(at) })}
                </p>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled={offline || busyClassId !== null}
                  onClick={() => handleCheckIn(c)}
                >
                  {busyClassId === c.id ? <Loader2 className="animate-spin" /> : <DoorOpen />}
                  {busyClassId === c.id ? t('saving') : t('button')}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {offline && !allDone && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          {t('offline')}
        </p>
      )}
    </section>
  )
}
