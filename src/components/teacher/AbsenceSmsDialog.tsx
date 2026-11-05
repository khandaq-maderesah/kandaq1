'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { CheckCircle2, MessageSquare, Phone, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { absenceSmsId } from '@/lib/absenceSms'
import {
  generateGroupSmsMessage,
  generateLateGroupSmsMessage,
  generateLateSmsMessage,
  generateSmsMessage,
} from '@/lib/smsMessage'
import { detectSmsPlatform, dominantLanguage, groupSmsHref, smsHref } from '@/lib/smsLink'
import { readLateSmsPreference, writeLateSmsPreference } from '@/lib/lateSmsPreference'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Student } from '@/types'

type Recipient = Pick<Student, 'id' | 'name' | 'gender' | 'parentPhone' | 'parentLanguage'>
type Kind = 'absent' | 'late'

const hasPhone = (s: Recipient) => (s.parentPhone ?? '').trim() !== ''

/**
 * Shown right after an Ustaz saves attendance: asks them to text the parents of
 * the absent students (owed: the admin is told when it is skipped) and, if they
 * choose, of the late students too (optional, a different message, never
 * tracked). Opening the SMS app (group text or one parent) is what counts as
 * "sent"; for absent students it is recorded so the admin can see who did not text.
 */
export function AbsenceSmsDialog({
  open,
  onOpenChange,
  classId,
  className,
  date,
  absent,
  late = [],
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
  className: string
  date: string
  /** The students marked absent. */
  absent: Recipient[]
  /** The students marked late (optional to text). */
  late?: Recipient[]
}) {
  const t = useTranslations('absenceSms.dialog')
  const { user, school } = useAuth()
  const [opened, setOpened] = useState<Set<string>>(new Set())
  // Remembered on this device; with nobody absent the dialog is only about late students.
  const [includeLate, setIncludeLate] = useState(false)

  const reachableAbsent = useMemo(() => absent.filter(hasPhone), [absent])
  const reachableLate = useMemo(() => late.filter(hasPhone), [late])
  const absentDone = reachableAbsent.length > 0 && reachableAbsent.every((s) => opened.has(s.id))
  const lateDone = reachableLate.length > 0 && reachableLate.every((s) => opened.has(s.id))
  const showLate = late.length > 0 && (absent.length === 0 || includeLate)

  useEffect(() => {
    if (!open) return
    setOpened(new Set())
    setIncludeLate(readLateSmsPreference())
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
    if (open && absent.length > 0 && reachableAbsent.length === 0) record()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const markOpened = (ids: string[], kind: Kind) => {
    const next = new Set(opened)
    ids.forEach((id) => next.add(id))
    setOpened(next)
    // Only the absence texts are owed to the admin; texting late parents is a favour.
    if (kind === 'absent' && reachableAbsent.every((s) => next.has(s.id))) record()
  }

  const toggleLate = () => {
    const next = !includeLate
    setIncludeLate(next)
    writeLateSmsPreference(next)
  }

  const platform = detectSmsPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent)
  const groupHref = (kind: Kind) => {
    const list = kind === 'absent' ? reachableAbsent : reachableLate
    const language = dominantLanguage(list.map((s) => s.parentLanguage))
    const body = kind === 'absent' ? generateGroupSmsMessage(language, school) : generateLateGroupSmsMessage(language, school)
    return groupSmsHref(list.map((s) => s.parentPhone ?? ''), body, platform)
  }
  const personHref = (s: Recipient, kind: Kind) =>
    smsHref(
      (s.parentPhone ?? '').trim(),
      (kind === 'absent' ? generateSmsMessage : generateLateSmsMessage)(s.name, s.gender, s.parentLanguage, school)
    )

  /** One group's recipients: the "text everyone" button and a row per student. */
  const renderGroup = (kind: Kind) => {
    const students = kind === 'absent' ? absent : late
    const reachable = kind === 'absent' ? reachableAbsent : reachableLate
    const done = kind === 'absent' ? absentDone : lateDone
    const href = groupHref(kind)
    const both = absent.length > 0 && showLate

    return (
      <section aria-label={both ? t(kind === 'absent' ? 'absentHeading' : 'lateHeading', { count: students.length }) : undefined} className="space-y-3">
        {both && (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(kind === 'absent' ? 'absentHeading' : 'lateHeading', { count: students.length })}
          </h3>
        )}

        {reachable.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            {t(kind === 'absent' ? 'nobodyReachable' : 'lateNobodyReachable')}
          </p>
        ) : (
          <>
            {href && (
              <div>
                <a
                  href={href}
                  onClick={() => markOpened(reachable.map((s) => s.id), kind)}
                  className={cn(buttonVariants({ size: 'lg', variant: done ? 'outline' : kind === 'absent' ? 'success' : 'default' }), 'w-full')}
                >
                  {done ? <CheckCircle2 /> : <MessageSquare />}
                  {t(kind === 'absent' ? 'sendAll' : 'sendAllLate', { count: reachable.length })}
                </a>
                <p className="mt-1.5 text-center text-xs text-muted-foreground">
                  {t(kind === 'absent' ? 'sendAllHint' : 'sendAllLateHint')}
                </p>
              </div>
            )}

            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
              {students.map((s) => {
                const phone = (s.parentPhone ?? '').trim()
                const sent = opened.has(s.id)
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
                        href={personHref(s, kind)}
                        onClick={() => markOpened([s.id], kind)}
                        className={buttonVariants({ size: 'sm', variant: sent ? 'ghost' : 'outline' })}
                      >
                        {sent ? <CheckCircle2 className="text-success" /> : <MessageSquare />}
                        {sent ? t('opened') : t('sendOne')}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    )
  }

  const nothingOwed = absent.length === 0 || absentDone || reachableAbsent.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {absent.length > 0
              ? t('description', { count: absent.length, className })
              : t('descriptionLateOnly', { count: late.length, className })}
          </DialogDescription>
        </DialogHeader>

        {absent.length > 0 && renderGroup('absent')}

        {absentDone && (
          <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('allDone')}
          </p>
        )}
        {!nothingOwed && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" /> {t('leaveWarning')}
          </p>
        )}

        {/* Late students: optional, so the Ustaz decides (and the choice is remembered). */}
        {late.length > 0 && absent.length > 0 && (
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-3">
            <div className="min-w-0">
              <p id="late-sms-label" className="text-sm font-medium text-foreground">
                {t('lateToggle')}
              </p>
              <p id="late-sms-hint" className="mt-0.5 text-xs text-muted-foreground">
                {t('lateToggleHint', { count: late.length })}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeLate}
              aria-labelledby="late-sms-label"
              aria-describedby="late-sms-hint"
              onClick={toggleLate}
              className={cn(
                'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                includeLate ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform',
                  includeLate ? 'translate-x-[1.375rem] rtl:-translate-x-[1.375rem]' : 'translate-x-0.5 rtl:-translate-x-0.5'
                )}
              />
            </button>
          </div>
        )}

        {showLate && renderGroup('late')}
        {showLate && lateDone && (
          <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t('lateDone')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant={nothingOwed ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
            {nothingOwed ? t('close') : t('later')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
