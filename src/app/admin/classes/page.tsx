'use client'

import { useEffect, useMemo, useState } from 'react'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GraduationCap, Loader2, Plus, Users, Trash2, Search, Pencil, X, Eye } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { useLiveData } from '@/lib/dataStore'
import type { Class, Student } from '@/types'
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { StudentAvatar } from '@/components/StudentAvatar'

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const perPage = 10
  const [studentsOfClass, setStudentsOfClass] = useState<Class | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)

  // Live updates via the shared store (the navbar bells already keep these
  // channels open, so this page adds no extra downloads).
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  useEffect(() => {
    if (storeClasses.data) {
      setClasses(storeClasses.data)
      setLoading(false)
    }
  }, [storeClasses.data])
  useEffect(() => {
    setStudents(storeStudents.data ?? [])
  }, [storeStudents.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classes
    return classes.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.section || '').toLowerCase().includes(q) ||
        (c.grade || '').toLowerCase().includes(q) ||
        (c.teacherName || '').toLowerCase().includes(q) ||
        (c.academicYear || '').toLowerCase().includes(q)
    )
  }, [classes, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === studentsOfClass?.id),
    [students, studentsOfClass]
  )

  const resetForm = () => {
    setName('')
    setGrade('')
    setSection('')
    setAcademicYear('')
    setEditingId(null)
  }

  const startEdit = (c: Class) => {
    setEditingId(c.id)
    setName(c.name)
    setGrade(c.grade || '')
    setSection(c.section || '')
    setAcademicYear(c.academicYear)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const data = {
        name,
        grade: grade || undefined,
        section: section || undefined,
        academicYear,
        updatedAt: new Date().toISOString(),
      }
      if (editingId) {
        await rtdb.updateClass(editingId, data)
        setSuccess('Class updated successfully')
      } else {
        const classId = `class_${Date.now()}`
        await rtdb.createClass(classId, {
          id: classId,
          ...data,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        })
        setSuccess('Class created successfully')
      }
      resetForm()
      // The shared store refresh passes through automatically.
    } catch (err: any) {
      setError(err.message || 'Failed to save class')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: Class) => {
    if (!confirm(`Delete class "${c.name}"? This cannot be undone.`)) return
    try {
      await rtdb.deleteClass(c.id)
      if (editingId === c.id) resetForm()
      setSuccess('Class deleted')
      // The store refresh passes through automatically.
    } catch (err: any) {
      setError(err.message || 'Failed to delete class')
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
        <h1 className="text-3xl font-bold text-gray-900">Classes Management</h1>
        <p className="text-gray-600 mt-1">Create and edit classes</p>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {editingId ? 'Edit Class' : 'Create New Class'}
          </CardTitle>
          <CardDescription>
            {editingId ? 'Update the class details below' : 'Create a class. Teachers are assigned when you register them from the Users page.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Class Name</Label>
                <Input id="name" placeholder="e.g. Grade 5" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Grade</Label>
                <Input id="grade" placeholder="e.g. 5" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <Input id="section" placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="year">Academic Year</Label>
                <Input id="year" placeholder="e.g. 2026-2027" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : editingId ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingId ? 'Save Changes' : 'Create Class'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
<Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Class List ({filtered.length} / {classes.length})
          </CardTitle>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by class, teacher or year..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {search ? 'No classes match your search.' : 'No classes yet. Create your first class above.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Section</th>
                    <th className="pb-3 pr-4 font-medium">Teacher</th>
                    <th className="pb-3 pr-4 font-medium">Year</th>
                    <th className="pb-3 pr-4 font-medium">Students</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => {
                    const count = students.filter((s) => s.classId === c.id).length
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{c.name}</td>
                        <td className="py-3 pr-4">{c.section || '—'}</td>
                        <td className="py-3 pr-4">{c.teacherName || 'Unassigned'}</td>
                        <td className="py-3 pr-4">{c.academicYear}</td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => setStudentsOfClass(c)}
                            title="View students in this class"
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-blue-700 transition hover:bg-blue-100"
                          >
                            <Users className="h-3.5 w-3.5" /> {count}
                          </button>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(c)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
        </CardContent>
      </Card>

      {studentsOfClass && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setStudentsOfClass(null)}
        >
          <Card
            className="flex max-h-[85vh] w-full max-w-lg flex-col border-0 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="relative">
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
                onClick={() => setStudentsOfClass(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" /> {studentsOfClass.name} — Students ({classStudents.length})
              </CardTitle>
              <CardDescription>
                {studentsOfClass.academicYear} • {studentsOfClass.section || 'No section'} •{' '}
                {studentsOfClass.teacherName || 'Unassigned'}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              {classStudents.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">No students registered in this class yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {classStudents.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setViewingStudent(s)}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-gray-50"
                      >
                        <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-800">{s.name}</span>
                          <span className="block text-xs text-gray-500">
                            {s.rollNumber ? `Roll ${s.rollNumber}` : 'No roll'} • {s.parentPhone || 'No phone'}
                          </span>
                        </span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewingStudent && (
        <StudentDetailCard student={viewingStudent} classes={classes} onClose={() => setViewingStudent(null)} />
      )}
    </div>
  )
}
