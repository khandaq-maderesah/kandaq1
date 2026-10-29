'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { apiErrorKey } from '@/lib/apiErrors'
import type { User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Changes the sign-in email of a user (an admin for an Ustaz, the super admin
 * for an admin). The server checks who may change whose email.
 */
export function ChangeEmailDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved?: () => void
}) {
  const t = useTranslations('common.changeEmail')
  const tc = useTranslations('common')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEmail(user?.email ?? '')
  }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(t('failed'), { description: tc(`errors.api.${apiErrorKey(data)}`) })
        return
      }
      toast.success(t('saved', { name: user.name }))
      onSaved?.()
      onClose()
    } catch {
      toast.error(t('failed'), { description: tc('errors.network') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description', { name: user?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="change-email">{t('label')}</Label>
            <Input
              id="change-email"
              type="email"
              dir="ltr"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{t('hint')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !email.trim() || email.trim().toLowerCase() === (user?.email ?? '').toLowerCase()}>
              {saving && <Loader2 className="animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
