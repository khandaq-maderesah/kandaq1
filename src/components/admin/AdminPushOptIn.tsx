'use client'

import { useTranslations } from 'next-intl'
import { PushOptIn } from '@/components/PushOptIn'
import { ADMIN_SMS_PAGE } from '@/lib/attendancePush'
import { ADMIN_NOTIFY_TIME } from '@/lib/reminderConstants'

/**
 * Admin: turn on the evening push notification that lists the Ustazes who saved
 * absent students but did not text the parents (sent with the 18:30 check).
 */
export function AdminPushOptIn() {
  const t = useTranslations('attendanceReminder')
  return (
    <div className="mb-4 empty:hidden">
      <PushOptIn
        title={t('adminCard.title')}
        offDescription={t('adminCard.offDescription', { time: ADMIN_NOTIFY_TIME })}
        onDescription={t('adminCard.onDescription', { time: ADMIN_NOTIFY_TIME })}
        test={{
          title: t('adminCard.testTitle'),
          body: t('adminCard.testBody'),
          action: t('adminSms.action'),
          url: ADMIN_SMS_PAGE,
        }}
      />
    </div>
  )
}
