'use client'

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Calendar, History } from 'lucide-react'
import type { Attendance, Class } from '@/types'

export default function TeacherHistoryPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState<Attendance[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const [classList] = await Promise.all([rtdb.getAllClasses()])
        // Teachers only see history for the classes assigned to them.
        const myClasses = classList.filter(
          (c) => c.teacherId === user.uid && c.isActive !== false
        )
        const myClassIds = new Set(myClasses.map((c) => c.id))
        setClasses(myClasses)
        // Server-side filtered: only this teacher's own attendance is downloaded.
        const attendanceList = await rtdb.getAttendanceByTeacher(user.uid)
        setRecords(attendanceList.filter((r) => myClassIds.has(r.classId)))
      } catch {
        setError('Failed to load attendance history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const filtered = records.filter(
    (r) => (!classId || r.classId === classId) && (!date || r.date === date)
  )

  const handleStatusChange = async (r: Attendance, status: string) => {
    try {
      await rtdb.updateAttendance(r.id, {
        status: status as Attendance['status'],
        markedAt: new Date().toISOString(),
      })
      setRecords((prev) =>
        prev.map((rec) => (rec.id === r.id ? { ...rec, status: status as Attendance['status'] } : rec))
      )
      setSuccess('Attendance updated')
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance History</h1>
        <p className="text-gray-600 mt-1">Your past attendance records</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Classes</option>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Records ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No attendance records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Date</th>
                    <th className="pb-3 pr-4 font-medium">Student</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" /> {r.date}
                      </td>
                      <td className="py-3 pr-4 font-medium">{r.studentName}</td>
                      <td className="py-3 pr-4">{r.className || r.classId}</td>
                      <td className="py-3">
                        <select
                          value={r.status}
                          onChange={(e) => handleStatusChange(r, e.target.value)}
                          className={`inline-flex h-8 px-2 rounded-md text-xs font-medium border ${
                            r.status === 'present'
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : r.status === 'late'
                              ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              : r.status === 'excused'
                              ? 'bg-amber-100 text-amber-700 border-amber-300'
                              : 'bg-red-100 text-red-700 border-red-300'
                          }`}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                          <option value="excused">Excused</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}