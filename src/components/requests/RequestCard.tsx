'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { ArrowRight, ArrowLeftRight, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { RequestStatusBadge } from './RequestStatusBadge'
import type { ChangeRequest } from '@/types'

/** One request: what, who, why, and (if decided) the decision. */
export function RequestCard({ request, actions }: { request: ChangeRequest; actions?: React.ReactNode }) {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const format = useFormatter()
  const date = (iso?: string) => (iso ? format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' }) : '')
  const isDelete = request.type === 'student_delete'
  const TypeIcon = isDelete ? Trash2 : ArrowLeftRight

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={
              isDelete
                ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive'
                : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info'
            }
          >
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">{request.studentName}</p>
            <p className="text-sm text-muted-foreground">{t(`types.${request.type}`)}</p>
          </div>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{isDelete ? tc('fields.class') : t('admin.from')}</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 text-foreground">
            {request.className}
            {request.section ? ` · ${request.section}` : ''}
            {!isDelete && (
              <>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" aria-label={t('admin.to')} />
                <span className="font-medium">{request.toClassName}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{t('admin.requestedBy', { name: request.requestedByName })}</dt>
          <dd className="mt-0.5 text-foreground">{date(request.requestedAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">{t('admin.reason')}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-foreground">
            {request.reasonCategory && (
              <span className="mb-1 block font-medium">{t(`reasons.${request.reasonCategory}`)}</span>
            )}
            {request.reason}
          </dd>
        </div>
        {(request.status === 'approved' || request.status === 'rejected') && request.reviewedByName && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">
              {t('admin.reviewedBy', {
                status: request.status,
                name: request.reviewedByName,
                date: date(request.reviewedAt),
              })}
            </dt>
            {request.reviewNote && (
              <dd className="mt-1 whitespace-pre-wrap border-s-2 border-primary/40 ps-3 text-foreground">{request.reviewNote}</dd>
            )}
          </div>
        )}
      </dl>

      {actions && <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">{actions}</div>}
    </Card>
  )
}
