'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, ArchiveRestore, Archive, Loader2, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { deleteStudent, restoreStudent, subscribeToStudents } from '@/lib/database'
import type { Student } from '@/types'

export default function DeletedStudentsPage() {
  const t = useTranslations('requests.deleted')
  const tr = useTranslations('requests')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { user } = useAuth()
  const students = useLiveData<Student[]>('students', (emit) => subscribeToStudents(emit)).data
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [purging, setPurging] = useState<Student | null>(null)
  const [confirmName, setConfirmName] = useState('')

  const date = (iso?: string) => (iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : '')

  const archived = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (students ?? [])
      .filter((s) => s.isActive === false)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.className ?? '').toLowerCase().includes(q))
      .sort((a, b) => (b.archive?.archivedAt ?? b.updatedAt ?? '').localeCompare(a.archive?.archivedAt ?? a.updatedAt ?? ''))
  }, [students, search])

  const restore = async (s: Student) => {
    if (!user) return
    setBusy(s.id)
    try {
      await restoreStudent(s, { uid: user.uid, name: user.name })
      toast.success(t('restored', { name: s.name, className: s.className ?? '', gender: s.gender ?? 'male' }))
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  const purge = async () => {
    if (!purging) return
    setBusy(purging.id)
    try {
      await deleteStudent(purging.id)
      toast.success(t('purged', { name: purging.name, gender: purging.gender ?? 'male' }))
      setPurging(null)
    } catch {
      toast.error(tc('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <Link href="/admin/students" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {tc('actions.back')}
      </Link>
      <PageHeader title={t('title')} description={t('description')} />

      <div className="relative mb-5 max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="ps-9" />
      </div>

      {students === undefined ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : archived.length === 0 ? (
        <EmptyState icon={Archive} title={search ? tc('empty.noResults') : t('empty')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {archived.map((s) => (
            <Card key={s.id} className="flex flex-col p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.className}
                    {s.section ? ` · ${s.section}` : ''}
                    {s.rollNumber ? ` · #${s.rollNumber}` : ''}
                  </p>
                </div>
              </div>

              {s.archive ? (
                <dl className="mt-4 grid gap-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t('reason')}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-foreground">
                      <span className="mb-1 block font-medium">{tr(`reasons.${s.archive.reasonCategory}`)}</span>
                      {s.archive.reason}
                    </dd>
                  </div>
                  <dd className="text-xs text-muted-foreground">
                    {t('requestedBy', { name: s.archive.requestedByName, date: date(s.archive.requestedAt) })}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {t('approvedBy', { name: s.archive.archivedByName, date: date(s.archive.archivedAt) })}
                  </dd>
                </dl>
              ) : null}

              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setConfirmName(''); setPurging(s) }}>
                  <Trash2 /> {t('purge')}
                </Button>
                <Button variant="outline" onClick={() => restore(s)} disabled={busy === s.id}>
                  {busy === s.id ? <Loader2 className="animate-spin" /> : <ArchiveRestore />}
                  {t('restore')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!purging} onOpenChange={(o) => !o && setPurging(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('purgeTitle', { name: purging?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('purgeDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="purge-confirm">{t('purgeConfirmLabel')}</Label>
            <Input id="purge-confirm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurging(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={purge}
              disabled={!purging || confirmName.trim() !== purging.name.trim() || busy === purging?.id}
            >
              {busy === purging?.id && <Loader2 className="animate-spin" />}
              {t('purge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
