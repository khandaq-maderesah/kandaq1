'use client'

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, Loader2, Users, UserPlus, Pencil, X } from 'lucide-react'
import { getNextRollNumber } from '@/lib/rollNumber'
import type { Class, Student } from '@/types'
import { StudentPhotoCapture } from '@/components/StudentPhotoCapture'
import { StudentAvatar } from '@/components/StudentAvatar'
import { isEmbeddedPhoto } from '@/hooks/useStudentPhoto'

export default function TeacherClassesPage() {
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedClassId, setSelectedClassId] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [alternativePhone, setAlternativePhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [parentLanguage, setParentLanguage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [rollNumber, setRollNumber] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter((c) => c.teacherId === user.uid)
        const registrationOpen = await rtdb.getRegistrationOpen()
        // Server-side filtered: only the students of the teacher's own classes
        // (NOT the whole school, which used to include every student photo).
        const myStudents = (
          await Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id)))
        ).flat()
        setClasses(myClasses)
        setStudents(myStudents)
        setRegistrationOpen(registrationOpen)
        if (myClasses.length > 0) {
          setSelectedClassId((current) => current || myClasses[0].id)
        }
      } catch {
        setError('Failed to load your classes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const autoRoll = getNextRollNumber(students, selectedClassId)

  /** The roll number to assign: manual entry when edited, else the suggested one. */
  const effectiveRoll = rollNumber.trim() || autoRoll

  /** True if this roll number is already used by ANOTHER student in the same class. */
  const rollTaken = (() => {
    const inClass = students.filter(
      (s) => s.classId === selectedClassId && s.isActive !== false
    )
    return inClass.some(
      (s) =>
        s.id !== editingId &&
        String(s.rollNumber || '').trim().toLowerCase() === effectiveRoll.toLowerCase()
    )
  })()

  const resetRegisterForm = () => {
    setName('')
    setGender('')
    setAge('')
    setPhotoUrl('')
    setParentLanguage('')
    setParentPhone('')
    setAlternativePhone('')
    setRollNumber('')
    setEditingId(null)
    setSuccess('')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedClassId) return
    if (!editingId && !registrationOpen) {
      setError('Student registration is closed. An admin must open registration in Settings before new students can be added.')
      return
    }
    // Never allow a duplicate roll number within the same class.
    if (rollTaken) {
      setError(`Roll number "${effectiveRoll}" is already used in this class.`)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const cls = classes.find((c) => c.id === selectedClassId)
      const roll = getNextRollNumber(students, selectedClassId)
      const data = {
        name,
        rollNumber: editingId ? rollNumber.trim() || roll : rollNumber.trim() || roll,
        gender: (gender as 'male' | 'female') || undefined,
        age: age === '' ? undefined : age,
        parentLanguage: (parentLanguage as 'Amharic' | 'Afaan Oromoo') || undefined,
        classId: selectedClassId,
        className: cls?.name || '',
        parentPhone,
        alternativePhone,
        updatedAt: new Date().toISOString(),
      }
      if (editingId) {
        // Partial update: only the edited fields change, the originally
        // registered information is preserved.
        await rtdb.setStudentPhoto(editingId, photoUrl)
        await rtdb.updateStudent(editingId, data)
        await rtdb.logAction({
          actorId: user.uid,
          actorName: user.name,
          action: 'update',
          entity: 'student',
          entityId: editingId,
          details: name,
        })
        resetRegisterForm()
        setSuccess('Student updated successfully')
      } else {
        const studentId = 'student_' + Date.now()
        await rtdb.createStudent(studentId, {
          id: studentId,
          ...data,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: user.uid,
          createdByName: user.name,
          createdByRole: user.role,
        })
        // Write the photo AFTER the student exists so the RTDB rules can resolve
        // class ownership for the teacher's write on /studentPhotos.
        await rtdb.setStudentPhoto(studentId, photoUrl)
        resetRegisterForm()
        setSuccess('Student registered with Roll No ' + roll)
      }
      setStudents(
        (await Promise.all(
          classes
            .filter((c) => c.teacherId === user.uid)
            .map((c) => rtdb.getStudentsByClass(c.id))
        )).flat()
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register student')
    } finally {
      setSaving(false)
    }
  }

  const startEditStudent = async (s: Student) => {
    setSelectedClassId(s.classId)
    setEditingId(s.id)
    setName(s.name)
    setRollNumber(s.rollNumber || '')
    setGender(s.gender || '')
    setAge(s.age ?? '')
    // Photos live in their own node; fetch on demand for non-embedded records.
    let photo = s.photoUrl || ''
    if (!isEmbeddedPhoto(s.photoUrl)) {
      photo = (await rtdb.getStudentPhoto(s.id)) || ''
    }
    setPhotoUrl(photo)
    setParentLanguage(s.parentLanguage || '')
    setParentPhone(s.parentPhone)
    setAlternativePhone(s.alternativePhone || '')
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
        <p className="text-gray-600 mt-1">Classes assigned to you</p>
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
      {!registrationOpen && !editingId && (
        <Alert variant="destructive">
          <AlertDescription>
            Student registration is currently closed. Existing students can still be edited.
          </AlertDescription>
        </Alert>
      )}

      {classes.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-gray-500 text-center">No classes assigned to you yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classes.map((c) => {
                const count = students.filter((s) => s.classId === c.id && s.isActive).length
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-green-500 flex items-center justify-center mb-4">
                        <GraduationCap className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle>{c.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500 mb-2">
                        {c.grade ? `Grade ${c.grade}` : ''} {c.section ? `• Section ${c.section}` : ''}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">{c.academicYear}</p>
                      <div className="flex items-center gap-1 text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>{count} students</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {selectedClassId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="inline-flex items-center justify-center rounded-lg bg-green-100 p-2">
                    {editingId ? <Pencil className="h-5 w-5 text-green-600" /> : <UserPlus className="h-5 w-5 text-green-600" />}
                  </span>
                  {editingId ? 'Edit Student' : 'Register Student'}
                </CardTitle>
                <CardDescription>
                  {editingId
                    ? 'Update the details below - all previously registered information is kept.'
                    : 'Roll number is assigned automatically per class'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cls">Class</Label>
                    <select
                      id="cls"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.section ? ' • ' + c.section : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Student Name</Label>
                    <Input id="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      min={1}
                      max={100}
                      placeholder="e.g. 10"
                      value={age === '' ? '' : age}
                      onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parentLanguage">Parent Language</Label>
                    <select
                      id="parentLanguage"
                      value={parentLanguage}
                      onChange={(e) => setParentLanguage(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select language</option>
                      <option value="Amharic">Amharic</option>
                      <option value="Afaan Oromoo">Afaan Oromoo</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pPhone">Parent Phone</Label>
                    <Input id="pPhone" type="tel" placeholder="03XX-XXXXXXX" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="altPhone">Alternative Phone Number</Label>
                    <Input id="altPhone" type="tel" placeholder="03XX-XXXXXXX (optional)" value={alternativePhone} onChange={(e) => setAlternativePhone(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rollNumber">Roll Number</Label>
                    <Input
                      id="rollNumber"
                      placeholder={autoRoll}
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      className="h-10 w-full"
                      aria-invalid={rollTaken}
                    />
                    {rollTaken ? (
                      <p className="text-xs font-medium text-red-600">Roll number used</p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Suggested: {autoRoll} — you can edit this to rearrange roll numbers.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Student Photo</Label>
                    <StudentPhotoCapture value={photoUrl} onChange={setPhotoUrl} />
                  </div>

                  <Button type="submit" className="w-full" disabled={saving || (!editingId && !registrationOpen)}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : editingId ? (
                      <Pencil className="h-4 w-4 mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    {saving
                      ? editingId
                        ? 'Saving...'
                        : 'Registering...'
                      : editingId
                        ? 'Save Changes'
                        : 'Register Student'}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" className="w-full" onClick={resetRegisterForm}>
                      <X className="h-4 w-4 mr-2" /> Cancel Edit
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {selectedClassId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="inline-flex items-center justify-center rounded-lg bg-green-100 p-2">
                    <Users className="h-5 w-5 text-green-600" />
                  </span>
                  Registered Students
                  <span className="text-sm font-normal text-gray-500">
                    ({students.filter((s) => s.classId === selectedClassId).length})
                  </span>
                </CardTitle>
                <CardDescription>
                  Click Edit to update a student - their existing information is kept.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {students
                  .filter((s) => s.classId === selectedClassId)
                  .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''))
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2">
                      <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{s.name}</p>
                        <p className="text-xs text-gray-500">
                          Roll {s.rollNumber || '—'}
                          {s.age ? ` • ${s.age} yrs` : ''}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => startEditStudent(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
    </div>
  )
}
