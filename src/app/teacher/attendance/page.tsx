'use client'

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Check, X, Clock, Save, RotateCcw, ShieldCheck } from 'lucide-react'
import type { Class, Student, AttendanceStatus } from '@/types'

const today = () => new Date().toISOString().slice(0, 10)

export default function TeacherAttendancePage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today())
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter((c) => c.teacherId === user.uid)
        setClasses(myClasses)
        if (myClasses.length > 0) {
          setClassId(myClasses[0].id)
        }
      } catch {
        setError('Failed to load your classes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  // Load students + existing attendance for selected class/date
  useEffect(() => {
    const loadClassData = async () => {
      if (!classId) return
      setLoadingStudents(true)
      setError('')
      setSuccess('')
      try {
        const studentList = await rtdb.getStudentsByClass(classId)
        const activeStudents = studentList.filter((s) => s.isActive)
        setStudents(activeStudents)

        const existing = await rtdb.getAttendanceByClassAndDate(classId, date)
        const map: Record<string, AttendanceStatus> = {}
        existing.forEach((r) => {
          map[r.studentId] = r.status
        })
        setStatusMap(map)
      } catch {
        setError('Failed to load students')
      } finally {
        setLoadingStudents(false)
      }
    }
    loadClassData()
  }, [classId, date])

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }))
  }

  const markAll = (status: AttendanceStatus | null) => {
    if (status === null) {
      setStatusMap({})
      return
    }
    const map: Record<string, AttendanceStatus> = {}
    students.forEach((s) => {
      map[s.id] = status
    })
    setStatusMap(map)
  }

  const handleSave = async () => {
    if (!classId) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      for (const s of students) {
        const status = statusMap[s.id]
        if (!status) continue
        const attendanceId = `${classId}_${date}_${s.id}`
        const existing = await rtdb.getAttendance(attendanceId)
        const record = {
          studentId: s.id,
          classId,
          date,
          status,
          studentName: s.name,
          className: classes.find((c) => c.id === classId)?.name || '',
          teacherId: user?.uid,
          markedBy: user?.uid,
          markedAt: new Date().toISOString(),
        }
        if (existing) {
          await rtdb.updateAttendance(attendanceId, { ...record, id: attendanceId })
        } else {
          await rtdb.createAttendance(attendanceId, { ...record, id: attendanceId })
        }
      }
      setSuccess('Attendance saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save attendance')
    } finally {
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
        <h1 className="text-3xl font-bold text-gray-900">Take Attendance</h1>
        <p className="text-gray-600 mt-1">Mark student attendance for a class</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Class</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={classes.length === 0}
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {classes.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-gray-500 text-center">No classes assigned to you yet.</p>
          </CardContent>
        </Card>
      ) : loadingStudents ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-gray-500 text-center">No active students in this class.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Students ({students.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('present')}>
                  <Check className="h-4 w-4 mr-1" /> All Present
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('absent')}>
                  <X className="h-4 w-4 mr-1" /> All Absent
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => markAll('excused')}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> All Excused
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => markAll(null)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Roll</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const status = statusMap[s.id]
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{s.name}</td>
                        <td className="py-3 pr-4">{s.rollNumber || '—'}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setStatus(s.id, 'present')}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border ${
                                status === 'present'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-white text-green-600 border-green-300 hover:bg-green-50'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" /> Present
                            </button>
                            <button
                              onClick={() => setStatus(s.id, 'absent')}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border ${
                                status === 'absent'
                                  ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                              }`}
                            >
                              <X className="h-3.5 w-3.5" /> Absent
                            </button>
                            <button
                              onClick={() => setStatus(s.id, 'late')}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border ${
                                status === 'late'
                                  ? 'bg-yellow-500 text-white border-yellow-500'
                                  : 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50'
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5" /> Late
                            </button>
                            <button
                              onClick={() => setStatus(s.id, 'excused')}
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border ${
                                status === 'excused'
                                  ? 'bg-violet-500 text-white border-violet-500'
                                  : 'bg-white text-violet-600 border-violet-300 hover:bg-violet-50'
                              }`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Excused
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Attendance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
