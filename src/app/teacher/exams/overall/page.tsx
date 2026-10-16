'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader, EmptyState } from '@/components/ui/page'
import { Printer, Download, ArrowLeft, Award, X, School, FileText } from 'lucide-react'
import type { Class, Exam, Student } from '@/types'
import { computeOverall, mergedSubjects } from '@/lib/examMath'
import { OverallResultsSheet, useExamCsv } from '@/components/ExamResultsSheet'
import {
  CertificateOverlay,
  buildCertificateStudent,
  type CertificateStudent,
} from '@/components/CertificateOverlay'

const LEGACY_YEAR = 'Legacy'

export default function OverallResultsPage() {
  const t = useTranslations('teacherExams')
  const tx = useTranslations('exams')
  const tc = useTranslations('common')
  const csv = useExamCsv()
  const { user, school } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [yearFilter, setYearFilter] = useState('') // empty = all years
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [certStudent, setCertStudent] = useState<CertificateStudent | null>(null)
  const certCloseRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const cls = await rtdb.getAllClasses()
        const myClasses = cls.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        setClasses(myClasses)
        // Only the teacher's own classes' students + exams are fetched (server-filtered).
        const [st, ex] = await Promise.all([
          Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id))).then((lists) =>
            lists.flat(),
          ),
          Promise.all(myClasses.map((c) => rtdb.getExamsByClass(c.id))).then((lists) =>
            lists.flat(),
          ),
        ])
        setExams(ex)
        setStudents(st)
        if (!classId && myClasses.length) setClassId(myClasses[0].id)
      } catch (err) {
        console.error(err)
        setError(t('overall.loadError'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const classExams = useMemo(
    () =>
      exams
        .filter((e) => e.classId === classId && e.status === 'saved')
        .sort((a, b) =>
          a.type === b.type ? a.title.localeCompare(b.title) : a.type.localeCompare(b.type),
        ),
    [exams, classId],
  )

  // Unique academic years from the filtered exams (including "Legacy" for
  // exams without an academicYear field).
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    classExams.forEach((e) => {
      years.add(e.academicYear || LEGACY_YEAR)
    })
    return [...years].sort()
  }, [classExams])

  // Exams filtered by selected academic year.
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

  // Certificate preview: close on Escape and move focus into the dialog.
  useEffect(() => {
    if (!certStudent) return
    certCloseRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCertStudent(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [certStudent])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  const hasExams = classExams.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('overall.title')}
        description={t('overall.description')}
        actions={
          <>
            <Link href="/teacher/exams" className={buttonVariants({ variant: 'outline' })}>
              <ArrowLeft className="rtl:rotate-180" /> {t('overall.exams')}
            </Link>
            <Button
              variant="outline"
              onClick={() => csv.exportOverall(selClass?.name || classId, subjectColumns, overallRows)}
              disabled={!hasExams}
            >
              <Download /> {t('overall.downloadCsv')}
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!hasExams}>
              <Printer /> {tc('actions.print')}
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="no-print grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="overall-class">{t('overall.class')}</Label>
          <Select
            id="overall-class"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setYearFilter('')
            }}
          >
            <option value="">{t('overall.selectClass')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.section ? ` • ${c.section}` : ''}
              </option>
            ))}
          </Select>
        </div>
        {classId && availableYears.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="overall-year">{tx('years.label')}</Label>
            <Select id="overall-year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">{tx('years.all')}</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {yearLabel(y)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {!classId ? (
        <EmptyState icon={School} title={t('overall.selectClassHint')} />
      ) : !hasExams ? (
        <EmptyState
          icon={FileText}
          title={t('overall.noExamsTitle')}
          description={t('overall.noExamsDescription')}
        />
      ) : (
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <OverallResultsSheet
            schoolName={school?.name}
            className={selClass?.name || classId}
            section={selClass?.section}
            yearLabel={yearLabel(yearFilter)}
            exams={filteredExams}
            rows={overallRows}
            columns={subjectColumns}
            actionHeader={tc('fields.actions')}
            renderAction={(r) => (
              <Button
                size="sm"
                variant="outline"
                className="h-10 sm:h-9"
                aria-label={t('overall.certificateFor', { name: r.studentName })}
                onClick={() => {
                  const stu = students.find((s) => s.id === r.studentId)
                  if (stu) setCertStudent(buildCertificateStudent(stu, selClass, classExams))
                }}
              >
                <Award /> {t('overall.certificate')}
              </Button>
            )}
          />
        </div>
      )}

      {/* ── Certificate preview ───────────────────────────────────────
          Rendered in place (not portalled) so the print rules in globals.css
          (.cert-print) can show only the certificate. The backdrop is hidden
          by `visibility` when printing; do not add no-print to this wrapper
          or the certificate itself would not print. */}
      {certStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-2 sm:p-4"
          onClick={() => setCertStudent(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-title"
            aria-describedby="cert-desc"
            className="cert-print relative my-auto w-full max-w-5xl shrink-0 rounded-xl border bg-card p-3 shadow-xl sm:p-6 print:border-0 print:bg-transparent print:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 id="cert-title" className="truncate text-lg font-semibold text-foreground">
                  {t('overall.certificateTitle', { name: certStudent.name })}
                </h3>
                <p id="cert-desc" className="text-sm text-muted-foreground">
                  {t('overall.certificateDescription')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => window.print()}>
                  <Printer /> {tc('actions.print')}
                </Button>
                <Button ref={certCloseRef} variant="outline" onClick={() => setCertStudent(null)}>
                  <X /> {tc('actions.close')}
                </Button>
              </div>
            </div>
            <div className="w-full overflow-x-auto print:overflow-visible">
              <div className="min-w-[36rem] print:min-w-0">
                <CertificateOverlay student={certStudent} debug={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
