'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, EmptyState, TableContainer } from '@/components/ui/page'
import { Loader2, Save, ArrowLeft, CheckCircle2, PencilLine, Info, AlertTriangle, Users } from 'lucide-react'
import type { Exam } from '@/types'
import {
  computeExam,
  examTotalMax,
  examTypeKey,
  toNumber,
  DEFAULT_SUBJECT_MAX,
} from '@/lib/examMath'
import {
  useExamFormat,
  StudentCell,
  SubjectHead,
  stickyCellClass,
  stickyHeadClass,
} from '@/components/ExamResultsSheet'
import { cn } from '@/lib/utils'

/** A student on the mark sheet. `inactive` = kept from the recorded exam rows only. */
interface SheetStudent {
  id: string
  name: string
  rollNumber?: string
  inactive: boolean
}

interface LiveRow {
  studentId: string
  studentName: string
  rollNumber?: string
  inactive: boolean
  total: number
  average: number
  percentage: number
  rank: number
}

export default function MarkExamPage() {
  const t = useTranslations('teacherExams.mark')
  const tx = useTranslations('exams')
  const f = useExamFormat()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<SheetStudent[]>([])
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const ex = await rtdb.getExam(id)
        if (!ex) {
          setError(t('notFound'))
          setLoading(false)
          return
        }
        // Only this exam's class needs its students — no full-school download.
        const clsStudentsRaw = await rtdb.getStudentsByClass(ex.classId)
        const active: SheetStudent[] = clsStudentsRaw
          .filter((s) => s.isActive !== false)
          .map((s) => ({ id: s.id, name: s.name, rollNumber: s.rollNumber, inactive: false }))
        // Students already recorded on this exam who are no longer active
        // (archived or moved) keep their recorded row.
        const activeIds = new Set(active.map((s) => s.id))
        const recorded: SheetStudent[] = Object.values(ex.rows || {})
          .filter((r) => r?.studentId && !activeIds.has(r.studentId))
          .map((r) => ({ id: r.studentId, name: r.studentName, rollNumber: r.rollNumber, inactive: true }))
        const all = [...active, ...recorded]
        setStudents(all)
        setExam(ex)

        const init: Record<string, Record<string, string>> = {}
        all.forEach((st) => {
          init[st.id] = {}
          ex.subjects.forEach((sub) => {
            const v = ex.rows?.[st.id]?.marks?.[sub]
            init[st.id][sub] = v != null ? String(v) : ''
          })
        })
        setMarks(init)
      } catch (err) {
        console.error(err)
        setError(t('loadError'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMax = exam ? examTotalMax(exam.subjects, exam.subjectMax) : 0
  const subjectMax = (sub: string) => exam?.subjectMax?.[sub] ?? DEFAULT_SUBJECT_MAX

  const isInvalid = (raw: string | undefined, max: number) => {
    if (raw == null || raw.trim() === '') return false
    const n = Number(raw)
    return !Number.isFinite(n) || n < 0 || n > max
  }

  const invalidCount = useMemo(() => {
    if (!exam) return 0
    let n = 0
    students.forEach((st) =>
      exam.subjects.forEach((sub) => {
        if (isInvalid(marks[st.id]?.[sub], exam.subjectMax?.[sub] ?? DEFAULT_SUBJECT_MAX)) n++
      })
    )
    return n
  }, [exam, students, marks])

  const liveRows = useMemo<LiveRow[]>(() => {
    if (!exam) return []
    const arr = students.map((st) => {
      const m = marks[st.id] || {}
      let total = 0
      exam.subjects.forEach((sub) => (total += toNumber(m[sub])))
      const average = exam.subjects.length ? total / exam.subjects.length : 0
      const percentage = totalMax ? (total / totalMax) * 100 : 0
      return {
        studentId: st.id,
        studentName: st.name,
        rollNumber: st.rollNumber,
        inactive: st.inactive,
        total,
        average,
        percentage,
        rank: 0,
      }
    })
    const sorted = [...arr].sort((a, b) => b.total - a.total)
    let prevTotal: number | null = null
    let prevRank = 0
    sorted.forEach((r, i) => {
      if (prevTotal !== null && r.total === prevTotal) r.rank = prevRank
      else {
        r.rank = i + 1
        prevRank = i + 1
        prevTotal = r.total
      }
    })
    return arr.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
  }, [students, marks, exam, totalMax])

  const setMark = (studentId: string, subject: string, value: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [subject]: value },
    }))
  }

  const handleSave = async () => {
    if (!exam || !user) return
    if (invalidCount > 0) {
      toast.error(t('invalidToast', { count: invalidCount }))
      return
    }
    setSaving(true)
    setError('')
    try {
      const rows: Exam['rows'] = {}
      students.forEach((st) => {
        const m: Record<string, number> = {}
        exam.subjects.forEach((sub) => (m[sub] = toNumber(marks[st.id]?.[sub])))
        const prev = exam.rows?.[st.id]
        rows[st.id] = {
          studentId: st.id,
          studentName: prev && st.inactive ? prev.studentName : st.name,
          rollNumber: prev && st.inactive ? prev.rollNumber : st.rollNumber,
          marks: m,
          total: 0,
          average: 0,
          percentage: 0,
          rank: 0,
        }
      })
      const computed = computeExam({ ...exam, rows })
      const now = new Date().toISOString()
      await rtdb.updateExam(exam.id, { ...computed, status: 'saved', updatedAt: now })
      await rtdb.logAction({
        actorId: user.uid,
        actorName: user.name,
        action: 'save',
        entity: 'exam',
        entityId: exam.id,
        details: exam.title,
      })
      setExam({ ...computed, status: 'saved', updatedAt: now })
      toast.success(t('savedToast'))
    } catch (err) {
      console.error(err)
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const backLink = (
    <Link href="/teacher/exams" className={buttonVariants({ variant: 'outline' })}>
      <ArrowLeft className="rtl:rotate-180" /> {t('backToExams')}
    </Link>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error || t('notFound')}</AlertDescription>
        </Alert>
        {backLink}
      </div>
    )
  }

  const classStat = (sub: string) => {
    const vals = liveRows.map((r) => toNumber(marks[r.studentId]?.[sub]))
    const sum = vals.reduce((a, b) => a + b, 0)
    const max = vals.length ? Math.max(...vals) : 0
    return { max, average: vals.length ? sum / vals.length : 0 }
  }

  const meta = [
    tx(examTypeKey(exam.type)),
    exam.className,
    exam.section ? tx('sheet.section', { section: exam.section }) : null,
    tx('sheet.totalMarks', { total: f.int(totalMax) }),
    tx('sheet.studentCount', { count: students.length }),
  ].filter(Boolean) as string[]

  const saveButton = (
    <Button onClick={handleSave} disabled={saving || students.length === 0}>
      {saving ? <Loader2 className="animate-spin" /> : <Save />}
      {t('save')}
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {exam.title}
            {exam.status === 'saved' ? (
              <Badge variant="success">
                <CheckCircle2 /> {t('saved')}
              </Badge>
            ) : (
              <Badge variant="warning">
                <PencilLine /> {t('draft')}
              </Badge>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-2 gap-y-1">
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                {m}
              </span>
            ))}
          </span>
        }
        actions={
          <>
            {backLink}
            {saveButton}
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {students.length === 0 ? (
        <EmptyState icon={Users} title={t('noStudents')} />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {t('instructions')}
            </p>
            {invalidCount > 0 && (
              <Badge variant="destructive" className="self-start sm:self-auto" role="status">
                <AlertTriangle /> {t('invalidCount', { count: invalidCount })}
              </Badge>
            )}
          </div>

          <TableContainer className="max-h-[70vh] overflow-y-auto [&_td]:py-2 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-20 [&_thead_th]:!bg-muted [&_thead_th:first-child]:z-30">
            <thead>
              <tr>
                <th className={stickyHeadClass}>{tx('table.student')}</th>
                {exam.subjects.map((sub) => (
                  <SubjectHead key={sub} subject={sub} max={subjectMax(sub)} />
                ))}
                <th className="!text-center">{tx('table.total')}</th>
                <th className="!text-center">{tx('table.average')}</th>
                <th className="!text-center">{tx('table.percent')}</th>
                <th className="!text-center">{tx('table.rank')}</th>
              </tr>
            </thead>
            <tbody>
              {liveRows.map((r) => (
                <tr key={r.studentId}>
                  <td className={stickyCellClass}>
                    <StudentCell
                      name={r.studentName}
                      roll={r.rollNumber}
                      extra={
                        r.inactive ? (
                          <Badge variant="outline" title={t('notActiveHint')}>
                            {t('notActive')}
                          </Badge>
                        ) : undefined
                      }
                    />
                  </td>
                  {exam.subjects.map((sub) => {
                    const max = subjectMax(sub)
                    const raw = marks[r.studentId]?.[sub] ?? ''
                    const bad = isInvalid(raw, max)
                    return (
                      <td key={sub} className="text-center">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={max}
                          step={0.5}
                          value={raw}
                          onChange={(e) => setMark(r.studentId, sub, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          className={cn(
                            'mx-auto h-10 w-20 text-center tabular-nums',
                            bad && 'border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive'
                          )}
                          aria-label={t('markFor', { subject: sub, name: r.studentName })}
                          aria-invalid={bad || undefined}
                          title={bad ? t('rangeError', { max }) : t('rangeHint', { max })}
                        />
                      </td>
                    )
                  })}
                  <td className="text-center font-semibold tabular-nums">{f.num(r.total)}</td>
                  <td className="text-center tabular-nums">{f.avg(r.average)}</td>
                  <td className="text-center tabular-nums">{f.pct(r.percentage)}</td>
                  <td className="text-center font-semibold tabular-nums">{f.int(r.rank)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 text-xs text-muted-foreground">
                <td className={cn(stickyCellClass, '!bg-muted font-semibold text-foreground')}>
                  {tx('table.classAverage')}
                </td>
                {exam.subjects.map((sub) => (
                  <td key={sub} className="text-center tabular-nums">
                    {f.avg(classStat(sub).average)}
                  </td>
                ))}
                <td className="text-center tabular-nums">
                  {f.avg(liveRows.reduce((s, r) => s + r.total, 0) / (liveRows.length || 1))}
                </td>
                <td colSpan={3}></td>
              </tr>
              <tr className="border-t bg-muted/40 text-xs text-muted-foreground">
                <td className={cn(stickyCellClass, '!bg-muted font-semibold text-foreground')}>
                  {tx('table.highest')}
                </td>
                {exam.subjects.map((sub) => (
                  <td key={sub} className="text-center tabular-nums">
                    {f.num(classStat(sub).max)}
                  </td>
                ))}
                <td className="text-center tabular-nums">
                  {liveRows.length ? f.num(Math.max(...liveRows.map((r) => r.total))) : '—'}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </TableContainer>

          <div className="flex justify-end">{saveButton}</div>
        </>
      )}
    </div>
  )
}
