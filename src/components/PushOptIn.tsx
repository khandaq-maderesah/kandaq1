'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BellOff, BellRing, CheckCircle2, Info, Loader2, Send } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { disablePush, enablePush, getPushStatus, saveSubscription, showTestNotification, type PushStatus } from '@/lib/webPush'
import { Button } from '@/components/ui/button'

/**
 * The card where a user turns push notifications on for this phone (Ustaz:
 * attendance reminder; admin: who did not text the parents). Asks permission
 * only when the button is pressed, shows what is wrong when it cannot work
 * (blocked, unsupported browser, iPhone outside the Home Screen app) and lets
 * the user try a test notification or turn it off again.
 */
export function PushOptIn({
  title,
  offDescription,
  onDescription,
  test,
}: {
  title: string
  offDescription: string
  onDescription: string
  /** The sample notification shown by "Show a test". */
  test: { title: string; body: string; action: string; url: string }
}) {
  const t = useTranslations('attendanceReminder.card')
  const locale = useLocale()
  const { user } = useAuth()
  const uid = user?.uid
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    getPushStatus()
      .then(async (s) => {
        if (cancelled) return
        setStatus(s)
        // Keep this phone's saved subscription fresh (and tied to the signed-in user).
        if (s === 'on' && uid) {
          const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
          if (sub) await saveSubscription(uid, sub, locale)
        }
      })
      .catch(() => !cancelled && setStatus('unsupported'))
    return () => {
      cancelled = true
    }
  }, [uid, locale])

  const run = async (action: () => Promise<PushStatus>, successMessage?: (next: PushStatus) => string | null) => {
    setBusy(true)
    try {
      const next = await action()
      setStatus(next)
      const message = successMessage?.(next)
      if (message) toast.success(message)
    } catch {
      toast.error(t('failed'))
    } finally {
      setBusy(false)
    }
  }

  const turnOn = () =>
    uid ? run(() => enablePush(uid, locale), (next) => (next === 'on' ? t('enabled') : null)) : undefined
  const turnOff = () =>
    uid
      ? run(async () => {
          await disablePush(uid)
          return 'off'
        }, () => t('disabled'))
      : undefined
  const sendTest = () => showTestNotification(test).catch(() => toast.error(t('failed')))

  if (status === null) return null

  const note =
    status === 'denied'
      ? t('blocked')
      : status === 'unsupported'
        ? t('unsupported')
        : status === 'needs-install'
          ? t('needsInstall')
          : ''

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={
            status === 'on'
              ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success'
              : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'
          }
        >
          {status === 'on' ? <BellRing className="h-4 w-4" aria-hidden="true" /> : <BellOff className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {title}
            {status === 'on' && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
          </h2>
          {note ? (
            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {note}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">{status === 'on' ? onDescription : offDescription}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {status === 'off' && (
          <Button type="button" size="sm" onClick={turnOn} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <BellRing />} {t('enable')}
          </Button>
        )}
        {status === 'on' && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={sendTest}>
              <Send /> {t('test')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={turnOff} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <BellOff />} {t('disable')}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
