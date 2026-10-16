'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Check, Inbox, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader } from '@/components/ui/page'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RequestCard } from '@/components/requests/RequestCard'
import { useAuth } from '@/context/AuthContext'
import { useSchoolRequests } from '@/hooks/useRequestBadges'
import { approveChangeRequest, rejectChangeRequest } from '@/lib/database'
import { cn } from '@/lib/utils'
import type { ChangeRequest } from '@/types'

type Decision = { request: ChangeRequest; action: 'approve' | 'reject' } | null

const ERROR_KEYS: Record<string, 'errorStudentMissing' | 'errorAlreadyArchived' | 'errorClassMissing'> = {
  STUDENT_NOT_FOUND: 'errorStudentMissing',
  STUDENT_ALREADY_ARCHIVED: 'errorAlreadyArchived',
  CLASS_NOT_FOUND: 'errorClassMissing',
}

export default function AdminRequestsPage() {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const requests = useSchoolRequests(true)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [decision, setDecision] = useState<Decision>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const { pending, history } = useMemo(() => {
    const all = [...(requests ?? [])]
    return {
      // Oldest first: handle requests in the order they arrived.
      pending: all.filter((r) => r.status === 'pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
      history: all
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => (b.reviewedAt ?? b.requestedAt).localeCompare(a.reviewedAt ?? a.requestedAt)),
    }
  }, [requests])

  const open = (request: ChangeRequest, action: 'approve' | 'reject') => {
    setNote('')
    setDecision({ request, action })
  }

  const decide = async () => {
    if (!decision || !user) return
    setSaving(true)
    const reviewer = { uid: user.uid, name: user.name }
    try {
      if (decision.action === 'approve') {
        await approveChangeRequest(decision.request, reviewer, note.trim() || undefined)
        toast.success(t('admin.approved'))
      } else {
        await rejectChangeRequest(decision.request, reviewer, note.trim() || undefined)
        toast.success(t('admin.rejected'))
      }
      setDecision(null)
    } catch (err) {
      const key = err instanceof Error ? ERROR_KEYS[err.message] : undefined
      toast.error(key ? t(`admin.${key}`) : tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const list = tab === 'pending' ? pending : history
  const req = decision?.request

  return (
    <div>
      <PageHeader title={t('admin.title')} description={t('admin.description')} />

      <div role="tablist" className="mb-5 inline-flex rounded-lg border bg-card p-1">
        {(['pending', 'history'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {key === 'pending' ? t('admin.tabPending') : t('admin.tabHistory')}
            {key === 'pending' && pending.length > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs leading-5',
                  tab === key ? 'bg-primary-foreground/20' : 'bg-warning/15 text-warning'
                )}
              >
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {requests === undefined ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === 'pending' ? t('admin.emptyPending') : t('admin.emptyHistory')}
          description={tab === 'pending' ? t('admin.emptyPendingHint') : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              actions={
                r.status === 'pending' ? (
                  <>
                    <Button variant="outline" onClick={() => open(r, 'reject')}>
                      <X /> {tc('actions.reject')}
                    </Button>
                    <Button variant={r.type === 'student_delete' ? 'destructive' : 'default'} onClick={() => open(r, 'approve')}>
                      <Check /> {tc('actions.approve')}
                    </Button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.action === 'approve' ? t('admin.approveTitle') : t('admin.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {decision?.action === 'reject'
                ? t('admin.rejectEffect')
                : req?.type === 'student_delete'
                  ? t('admin.approveDeleteEffect', { name: req.studentName, gender: req.studentGender ?? 'male' })
                  : t('admin.approveTransferEffect', {
                      name: req?.studentName ?? '',
                      gender: req?.studentGender ?? 'male',
                      from: req?.className ?? '',
                      to: req?.toClassName ?? '',
                    })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-note">{t('admin.noteOptional')}</Label>
            <Textarea id="review-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant={decision?.action === 'reject' ? 'default' : req?.type === 'student_delete' ? 'destructive' : 'default'}
              onClick={decide}
              disabled={saving}
            >
              {saving && <Loader2 className="animate-spin" />}
              {decision?.action === 'approve' ? tc('actions.approve') : tc('actions.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
