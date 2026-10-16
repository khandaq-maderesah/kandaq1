'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, EmptyState } from '@/components/ui/page'
import { FileText, Download, Printer, Award, ChevronDown } from 'lucide-react'
import {
  ExamResultsSheet,
  OverallResultsSheet,
  useExamCsv,
} from '@/components/ExamResultsSheet'
import type { Class, Exam, Student } from '@/types'
import { computeOverall, examTypeKey, mergedSubjects } from '@/lib/examMath'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const LEGACY_YEAR = 'Legacy'

export default function AdminExamsPage() {
  const t = useTranslations('adminExams')
  const tx = useTranslations('exams')
  const tc = useTranslations('common')
  const format = useFormatter()
  const { school } = useAuth()
  const csv = useExamCsv()
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [yearFilter, setYearFilter] = useState('') // empty = all years
  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  const [printExamId, setPrintExamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [cls, ex] = await Promise.all([rtdb.getAllClasses(), rtdb.getAllExams()])
        setClasses(cls.filter((c) => c.isActive !== false))
        setExams(ex)
        if (!classId && cls.length) setClassId(cls[0].id)
      } catch (err) {
        console.error(err)
        setError(t('loadError'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Only the selected class's students are fetched (server-filtered), instead of
  // downloading all 450+ students on page load.
  useEffect(() => {
    if (!classId) return
    let cancelled = false
    rtdb
      .getStudentsByClass(classId)
      .then((l) => {
        if (!cancelled) setStudents(l)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [classId])

  const classExams = useMemo(
    () =>
      exams
        .filter((e) => e.classId === classId && e.status === 'saved')
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [exams, classId],
  )

  // Unique academic years (exams without one are grouped as "legacy").
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    classExams.forEach((e) => years.add(e.academicYear || LEGACY_YEAR))
    return [...years].sort()
  }, [classExams])

  const filteredExams = useMemo(
    () =>
      !yearFilter
        ? classExams
        : classExams.filter((e) => (e.academicYear || LEGACY_YEAR) === yearFilter),
    [classExams, yearFilter],
  )

  const overallRows = useMemo(
    () =>
      computeOverall(
        filteredExams,
        students.filter((s) => s.classId === classId),
      ),
    [filteredExams, students, classId],
  )

  // One column per subject, aggregating marks across all saved exams.
  const subjectColumns = useMemo(() => {
    const subs = mergedSubjects(filteredExams)
    const byMax = new Map(overallRows[0]?.perSubject.map((p) => [p.subject, p.max]) ?? [])
    return subs.map((sub) => ({ subject: sub, max: byMax.get(sub) ?? 0 }))
  }, [filteredExams, overallRows])

  const selClass = classes.find((c) => c.id === classId)
  const yearLabel = (y: string) =>
    !y ? tx('years.all') : y === LEGACY_YEAR ? tx('years.legacy') : y

  useEffect(() => {
    if (!printExamId) return

    const handleAfterPrint = () => setPrintExamId(null)
    window.addEventListener('afterprint', handleAfterPrint)
    const printFrame = window.requestAnimationFrame(() => window.print())

    return () => {
      window.cancelAnimationFrame(printFrame)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [printExamId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="no-print space-y-2 sm:max-w-sm">
        <Label htmlFor="exam-class">{t('filters.class')}</Label>
        <Select id="exam-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t('filters.allClasses')}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.section ? ` • ${c.section}` : ''}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-muted-foreground" /> {t('list.title')}
          </CardTitle>
          <CardDescription>
            {classId ? t('list.count', { count: classExams.length }) : t('list.selectClass')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!classId ? (
            <EmptyState icon={FileText} title={t('list.selectClass')} />
          ) : classExams.length === 0 ? (
            <EmptyState icon={FileText} title={t('list.empty')} description={t('list.emptyHint')} />
          ) : (
            <ul className="space-y-2">
              {classExams.map((e) => {
                const open = activeExamId === e.id
                const panelId = `exam-panel-${e.id}`
                return (
                  <li key={e.id} className="rounded-lg border">
                    <div className="flex items-center gap-2 p-2 ps-3">
                      <button
                        type="button"
                        onClick={() => setActiveExamId(open ? null : e.id)}
                        aria-expanded={open}
                        aria-controls={panelId}
                        aria-label={open ? t('list.hideResults') : t('list.showResults')}
                        className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                            open && 'rotate-180',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">{e.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <Badge variant="secondary">{tx(examTypeKey(e.type))}</Badge>
                            <span>{tx('sheet.studentCount', { count: Object.keys(e.rows || {}).length })}</span>
                            <span>
                              {t('list.updated', {
                                date: format.dateTime(new Date(e.updatedAt || e.createdAt), {
                                  dateStyle: 'medium',
                                }),
                              })}
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="no-print flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => csv.exportExam(e)}
                          aria-label={t('list.downloadCsv', { title: e.title })}
                          title={tc('actions.exportCsv')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setActiveExamId(e.id)
                            setPrintExamId(e.id)
                          }}
                          aria-label={t('list.printExam', { title: e.title })}
                          title={tc('actions.print')}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {open && (
                      <div id={panelId} className="border-t p-3">
                        <div className={printExamId === e.id ? 'print-target' : undefined}>
                          <ExamResultsSheet exam={e} />
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {classId && classExams.length > 0 && (
        <Card>
          <CardHeader className="gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-5 w-5 text-muted-foreground" /> {t('overall.title')}
            </CardTitle>
            <CardDescription>{t('overall.description')}</CardDescription>
            <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-56">
                <Label htmlFor="exam-year">{tx('years.label')}</Label>
                <Select id="exam-year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  <option value="">{tx('years.all')}</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {yearLabel(y)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    csv.exportOverall(selClass?.name || classId, subjectColumns, overallRows)
                  }
                >
                  <Download className="h-4 w-4" /> {tc('actions.exportCsv')}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> {tc('actions.print')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <OverallResultsSheet
              schoolName={school?.name}
              className={selClass?.name || classId}
              section={selClass?.section}
              yearLabel={yearLabel(yearFilter)}
              exams={filteredExams}
              rows={overallRows}
              columns={subjectColumns}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
