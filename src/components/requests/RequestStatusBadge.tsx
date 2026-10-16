'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle2, Clock, Undo2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RequestStatus } from '@/types'

const config = {
  pending: { variant: 'warning', icon: Clock },
  approved: { variant: 'success', icon: CheckCircle2 },
  rejected: { variant: 'destructive', icon: XCircle },
  cancelled: { variant: 'secondary', icon: Undo2 },
} as const

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations('common.status')
  const { variant, icon: Icon } = config[status]
  return (
    <Badge variant={variant}>
      <Icon />
      {t(status)}
    </Badge>
  )
}
