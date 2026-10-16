'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, EmptyState, TableContainer } from '@/components/ui/page'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { FileText, Plus, Trash2, ClipboardList, Award, CheckCircle2, PencilLine, Loader2 } from 'lucide-react'
import type { Class, Exam } from '@/types'
import { useLiveData } from '@/lib/dataStore'
import { examTypeKey } from '@/lib/examMath'
import { useExamFormat } from '@/components/ExamResultsSheet'

function classAveragePercent(exam: Exam): number {
  const rows = Object.values(exam.rows || {})
  if (!rows.length) return 0
  return rows.reduce((s, r) => s + (r.percentage || 0), 0) / rows.length
}

export default function TeacherExamsPage() {
  const t = useTranslations('teacherExams.list')
  const tx = useTranslations('exams')
  const tc = useTranslations('common')
  const format = useFormatter()
  const f = useExamFormat()
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [toDelete, setToDelete] = useState<Exam | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    // Classes come from the shared store (already open via the navbar), and
    // only the exams channel is unique to this page.
    const unsub = rtdb.subscribeToExams((l) => {
      setExams(l)
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  const storeClasses = useLiveData<Class[]>(
    user ? 'classes' : null,
    (emit) => rtdb.subscribeToClasses(emit)
  )
  useEffect(() => {
    if (!user || !storeClasses.data) return
    setClasses(storeClasses.data.filter((c) => c.teacherId === user.uid && c.isActive !== false))
  }, [storeClasses.data, user])

  const myClassIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes])
  const myExams = useMemo(
    () =>
      exams
        .filter((e) => e.teacherId === user?.uid || myClassIds.has(e.classId))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [exams, myClassIds, user]
  )
  const savedCount = myExams.filter((e) => e.status === 'saved').length

  const handleDelete = async () => {
    const exam = toDelete
    if (!exam) return
    setDeleting(true)
    try {
      await rtdb.deleteExam(exam.id)
      await rtdb.logAction({
        actorId: user?.uid,
        actorName: user?.name,
        action: 'delete',
        entity: 'exam',
        entityId: exam.id,
        details: exam.title,
      })
      toast.success(t('deleted'))
      setToDelete(null)
    } catch (err) {
      console.error(err)
      toast.error(t('deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  const dateOf = (exam: Exam) =>
    format.dateTime(new Date(exam.updatedAt || exam.createdAt), { dateStyle: 'medium' })

  const statusBadge = (exam: Exam) =>
    exam.status === 'saved' ? (
      <Badge variant="success">
        <CheckCircle2 /> {t('status.saved')}
      </Badge>
    ) : (
      <Badge variant="warning">
        <PencilLine /> {t('status.draft')}
      </Badge>
    )

  const actions = (exam: Exam) => (
    <div className="flex items-center gap-1">
      <Link
        href={`/teacher/exams/${exam.id}`}
        className={buttonVariants({ variant: 'outline', size: 'sm', className: 'h-10 sm:h-9' })}
      >
        <ClipboardList /> {exam.status === 'saved' ? t('view') : t('fillMarks')}
      </Link>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setToDelete(exam)}
        aria-label={t('deleteLabel', { title: exam.title })}
        title={tc('actions.delete')}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Link href="/teacher/exams/overall" className={buttonVariants({ variant: 'outline' })}>
              <Award /> {t('overall')}
            </Link>
            <Link href="/teacher/exams/create" className={buttonVariants()}>
              <Plus /> {t('newExam')}
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : myExams.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={
            <Link href="/teacher/exams/create" className={buttonVariants()}>
              <Plus /> {t('newExam')}
            </Link>
          }
        />
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <FileText className="h-5 w-5 text-muted-foreground" /> {t('cardTitle')}
              <Badge variant="secondary">{f.int(myExams.length)}</Badge>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('summary', { count: savedCount })}</p>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {myExams.map((exam) => (
              <li key={exam.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{exam.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {tx(examTypeKey(exam.type))} · {exam.className}
                      {exam.section ? ` • ${exam.section}` : ''}
                    </p>
                  </div>
                  {statusBadge(exam)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{t('subjectCount', { count: exam.subjects.length })}</span>
                  {exam.status === 'saved' && (
                    <span>{t('classAverageValue', { value: f.pct(classAveragePercent(exam)) })}</span>
                  )}
                  <span>{dateOf(exam)}</span>
                </div>
                <div className="mt-3 flex justify-end">{actions(exam)}</div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>{t('col.title')}</th>
                <th>{t('col.type')}</th>
                <th>{t('col.class')}</th>
                <th className="!text-center">{t('col.subjects')}</th>
                <th>{t('col.status')}</th>
                <th className="!text-end">{t('col.classAverage')}</th>
                <th>{t('col.updated')}</th>
                <th className="!text-end">{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {myExams.map((exam) => (
                <tr key={exam.id}>
                  <td className="font-medium text-foreground">{exam.title}</td>
                  <td className="whitespace-nowrap">{tx(examTypeKey(exam.type))}</td>
                  <td className="whitespace-nowrap">
                    {exam.className}
                    {exam.section ? ` • ${exam.section}` : ''}
                  </td>
                  <td className="text-center tabular-nums">{f.int(exam.subjects.length)}</td>
                  <td>{statusBadge(exam)}</td>
                  <td className="text-end tabular-nums">
                    {exam.status === 'saved' ? f.pct(classAveragePercent(exam)) : '—'}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">{dateOf(exam)}</td>
                  <td>
                    <div className="flex justify-end">{actions(exam)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
        </section>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDescription', { title: toDelete?.title ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deleting}>
                {tc('actions.cancel')}
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {tc('actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
