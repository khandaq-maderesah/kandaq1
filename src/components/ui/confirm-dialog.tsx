'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * "Are you sure?" for actions that are hard or tedious to undo. The safe
 * choice is the outlined button on the start side; the action button names
 * exactly what will happen (never just "OK") and is red when destructive.
 * `onConfirm` may be async: the dialog stays open, with a spinner, until it
 * finishes, and cannot be dismissed meanwhile.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel: ReactNode
  /** Defaults to "Cancel"; name the safe choice when it helps ("Keep editing"). */
  cancelLabel?: ReactNode
  destructive?: boolean
  onConfirm: () => void | Promise<void>
  /** Extra content between the description and the buttons (e.g. a warning). */
  children?: ReactNode
}) {
  const tc = useTranslations('common.actions')
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)} autoFocus>
            {cancelLabel ?? tc('cancel')}
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={busy} onClick={confirm}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
