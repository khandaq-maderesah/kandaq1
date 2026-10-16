'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ClipboardList, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { RequestCard } from '@/components/requests/RequestCard'
import { useAuth } from '@/context/AuthContext'
import { markRequestUpdatesSeen, useMyRequests } from '@/hooks/useRequestBadges'
import { cancelChangeRequest } from '@/lib/database'

export default function TeacherRequestsPage() {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const requests = useMyRequests(user?.uid)
  const [busy, setBusy] = useState<string | null>(null)

  // Opening this page counts as having seen the latest decisions.
  useEffect(() => {
    if (user && requests) markRequestUpdatesSeen(user.uid)
  }, [user, requests])

  const sorted = useMemo(
    () =>
      [...(requests ?? [])].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (b.status === 'pending' && a.status !== 'pending') return 1
        return (b.reviewedAt ?? b.requestedAt).localeCompare(a.reviewedAt ?? a.requestedAt)
      }),
    [requests]
  )

  const withdraw = async (id: string) => {
    setBusy(id)
    try {
      await cancelChangeRequest(id)
      toast.success(t('teacher.cancelled'))
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader title={t('teacher.title')} description={t('teacher.description')} />
      {requests === undefined ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('teacher.empty')} description={t('teacher.emptyHint')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sorted.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              actions={
                r.status === 'pending' ? (
                  <Button variant="outline" onClick={() => withdraw(r.id)} disabled={busy === r.id}>
                    <Undo2 /> {t('teacher.cancelRequest')}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
