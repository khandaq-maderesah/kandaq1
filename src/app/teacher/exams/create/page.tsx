'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page'
import { Loader2, Plus, X, FilePlus2, ArrowLeft, BookOpen, Users } from 'lucide-react'
import type { Class, Exam, ExamType, Student } from '@/types'
import { DEFAULT_SUBJECT_MAX, EXAM_TYPES, EXAM_TYPE_LABELS, emptySummary } from '@/lib/examMath'
import { cn } from '@/lib/utils'

interface SubjectDef {
  name: string
  max: number
  on: boolean
}

export default function CreateExamPage() {
  const t = useTranslations('teacherExams.create')
  const tx = useTranslations('exams')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ExamType>('mid')
  const [classId, setClassId] = useState('')
  const [subjects, setSubjects] = useState<SubjectDef[]>([])
  const [customName, setCustomName] = useState('')
  const [customMax, setCustomMax] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const cls = await rtdb.getAllClasses()
        const myClasses = cls.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        setClasses(myClasses)
        // Only the students of the teacher's own classes are fetched (server-filtered).
        const st = (await Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id)))).flat()
        setStudents(st)
      } catch (err) {
        console.error(err)
        setError(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Archived students (isActive === false) are never added to a new exam.
  const activeClassStudents = useMemo(
    () => students.filter((s) => s.classId === classId && s.isActive !== false),
    [students, classId]
  )

  const updateSubject = (index: number, patch: Partial<SubjectDef>) => {
    setSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setError(t('errors.duplicate', { name }))
      return
    }
    const max = customMax ? Number(customMax) : DEFAULT_SUBJECT_MAX
    if (!Number.isFinite(max) || max < 1) {
      setError(t('errors.invalidMax'))
      return
    }
    setSubjects((prev) => [...prev, { name, max, on: true }])
    setCustomName('')
    setCustomMax('')
    setError('')
  }

  const removeSubject = (index: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const active = subjects.filter((s) => s.on)
    if (!classId) {
      setError(t('errors.noClass'))
      return
    }
    if (!active.length) {
      setError(t('errors.noSubjects'))
      return
    }
    if (active.some((s) => !Number.isFinite(s.max) || s.max < 1)) {
      setError(t('errors.invalidMax'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const cls = classes.find((c) => c.id === classId)
      const subjectNames = active.map((s) => s.name)
      const subjectMax: Record<string, number> = {}
      active.forEach((s) => (subjectMax[s.name] = Math.max(1, s.max || DEFAULT_SUBJECT_MAX)))
      const rows: Exam['rows'] = {}
      activeClassStudents.forEach((st) => {
        rows[st.id] = {
          studentId: st.id,
          studentName: st.name,
          rollNumber: st.rollNumber,
          marks: {},
          total: 0,
          average: 0,
          percentage: 0,
          rank: 0,
        }
      })
      const now = new Date().toISOString()
      const id = `exam_${Date.now()}`
      const exam: Exam = {
        id,
        title: title.trim() || tx(EXAM_TYPE_LABELS[type]),
        type,
        classId,
        className: cls?.name || '',
        section: cls?.section,
        academicYear: cls?.academicYear || '',
        subjects: subjectNames,
        subjectMax,
        teacherId: user.uid,
        teacherName: user.name || '',
        status: 'draft',
        rows,
        summary: emptySummary(subjectNames),
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
      }
      await rtdb.createExam(id, exam)
      await rtdb.logAction({
        actorId: user.uid,
        actorName: user.name,
        action: 'create',
        entity: 'exam',
        entityId: id,
        details: exam.title,
      })
      router.push(`/teacher/exams/${id}`)
    } catch (err) {
      console.error(err)
      toast.error(t('errors.createFailed'))
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link href="/teacher/exams" className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft className="rtl:rotate-180" /> {tc('actions.back')}
          </Link>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePlus2 className="h-5 w-5 text-muted-foreground" /> {t('detailsTitle')}
            </CardTitle>
            <CardDescription>{t('detailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">{t('examTitle')}</Label>
              <Input
                id="title"
                placeholder={t('titlePlaceholder', { example: tx(EXAM_TYPE_LABELS[type]) })}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">{t('type')}</Label>
              <Select id="type" value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                {EXAM_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>
                    {tx(et.label)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">{t('class')}</Label>
              <Select
                id="class"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                aria-invalid={error === t('errors.noClass') || undefined}
              >
                <option value="">{t('selectClass')}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` • ${c.section}` : ''}
                  </option>
                ))}
              </Select>
              {classes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('noClasses')}</p>
              ) : (
                classId && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {t('activeStudents', { count: activeClassStudents.length })}
                  </p>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-5 w-5 text-muted-foreground" /> {t('subjectsTitle')}
            </CardTitle>
            <CardDescription>{t('subjectsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjects.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t('noSubjects')}
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {subjects.map((s, i) => {
                  const cbId = `subject-on-${i}`
                  const maxId = `subject-max-${i}`
                  const badMax = s.on && (!Number.isFinite(s.max) || s.max < 1)
                  return (
                    <li key={s.name} className="flex items-center gap-3 px-3 py-2">
                      <input
                        id={cbId}
                        type="checkbox"
                        checked={s.on}
                        onChange={(e) => updateSubject(i, { on: e.target.checked })}
                        className="h-5 w-5 shrink-0 accent-primary"
                        aria-label={t('includeSubject', { subject: s.name })}
                      />
                      <label
                        htmlFor={cbId}
                        className={cn(
                          'min-w-0 flex-1 truncate font-medium',
                          s.on ? 'text-foreground' : 'text-muted-foreground line-through'
                        )}
                      >
                        {s.name}
                      </label>
                      <label htmlFor={maxId} className="sr-only">
                        {t('maxFor', { subject: s.name })}
                      </label>
                      <Input
                        id={maxId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={Number.isFinite(s.max) && s.max > 0 ? s.max : ''}
                        disabled={!s.on}
                        onChange={(e) => updateSubject(i, { max: Number(e.target.value) || 0 })}
                        aria-invalid={badMax || undefined}
                        className="w-24 text-center"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSubject(i)}
                        aria-label={t('removeSubject', { subject: s.name })}
                      >
                        <X className="text-muted-foreground" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="custom-subject">{t('customName')}</Label>
                <Input
                  id="custom-subject"
                  placeholder={t('customNamePlaceholder')}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom()
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-max">{t('customMax')}</Label>
                <Input
                  id="custom-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder={t('customMaxPlaceholder')}
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom()
                    }
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={addCustom} disabled={!customName.trim()}>
                <Plus /> {t('addSubject')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link href="/teacher/exams" className={buttonVariants({ variant: 'outline' })}>
            {tc('actions.cancel')}
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
            {t('submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}
