'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Loader2, Plus, Phone, Search, Pencil, Trash2, X, Download, Upload, Eye, FileSpreadsheet, AlertTriangle, CheckCircle2, CheckSquare, Square, Info } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import type { Student, Class, User } from '@/types'
import { getNextRollNumber } from '@/lib/rollNumber'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import { StudentPhotoCapture } from '@/components/StudentPhotoCapture'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { useLiveData } from '@/lib/dataStore'
import { isEmbeddedPhoto } from '@/hooks/useStudentPhoto'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const perPage = 10
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [gender, setGender] = useState('')
  const [classId, setClassId] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [alternativePhone, setAlternativePhone] = useState('')
  const [section, setSection] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [age, setAge] = useState<number | ''>('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [parentLanguage, setParentLanguage] = useState('')
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [users, setUsers] = useState<User[]>([])
  // Bulk CSV import — analysed in a preview step before anything is written.
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<
    { name: string; roll: string; gender: string; age: number | ''; className: string; classId: string; parentPhone: string; altPhone: string }[]
  >([])
  const [importFileName, setImportFileName] = useState('')
  const [importError, setImportError] = useState('')
  // Backed up (inactive) students — kept, never deleted, and restorable.
  const [showInactive, setShowInactive] = useState(false)

  // Live updates via the shared store (same channels the navbar bells use, so
  // `students`/`classes`/`users` are still downloaded only once per screen).
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))

  useEffect(() => {
    if (storeStudents.data) {
      setStudents(storeStudents.data)
      setLoading(false)
    }
  }, [storeStudents.data])
  useEffect(() => {
    setClasses(storeClasses.data?.filter((c) => c.isActive) ?? [])
  }, [storeClasses.data])
  useEffect(() => {
    setUsers(storeUsers.data ?? [])
  }, [storeUsers.data])

  const filterSectionOptions = useMemo(() => {
    const set = new Set<string>()
    classes.forEach((c) => {
      if (c.section) set.add(c.section.trim())
    })
    students.forEach((s) => {
      if (s.section) set.add(s.section.trim())
    })
    return Array.from(set).sort()
  }, [classes, students])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sf = sectionFilter.trim().toLowerCase()
    const classById: Record<string, Class> = {}
    classes.forEach((c) => {
      classById[c.id] = c
    })
    return students.filter((s) => {
      // Active list by default; the "backup" toggle shows the students that were
      // set inactive (kept in the database, never deleted).
      const active = s.isActive !== false
      if (showInactive ? active : !active) return false
      const cls = classById[s.classId]
      const sectionLabel = (s.section || cls?.section || '').trim()
      // Exact section filter first (so "A" shows ONLY section A students)
      if (sf && sectionLabel.toLowerCase() !== sf) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber || '').toLowerCase().includes(q) ||
        (s.parentPhone || '').toLowerCase().includes(q) ||
        (s.alternativePhone || '').toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q) ||
        (cls?.name || '').toLowerCase().includes(q) ||
        sectionLabel.toLowerCase().includes(q)
      )
    })
  }, [students, search, classes, sectionFilter, showInactive])

  useEffect(() => {
    setPage(1)
  }, [search, sectionFilter, showInactive])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  // Active vs backed-up (inactive) students, for the list header + backup toggle.
  const activeStudents = useMemo(() => students.filter((s) => s.isActive !== false), [students])
  const inactiveStudents = useMemo(() => students.filter((s) => s.isActive === false), [students])

  const handleExport = () => {
    exportToCsv(
      `students-${dateStamp()}.csv`,
      ['Name', 'Roll Number', 'Gender', 'Age', 'Class', 'Parent Phone', 'Alternative Phone', 'Status'],
      filtered.map((s) => [
        s.name,
        s.rollNumber || '',
        s.gender || '',
        s.age ?? '',
        s.className || s.classId,
        s.parentPhone || '',
        s.alternativePhone || '',
        s.isActive ? 'active' : 'inactive',
      ])
    )
  }

  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const handleTemplate = () => {
    exportToCsv(
      'student-import-template.csv',
      ['Name', 'Roll Number', 'Gender', 'Age', 'Class Name', 'Section', 'Parent Phone', 'Alternative Phone'],
      [
        ['Example Student', '001', 'male', '10', 'Class 1', 'A', '03XX-XXXXXXX', '03XX-YYYYYYY'],
        ['Another Student', '', 'female', '11', 'Class 1', 'B', '03XX-ZZZZZZZ', ''],
      ]
    )
  }

  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = []
    let row: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++ } else inQ = false
        } else cur += ch
      } else if (ch === '"') inQ = true
      else if (ch === ',') { row.push(cur); cur = '' }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++
        row.push(cur); cur = ''
        rows.push(row); row = []
      } else cur += ch
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
    return rows.filter((r) => r.some((c) => c.trim() !== ''))
  }

  // Normalise a header cell so "Roll No.", "roll_number", "Roll Number" all match.
  const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Map a CSV header row to column indices. Supports the new 8-column template
  // (with Age + Section) AND the older 6/7-column templates without headers.
  const buildColumnMap = (header: string[]) => {
    const idx: Record<string, number> = {}
    header.forEach((h, i) => {
      const k = normalizeHeader(h)
      if (!k) return
      if (k === 'name' || (k.includes('student') && k.includes('name'))) idx.name = i
      else if (k.includes('roll')) idx.roll = i
      else if (k.includes('gender') || k === 'sex') idx.gender = i
      else if (k === 'age') idx.age = i
      else if (k.includes('class')) idx.className = i
      else if (k.includes('section')) idx.section = i
      else if (k.includes('parent') && k.includes('phone')) idx.parentPhone = i
      else if (k.includes('alt')) idx.altPhone = i
      else if (k === 'phone' || k === 'phone1') idx.parentPhone = idx.parentPhone ?? i
    })
    return idx
  }

  const resetImport = () => {
    setImportRows([])
    setImportFileName('')
    setImportError('')
  }

  /**
   * Read the picked CSV, parse every row and analyse it: which class each row
   * maps to, which rows are ready, which rows would be skipped and why. Nothing
   * is written to the database here — the admin reviews the preview first.
   */
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError('')
    setSuccess('')
    setImportError('')
    setImportFileName(file.name)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) {
        setImportRows([])
        setImportError('This file looks empty. Download the template above and add at least one student.')
        setImportOpen(true)
        return
      }
      const header = rows[0].map((h) => (h || '').trim())
      const col = buildColumnMap(header)
      const hasHeader = !!col.name && Object.keys(col).length >= 2
      const fallback = { name: 0, roll: 1, gender: 2, age: 3, className: 4, section: 5, parentPhone: 6, altPhone: 7 }
      const use = hasHeader ? col : fallback
      const body = hasHeader ? rows.slice(1) : rows

      const classByName: Record<string, string> = {}
      classes.forEach((c) => {
        classByName[c.name.toLowerCase()] = c.id
        if (c.section) classByName[`${c.name} ${c.section}`.toLowerCase()] = c.id
      })

      const parsed = body
        .map((r) => r.map((c) => (c || '').trim()))
        .map((raw) => {
          const at = (k: keyof typeof use) => (use[k] !== undefined ? raw[use[k]] : undefined)
          const className = at('className') || ''
          const ageRaw = at('age')
          const ageNum = ageRaw !== undefined && ageRaw !== '' ? Number(ageRaw) : NaN
          const section = at('section') || ''
          const combined = section ? `${className} ${section}`.toLowerCase().trim() : ''
          const cid =
            (combined && classByName[combined]) ||
            (className && classByName[className.toLowerCase()]) ||
            ''
          return {
            name: at('name') || '',
            roll: at('roll') || '',
            gender: (at('gender') || '').toLowerCase(),
            age: (Number.isNaN(ageNum) ? '' : ageNum) as number | '',
            className,
            classId: cid,
            parentPhone: at('parentPhone') || '',
            altPhone: at('altPhone') || '',
          }
        })
        .filter((r) => r.name || r.className)
      setImportRows(parsed)
      setImportOpen(true)
    } catch (err: any) {
      setImportOpen(true)
      setImportError(err?.message || 'Could not read that file. Make sure it is a valid CSV.')
    }
  }

  // Rows that will actually be added (their class was recognised).
  const importReady = useMemo(() => importRows.filter((r) => r.name && r.classId), [importRows])
  const importSkipped = useMemo(() => importRows.filter((r) => !r.name || !r.classId), [importRows])

  /** Write the analysed rows. Only adds new students — never removes existing ones. */
  const confirmImport = async () => {
    if (importReady.length === 0) return
    setImporting(true)
    setError('')
    setSuccess('')
    try {
      const now = new Date().toISOString()
      const createdBy = user?.uid || ''
      const base = Date.now()
      let created = 0
      for (let idx = 0; idx < importReady.length; idx++) {
        const row = importReady[idx]
        const studentId = `student_${base}_${idx}`
        await rtdb.createStudent(studentId, {
          id: studentId,
          name: row.name,
          rollNumber: row.roll || getNextRollNumber(students, row.classId || null),
          gender: (row.gender === 'male' || row.gender === 'female' ? row.gender : undefined) as
            | 'male'
            | 'female'
            | undefined,
          age: row.age === '' ? undefined : row.age,
          className: row.className || '',
          classId: row.classId,
          parentPhone: row.parentPhone || '',
          alternativePhone: row.altPhone || '',
          isActive: true,
          createdAt: now,
          updatedAt: now,
          createdBy: createdBy || 'admin',
          createdByName: user?.name || 'Admin',
          createdByRole: user?.role || 'admin',
        })
        created++
      }
      setSuccess(
        `Imported ${created} student${created !== 1 ? 's' : ''}${
          importSkipped.length ? ` · ${importSkipped.length} row(s) skipped` : ''
        }.`
      )
      setImportOpen(false)
      resetImport()
    } catch (err: any) {
      setError(err.message || 'Failed to import CSV')
    } finally {
      setImporting(false)
    }
  }

  const resetForm = () => {
    setName('')
    setRollNumber('')
    setGender('')
    setAge('')
    setPhotoUrl('')
    setParentLanguage('')
    setClassId('')
    setParentPhone('')
    setAlternativePhone('')
    setSection('')
    setEditingId(null)
  }

  const startEdit = async (s: Student) => {
    setEditingId(s.id)
    setName(s.name)
    setRollNumber(s.rollNumber || '')
    setGender(s.gender || '')
    setAge(s.age ?? '')
    // Photos live in their own node; if this record no longer embeds one,
    // fetch it on demand so re-saving an untouched photo keeps it around.
    let photo = s.photoUrl || ''
    if (!isEmbeddedPhoto(s.photoUrl)) {
      photo = (await rtdb.getStudentPhoto(s.id)) || ''
    }
    setPhotoUrl(photo)
    setParentLanguage(s.parentLanguage || '')
    setClassId(s.classId)
    setParentPhone(s.parentPhone)
    setAlternativePhone(s.alternativePhone || '')
    setSection(s.section || '')
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const autoRoll = getNextRollNumber(students, classId)

  /** Roll number actually being saved (manual entry, otherwise the suggested one). */
  const effectiveRoll = rollNumber.trim() || autoRoll

  /** True when another active student in the same class already has this roll number. */
  const rollTaken = useMemo(() => {
    const candidate = effectiveRoll.toLowerCase()
    return (
      candidate !== '' &&
      students.some(
        (s) =>
          s.id !== editingId &&
          s.classId === classId &&
          String(s.rollNumber || '').toLowerCase() === candidate &&
          s.isActive !== false
      )
    )
  }, [students, editingId, effectiveRoll, classId])

  const sectionOptions = useMemo(
    () => Array.from(new Set(classes.map((c) => c.section).filter((s): s is string => Boolean(s)))) as string[],
    [classes]
  )

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId)
    setSection(classes.find((c) => c.id === nextClassId)?.section || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rollTaken) {
      setError(`Roll number "${effectiveRoll}" is already used in this class.`)
      return
    }

    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const cls = classes.find((c) => c.id === classId)
      const data = {
        name,
        rollNumber: effectiveRoll,
        gender: (gender as 'male' | 'female') || undefined,
        age: age === '' ? undefined : age,
        parentLanguage: (parentLanguage as 'Amharic' | 'Afaan Oromoo') || undefined,
        classId,
        className: cls?.name || '',
        section,
        parentPhone,
        alternativePhone,
        updatedAt: new Date().toISOString(),
      }
      if (editingId) {
        // Keep the (possibly large) photo OUT of the students node.
        await rtdb.setStudentPhoto(editingId, photoUrl)
        await rtdb.updateStudent(editingId, data)
        await rtdb.logAction({
          actorId: user?.uid,
          actorName: user?.name,
          action: 'update',
          entity: 'student',
          entityId: editingId,
          details: name,
        })
        setSuccess('Student updated successfully')
      } else {
        const studentId = `student_${Date.now()}`
        await rtdb.setStudentPhoto(studentId, photoUrl)
        await rtdb.createStudent(studentId, {
          id: studentId,
          ...data,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid || 'admin',
          createdByName: user?.name || 'Admin',
          createdByRole: user?.role || 'admin',
        })
        await rtdb.logAction({
          actorId: user?.uid,
          actorName: user?.name,
          action: 'create',
          entity: 'student',
          entityId: studentId,
          details: name,
        })
        setSuccess(`Student added successfully with Roll No ${autoRoll}`)
      }
      resetForm()
      // The shared store refresh passes through automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (s: Student) => {
    try {
      await rtdb.updateStudent(s.id, {
        isActive: !s.isActive,
        updatedAt: new Date().toISOString(),
      })
      // The store refresh passes through automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student')
    }
  }

  const handleDelete = async (s: Student) => {
    if (
      !confirm(
        `Permanently delete "${s.name}"?\n\nThis removes the record for good and cannot be undone.\n\n` +
          `Tip: use "Back up" instead to keep the student's data in the backup list.`
      )
    )
      return
    try {
      await rtdb.deleteStudent(s.id)
      await rtdb.logAction({
        actorId: user?.uid,
        actorName: user?.name,
        action: 'delete',
        entity: 'student',
        entityId: s.id,
        details: s.name,
      })
      if (editingId === s.id) resetForm()
      setSuccess('Student deleted')
      // The store refresh passes through automatically.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student')
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
        <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
        <p className="text-gray-600 mt-1">Register, edit and manage students</p>
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
            {editingId ? 'Edit or Move Student' : 'Add New Student'}
          </CardTitle>
          <CardDescription>
            {editingId
              ? 'Update the student details below. Choose another class to move the student to a different grade or section.'
              : 'Register a student - the roll number is assigned automatically per class'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Student Name</Label>
                <Input id="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
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
                <p className="text-xs text-gray-400">
                  Suggested: {autoRoll} — you can edit this to rearrange roll numbers.
                </p>
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
                <Label htmlFor="class">Class</Label>
                <select
                  id="class"
                  value={classId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  required
                >
                  <option value="">Select a class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.section ? ` • ${c.section}` : ''}
                      {c.grade ? ` (${c.grade})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="section">Section</Label>
                <select
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select section</option>
                  {sectionOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pPhone">Parent Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="pPhone" type="tel" placeholder="Parent phone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="altPhone">Alternative Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="altPhone"
                    type="tel"
                    placeholder="Alternative phone (optional)"
                    value={alternativePhone}
                    onChange={(e) => setAlternativePhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Student Photo</Label>
              <StudentPhotoCapture value={photoUrl} onChange={setPhotoUrl} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : editingId ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {editingId ? 'Save Changes / Move Student' : 'Add Student'}
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
      {/* Bulk CSV import — review before writing. Adds new students only. */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" /> Bulk Upload Students
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handleTemplate}>
                <Download className="h-4 w-4 mr-2" /> Template
              </Button>
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? 'Importing...' : 'Import CSV'}
              </Button>
            </div>
          </div>
          <CardDescription className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <span>
              CSV columns: <b>Name, Roll Number, Gender, Age, Class Name, Section, Parent Phone, Alternative Phone</b>.
              Roll numbers and blank ages are auto-filled. Imports only <b>add</b> students — existing data is never
              changed or removed. Re-uploading the same file creates duplicates, so check the preview first.
            </span>
          </CardDescription>
        </CardHeader>
        {importOpen && (
          <CardContent className="space-y-4">
            {importError ? (
              <Alert variant="destructive">
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-gray-700">
                    <FileSpreadsheet className="h-4 w-4 text-gray-400" /> {importFileName || 'file'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {importReady.length} ready
                  </span>
                  {importSkipped.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> {importSkipped.length} will be skipped
                    </span>
                  )}
                </div>
                {importRows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No rows found in this file.</p>
                ) : (
                  <div className="max-h-80 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                      <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Roll</th>
                          <th className="px-3 py-2 font-medium">Gender</th>
                          <th className="px-3 py-2 font-medium">Age</th>
                          <th className="px-3 py-2 font-medium">Class</th>
                          <th className="px-3 py-2 font-medium">Parent Phone</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((r, i) => {
                          const ok = !!r.name && !!r.classId
                          return (
                            <tr key={i} className={ok ? '' : 'bg-amber-50/60'}>
                              <td className="px-3 py-2 font-medium text-gray-900">{r.name || '—'}</td>
                              <td className="px-3 py-2">{r.roll || '(auto)'}</td>
                              <td className="px-3 py-2 capitalize">{r.gender || '—'}</td>
                              <td className="px-3 py-2">{r.age === '' ? '—' : r.age}</td>
                              <td className="px-3 py-2">{r.className || '—'}</td>
                              <td className="px-3 py-2">{r.parentPhone || '—'}</td>
                              <td className="px-3 py-2">
                                {ok ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    {!r.name ? 'No name' : 'Class not found'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {importReady.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {importReady.length} student{importReady.length !== 1 ? 's' : ''} will be added to the active list.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={confirmImport} disabled={importing || importReady.length === 0}>
                    {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {importing ? 'Importing...' : `Confirm Import (${importReady.length})`}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setImportOpen(false); resetImport() }} disabled={importing}>
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                    <Upload className="h-4 w-4 mr-2" /> Choose another file
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> {showInactive ? 'Backup / Inactive' : 'Student List'} (
              {filtered.length} / {showInactive ? inactiveStudents.length : activeStudents.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={showInactive ? 'default' : 'outline'}
                onClick={() => setShowInactive((v) => !v)}
                title="Show the backed-up (inactive) students. Their data is kept, not deleted."
              >
                {showInactive ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                Backup ({inactiveStudents.length})
              </Button>
              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                aria-label="Filter by section"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All Sections</option>
                {filterSectionOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, roll, phone, class or section (e.g. A)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {importing ? 'Importing...' : 'Bulk Upload'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCSV}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {search
                ? 'No students match your search.'
                : showInactive
                ? 'No backed-up students. Students you "Back up" appear here and can be restored.'
                : 'No students yet. Add your first student above.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Photo</th>
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Roll</th>
                    <th className="pb-3 pr-4 font-medium">Age</th>
                    <th className="pb-3 pr-4 font-medium">Class</th>
                    <th className="pb-3 pr-4 font-medium">Section</th>
                    <th className="pb-3 pr-4 font-medium">Contact</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
                    const cls = classes.find((c) => c.id === s.classId)
                    const sectionLabel = s.section || cls?.section || '—'
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(s)}
                            className="text-left font-medium text-gray-900 cursor-pointer hover:text-indigo-600 hover:underline"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="py-3 pr-4">{s.rollNumber || '—'}</td>
                        <td className="py-3 pr-4">{s.age ?? '—'}</td>
                        <td className="py-3 pr-4">{s.className || s.classId}</td>
                        <td className="py-3 pr-4">{sectionLabel}</td>
                      <td className="py-3 pr-4">
                        {s.parentPhone ? (
                          <a
                            href={`tel:${s.parentPhone}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 font-medium text-blue-700 transition hover:bg-blue-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> {s.parentPhone}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {s.alternativePhone && (
                          <a
                            href={`tel:${s.alternativePhone}`}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1 font-medium text-teal-700 transition hover:bg-teal-100"
                          >
                            <Phone className="h-3.5 w-3.5" /> Alt: {s.alternativePhone}
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {s.isActive ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" title="View all details" onClick={() => setViewingStudent(s)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => startEdit(s)} title="Edit student">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {s.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleStatus(s)}
                              title="Move to backup (data is kept, not deleted)"
                            >
                              Back up
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => toggleStatus(s)} title="Restore to the active list">
                              Restore
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(s)}
                            title="Permanently delete this student (cannot be undone) — use Back up to keep the data"
                          >
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

      {viewingStudent && (
        <StudentDetailCard
          student={viewingStudent}
          classes={classes}
          users={users}
          onClose={() => setViewingStudent(null)}
          onEdit={(s) => {
            setViewingStudent(null)
            startEdit(s)
          }}
        />
      )}
    </div>
  )
}
