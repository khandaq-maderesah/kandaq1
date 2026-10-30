'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, MessageSquare, Phone, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { absenceSmsId } from '@/lib/absenceSms'
import { generateGroupSmsMessage, generateSmsMessage } from '@/lib/smsMessage'
import { detectSmsPlatform, dominantLanguage, groupSmsHref, smsHref } from '@/lib/smsLink'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Student } from '@/types'

/**
 * Shown right after an Ustaz saves attendance with absent students: asks them
 * to text the parents. Opening the SMS app (group text or one parent) is what
 * counts as "sent"; it is recorded so the admin can see who did not text.
 */
export function AbsenceSmsDialog({
  open,
  onOpenChange,
  classId,
  className,
  date,
  absent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  className: string
  date: string
  /** The students marked absent. */
  absent: Pick<Student, 'id' | 'name' | 'gender' | 'parentPhone' | 'parentLanguage'>[]
}) {
  const t = useTranslations('absenceSms.dialog')
  const { user, school } = useAuth()
  const [opened, setOpened] = useState<Set<string>>(new Set())

  const reachable = useMemo(() => absent.filter((s) => (s.parentPhone ?? '').trim() !== ''), [absent])
  const allOpened = reachable.length > 0 && reachable.every((s) => opened.has(s.id))

  useEffect(() => {
    if (open) setOpened(new Set())
  }, [open])

  const record = () => {
    if (!user) return
    // Not awaited: with no connection the write waits for the network, and the Ustaz can still text.
    rtdb
      .setAbsenceSms(absenceSmsId(date, classId), {
        date,
        classId,
        teacherId: user.uid,
        teacherName: user.name,
        absentCount: absent.length,
      })
      .catch(() => toast.error(t('recordFailed')))
  }

  // Nobody has a number to text: nothing is owed, so the admin is not asked about it.
  useEffect(() => {
    if (open && absent.length > 0 && reachable.length === 0) record()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markOpened = (ids: string[]) => {
    const next = new Set(opened)
    ids.forEach((id) => next.add(id))
    setOpened(next)
    if (reachable.every((s) => next.has(s.id))) record()
  }

  const platform = detectSmsPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent)
  const groupHref = groupSmsHref(
    reachable.map((s) => s.parentPhone ?? ''),
    generateGroupSmsMessage(dominantLanguage(reachable.map((s) => s.parentLanguage)), school),
    platform
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description', { count: absent.length, className })}</DialogDescription>
        </DialogHeader>

        {reachable.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('nobodyReachable')}</p>
        ) : (
          <>
            {groupHref && (
              <div>
                <a
                  href={groupHref}
                  onClick={() => markOpened(reachable.map((s) => s.id))}
                  className={cn(buttonVariants({ size: 'lg', variant: allOpened ? 'outline' : 'success' }), 'w-full')}
                >
                  {allOpened ? <CheckCircle2 /> : <MessageSquare />}
                  {t('sendAll', { count: reachable.length })}
                </a>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">{t('sendAllHint')}</p>
              </div>
            )}

            <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border">
              {absent.map((s) => {
                const phone = (s.parentPhone ?? '').trim()
                const done = opened.has(s.id)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                      {phone ? (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <Phone className="h-3 w-3" aria-hidden="true" /> {phone}
                        </p>
                      ) : (
                        <p className="text-xs text-warning">{t('noPhone')}</p>
                      )}
                    </div>
                    {phone && (
                      <a
                        href={smsHref(phone, generateSmsMessage(s.name, s.gender, s.parentLanguage, school))}
                        onClick={() => markOpened([s.id])}
                        className={buttonVariants({ size: 'sm', variant: done ? 'ghost' : 'outline' })}
                      >
                        {done ? <CheckCircle2 className="text-success" /> : <MessageSquare />}
                        {done ? t('opened') : t('sendOne')}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {allOpened ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('allDone')}
          </p>
        ) : (
          reachable.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> {t('leaveWarning')}
            </p>
          )
        )}

        <DialogFooter>
          <Button type="button" variant={allOpened || reachable.length === 0 ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
            {allOpened || reachable.length === 0 ? t('close') : t('later')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
