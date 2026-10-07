'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Users, Phone, Search } from 'lucide-react'
import type { Class, Student } from '@/types'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'

export default function TeacherStudentsPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter(
          (c) => c.teacherId === user.uid && c.isActive !== false
        )
        // Server-side filtered: only the students of the teacher's own classes.
        const myStudents = (
          await Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id)))
        ).flat()
        setClasses(myClasses)
        setStudents(myStudents)
        setClassId((cur) => cur || (myClasses.length > 0 ? myClasses[0].id : ''))
      } catch {
        setError('Failed to load students')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const classById = useMemo(() => {
    const m: Record<string, Class> = {}
    classes.forEach((c) => {
      m[c.id] = c
    })
    return m
  }, [classes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students
      .filter((s) => s.isActive)
      .filter((s) => !classId || s.classId === classId)
      .filter((s) => {
        if (!q) return true
        const cls = classById[s.classId]
        return (
          s.name.toLowerCase().includes(q) ||
          (s.rollNumber || '').toLowerCase().includes(q) ||
          s.parentPhone.toLowerCase().includes(q) ||
          (cls?.name || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
  }, [students, classId, search, classById])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Students</h1>
        <p className="text-gray-600 mt-1">Students in your assigned classes</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-0 shadow-md">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="inline-flex items-center justify-center rounded-lg bg-green-100 p-2">
                <Users className="h-5 w-5 text-green-600" />
              </span>
              Student List
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-600">
                {filtered.length}
              </span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:ml-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student, roll no or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-input bg-white pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="h-9 rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All My Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.section ? ` • ${c.section}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-10">
              {classes.length === 0
                ? 'No classes have been assigned to you yet.'
                : 'No students found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Photo</th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Roll</th>
                    <th className="pb-3 pr-4 font-medium">Age</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Gender</th>
                    <th className="pb-3 pr-4 font-medium">Parent Phone</th>
                    <th className="pb-3 font-medium">Alternative Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const cls = classById[s.classId]
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 pr-4">
                          <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(s)}
                            className="text-left font-medium text-gray-900 cursor-pointer hover:text-green-600 hover:underline"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="py-3 pr-4">{s.rollNumber || '—'}</td>
                        <td className="py-3 pr-4">{s.age ?? '—'}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            {cls?.name || s.className || '—'}
                            {cls?.section ? ` • ${cls.section}` : ''}
                          </span>
                        </td>
                        <td className="py-3 pr-4 capitalize">{s.gender || '—'}</td>
                        <td className="py-3 pr-4">
                          {s.parentPhone ? (
                            <a
                              href={`tel:${s.parentPhone}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1 font-medium text-green-700 transition hover:bg-green-100"
                            >
                              <Phone className="h-3.5 w-3.5" /> {s.parentPhone}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {s.alternativePhone ? (
                            <a
                              href={`tel:${s.alternativePhone}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 font-medium text-teal-700 transition hover:bg-teal-100"
                            >
                              <Phone className="h-3.5 w-3.5" /> {s.alternativePhone}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {viewingStudent && (
        <StudentDetailCard
          student={viewingStudent}
          classes={classes}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  )
}