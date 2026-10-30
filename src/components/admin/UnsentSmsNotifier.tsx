'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useUnsentAbsenceSms } from '@/hooks/useUnsentAbsenceSms'
import { showBrowserNotification } from '@/lib/pushNotification'

/**
 * Admin: a device notification (when the admin enabled alerts) the moment an
 * Ustaz newly becomes someone who did not text the parents. Renders nothing.
 */
export function UnsentSmsNotifier() {
  const t = useTranslations('absenceSms.admin')
  const { rows, ready } = useUnsentAbsenceSms(true)
  // What was already unsent when the app opened is shown by the banner and badge, not announced again.
  const known = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!ready) return
    if (known.current === null) {
      known.current = new Set(rows.map((r) => r.key))
      return
    }
    const fresh = rows.filter((r) => !known.current?.has(r.key))
    fresh.forEach((r) => known.current?.add(r.key))
    if (fresh.length === 0) return
    void showBrowserNotification({
      title: t('notifyTitle'),
      body: t('notifyBody', { count: fresh.length }),
      url: '/admin/attendance#ustaz',
      tag: `absence-sms:${fresh[0].key}`,
    })
  }, [ready, rows, t])

  return null
}
