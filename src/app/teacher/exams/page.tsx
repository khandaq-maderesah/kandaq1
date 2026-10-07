'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, FileText, Plus, Trash2, ClipboardList, Award } from 'lucide-react'
import type { Class, Exam } from '@/types'
import { useLiveData } from '@/lib/dataStore'
import { EXAM_TYPE_LABELS, fmt } from '@/lib/examMath'

function examMax(exam: Exam): number {
  return exam.subjects.reduce((s, sub) => s + (exam.subjectMax?.[sub] ?? 100), 0)
}

function classAveragePercent(exam: Exam): number {
  const rows = Object.values(exam.rows || {})
  if (!rows.length || !examMax(exam)) return 0
  const avg = rows.reduce((s, r) => s + r.percentage, 0) / rows.length
  return avg
}

export default function TeacherExamsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [classes, setClasses] = useState<Class[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    () => exams.filter((e) => e.teacherId === user?.uid || myClassIds.has(e.classId)),
    [exams, myClassIds, user]
  )
  const savedExams = myExams.filter((e) => e.status === 'saved')

  const handleDelete = async (exam: Exam) => {
    if (!confirm(`Delete "${exam.title}"? This cannot be undone.`)) return
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete exam')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Exams & Results</h1>
          <p className="text-gray-600 mt-1">Create exams, enter marks and view results</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/teacher/exams/overall')}>
            <Award className="h-4 w-4 mr-2" /> Overall Result
          </Button>
          <Button onClick={() => router.push('/teacher/exams/create')}>
            <Plus className="h-4 w-4 mr-2" /> New Exam
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {myExams.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center text-gray-500">
            No exams yet. Click &quot;New Exam&quot; to create your first sheet.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> My Exams ({myExams.length})
            </CardTitle>
            <CardDescription>
              {savedExams.length} saved · Total, average, %, rank and pass scores are calculated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Class</th>
                  <th className="px-3 py-2 font-medium">Subjects</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Class Avg %</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myExams
                  .slice()
                  .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                  .map((exam) => (
                    <tr key={exam.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{exam.title}</td>
                      <td className="px-3 py-2">{EXAM_TYPE_LABELS[exam.type]}</td>
                      <td className="px-3 py-2">{exam.className}{exam.section ? ` • ${exam.section}` : ''}</td>
                      <td className="px-3 py-2">{exam.subjects.length}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            exam.status === 'saved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {exam.status === 'saved' ? 'Saved' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {exam.status === 'saved' ? `${fmt(classAveragePercent(exam))}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(exam.updatedAt || exam.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => router.push(`/teacher/exams/${exam.id}`)}>
                            <ClipboardList className="h-4 w-4 mr-1" />
                            {exam.status === 'saved' ? 'View' : 'Fill Marks'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(exam)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}