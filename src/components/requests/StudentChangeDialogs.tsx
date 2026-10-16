'use client'

import { useEffect, useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { archiveStudent, createChangeRequest } from '@/lib/database'
import { DELETION_REASONS, type Class, type DeletionReason, type Student } from '@/types'

/** Minimum length of the written explanation for any delete/move request. */
export const MIN_REASON_LENGTH = 10

type StudentLike = Pick<Student, 'id' | 'name' | 'classId' | 'className' | 'section' | 'gender'>

function ReasonFields({
  category,
  onCategory,
  details,
  onDetails,
  showCategory,
  showError,
}: {
  category: DeletionReason | ''
  onCategory: (v: DeletionReason | '') => void
  details: string
  onDetails: (v: string) => void
  showCategory: boolean
  showError: boolean
}) {
  const t = useTranslations('requests')
  const id = useId()
  const tooShort = details.trim().length < MIN_REASON_LENGTH
  return (
    <>
      {showCategory && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-cat`}>{t('dialog.reasonCategory')}</Label>
          <Select
            id={`${id}-cat`}
            required
            value={category}
            onChange={(e) => onCategory(e.target.value as DeletionReason | '')}
          >
            <option value="" disabled>
              {t('dialog.reasonCategoryPlaceholder')}
            </option>
            {DELETION_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`reasons.${r}`)}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${id}-details`}>{t('dialog.details')}</Label>
        <Textarea
          id={`${id}-details`}
          required
          maxLength={1000}
          value={details}
          onChange={(e) => onDetails(e.target.value)}
          placeholder={t('dialog.detailsPlaceholder')}
          aria-invalid={showError && tooShort}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className={showError && tooShort ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {showError && tooShort ? t('dialog.detailsTooShort', { min: MIN_REASON_LENGTH }) : t('dialog.detailsHint')}
        </p>
      </div>
    </>
  )
}

/**
 * Teacher asks to delete a student. Nothing changes until a school admin
 * approves; the request carries a reason category + written explanation.
 */
export function RequestDeleteDialog({
  student,
  open,
  onOpenChange,
}: {
  student: StudentLike | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const [category, setCategory] = useState<DeletionReason | ''>('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory('')
      setDetails('')
      setSubmitted(false)
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!student || !user || !category || details.trim().length < MIN_REASON_LENGTH) return
    setSaving(true)
    try {
      await createChangeRequest({
        type: 'student_delete',
        studentId: student.id,
        studentName: student.name,
        studentGender: student.gender,
        classId: student.classId,
        className: student.className ?? '',
        section: student.section,
        reasonCategory: category,
        reason: details.trim(),
        requestedBy: user.uid,
        requestedByName: user.name,
      })
      toast.success(t('dialog.sent'))
      onOpenChange(false)
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('dialog.deleteTitle', { name: student?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('dialog.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <ReasonFields
            category={category}
            onCategory={setCategory}
            details={details}
            onDetails={setDetails}
            showCategory
            showError={submitted}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t('dialog.submitRequest')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Teacher asks to move a student to another class (admin approval needed). */
export function RequestTransferDialog({
  student,
  classes,
  open,
  onOpenChange,
}: {
  student: StudentLike | null
  /** All active classes of the school. */
  classes: Pick<Class, 'id' | 'name' | 'section' | 'isActive'>[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const id = useId()
  const [target, setTarget] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTarget('')
      setDetails('')
      setSubmitted(false)
    }
  }, [open])

  const options = classes.filter((c) => c.id !== student?.classId && c.isActive !== false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const to = options.find((c) => c.id === target)
    if (!student || !user || !to || details.trim().length < MIN_REASON_LENGTH) return
    setSaving(true)
    try {
      await createChangeRequest({
        type: 'student_transfer',
        studentId: student.id,
        studentName: student.name,
        studentGender: student.gender,
        classId: student.classId,
        className: student.className ?? '',
        section: student.section,
        toClassId: to.id,
        toClassName: to.name,
        reason: details.trim(),
        requestedBy: user.uid,
        requestedByName: user.name,
      })
      toast.success(t('dialog.sent'))
      onOpenChange(false)
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('dialog.transferTitle', { name: student?.name ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('dialog.transferDescription', { className: student?.className ?? '' })}
            </DialogDescription>
          </DialogHeader>
          {options.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('dialog.noOtherClasses')}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${id}-class`}>{t('dialog.targetClass')}</Label>
                <Select id={`${id}-class`} required value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="" disabled>
                    {t('dialog.targetClassPlaceholder')}
                  </option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.section ? `${c.name} · ${c.section}` : c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <ReasonFields
                category=""
                onCategory={() => {}}
                details={details}
                onDetails={setDetails}
                showCategory={false}
                showError={submitted}
              />
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving || options.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              {t('dialog.submitRequest')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** School admin deletes a student directly: archived at once, with a reason. */
export function AdminArchiveDialog({
  student,
  open,
  onOpenChange,
  onDone,
}: {
  student: Pick<Student, 'id' | 'name' | 'gender'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
}) {
  const t = useTranslations('requests')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const [category, setCategory] = useState<DeletionReason | ''>('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory('')
      setDetails('')
      setSubmitted(false)
    }
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!student || !user || !category || details.trim().length < MIN_REASON_LENGTH) return
    setSaving(true)
    try {
      await archiveStudent(student, category, details.trim(), { uid: user.uid, name: user.name })
      toast.success(t('dialog.deleted', { name: student.name, gender: student.gender ?? 'male' }))
      onOpenChange(false)
      onDone?.()
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('dialog.adminDeleteTitle', { name: student?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('dialog.adminDeleteDescription')}</DialogDescription>
          </DialogHeader>
          <ReasonFields
            category={category}
            onCategory={setCategory}
            details={details}
            onDetails={setDetails}
            showCategory
            showError={submitted}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t('dialog.confirmDelete')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
