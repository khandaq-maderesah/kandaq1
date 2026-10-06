'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, X, CheckSquare, FilePlus2 } from 'lucide-react'
import type { Class, Exam, ExamType, Student } from '@/types'
import { DEFAULT_SUBJECT_MAX, EXAM_TYPES, EXAM_TYPE_LABELS, emptySummary } from '@/lib/examMath'

interface SubjectDef {
  name: string
  max: number
  on: boolean
}

export default function CreateExamPage() {
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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const updateSubject = (index: number, patch: Partial<SubjectDef>) => {
    setSubjects((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    if (subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setError(`Subject "${name}" is already added.`)
      return
    }
    setSubjects((prev) => [
      ...prev,
      {
        name,
        max: customMax ? Number(customMax) : DEFAULT_SUBJECT_MAX,
        on: true,
      },
    ])
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
    if (!active.length) {
      setError('Select at least one subject.')
      return
    }
    if (!classId) {
      setError('Select a class.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const cls = classes.find((c) => c.id === classId)
      const classStudents = students.filter((s) => s.classId === classId && s.isActive)
      const subjectNames = active.map((s) => s.name)
      const subjectMax: Record<string, number> = {}
      active.forEach((s) => (subjectMax[s.name] = Math.max(1, s.max || DEFAULT_SUBJECT_MAX)))
      const rows: Exam['rows'] = {}
      classStudents.forEach((st) => {
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
        title: title.trim() || EXAM_TYPE_LABELS[type],
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
      setError(err instanceof Error ? err.message : 'Failed to create exam')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Exam</h1>
        <p className="text-gray-600 mt-1">
          The sheet is generated automatically with all students of the selected class.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5" /> Exam Details
          </CardTitle>
          <CardDescription>Enter the title, type and subjects for this exam.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title</Label>
                <Input
                  id="title"
                  placeholder={`e.g. ${EXAM_TYPE_LABELS[type]}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Exam Type</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ExamType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EXAM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class">Class</Label>
                <select
                  id="class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.section ? ` • ${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subjects / Maximum Marks</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {subjects.map((s, i) => (
                      <tr key={s.name} className="border-b border-gray-100">
                        <td className="py-2 pr-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={s.on}
                              onChange={(e) => updateSubject(i, { on: e.target.checked })}
                              className="h-4 w-4 accent-indigo-600"
                            />
                            <CheckSquare className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-800">{s.name}</span>
                          </label>
                        </td>
                        <td className="py-2 pr-2 w-28">
                          <Input
                            type="number"
                            min={1}
                            value={s.max}
                            disabled={!s.on}
                            onChange={(e) =>
                              updateSubject(i, {
                                max: Number(e.target.value) || 0,
                              })
                            }
                            className="h-9"
                            aria-label={`Max marks for ${s.name}`}
                          />
                        </td>
                        <td className="py-2 w-10">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSubject(i)}
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Input
                  placeholder="Add custom subject (e.g. Tajweed)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="sm:w-72"
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Max"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  className="sm:w-28"
                />
                <Button type="button" variant="outline" onClick={addCustom}>
                  <Plus className="h-4 w-4 mr-2" /> Add Subject
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FilePlus2 className="h-4 w-4 mr-2" />
                )}
                Create Sheet & Fill Marks
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/teacher/exams')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
