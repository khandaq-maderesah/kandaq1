'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { getNextRollNumber } from '@/lib/rollNumber'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import { PARENT_LANGUAGES, type ParentLanguage } from '@/lib/smsMessage'
import { isEmbeddedPhoto } from '@/hooks/useStudentPhoto'
import { useSchoolRequests } from '@/hooks/useRequestBadges'
import type { Student, Class, User } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, TableContainer } from '@/components/ui/page'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StudentPhotoCapture } from '@/components/StudentPhotoCapture'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { AdminArchiveDialog } from '@/components/requests/StudentChangeDialogs'

const PER_PAGE = 10

type ImportRow = {
  name: string
  roll: string
  gender: string
  age: number | ''
  className: string
  classId: string
  parentPhone: string
  altPhone: string
}

type ColumnKey = 'name' | 'roll' | 'gender' | 'age' | 'className' | 'section' | 'parentPhone' | 'altPhone'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      rows.push(row)
      row = []
    } else cur += ch
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Normalise a header cell so "Roll No.", "roll_number", "Roll Number" all match.
const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Map a CSV header row to column indices. Supports the 8-column template (in
 * English or in the current UI language) AND older templates.
 */
function buildColumnMap(header: string[], localized: Partial<Record<ColumnKey, string>>) {
  const idx: Partial<Record<ColumnKey, number>> = {}
  const localizedByText: Record<string, ColumnKey> = {}
  ;(Object.keys(localized) as ColumnKey[]).forEach((k) => {
    const label = localized[k]
    if (label) localizedByText[label.trim().toLowerCase()] = k
  })
  header.forEach((h, i) => {
    const exact = localizedByText[h.trim().toLowerCase()]
    if (exact) {
      if (idx[exact] === undefined) idx[exact] = i
      return
    }
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

export default function StudentsPage() {
  const t = useTranslations('adminStudents')
  const tc = useTranslations('common')
  const tr = useTranslations('requests')
  const { user, isAdmin } = useAuth()

  // Live updates via the shared store (same channels the shell's bells use, so
  // `students`/`classes`/`users` are still downloaded only once per screen).
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))
  const requests = useSchoolRequests(isAdmin)

  const allStudents = useMemo(() => storeStudents.data ?? [], [storeStudents.data])
  const loading = !storeStudents.data
  const classes = useMemo(() => storeClasses.data?.filter((c) => c.isActive) ?? [], [storeClasses.data])
  const users = useMemo(() => storeUsers.data ?? [], [storeUsers.data])

  // Archived (deleted) students live on /admin/students/deleted.
  const students = useMemo(() => allStudents.filter((s) => s.isActive !== false), [allStudents])
  const archivedCount = allStudents.length - students.length

  /** studentId -> number of pending change requests. */
  const pendingByStudent = useMemo(() => {
    const m: Record<string, number> = {}
    ;(requests ?? []).forEach((r) => {
      if (r.status === 'pending') m[r.studentId] = (m[r.studentId] || 0) + 1
    })
    return m
  }, [requests])
  const pendingTotal = useMemo(() => (requests ?? []).filter((r) => r.status === 'pending').length, [requests])

  const classById = useMemo(() => {
    const m: Record<string, Class> = {}
    classes.forEach((c) => {
      m[c.id] = c
    })
    return m
  }, [classes])

  // ---------------------------------------------------------------- filters
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [page, setPage] = useState(1)

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

  const sectionOf = (s: Student) => (s.section || classById[s.classId]?.section || '').trim()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sf = sectionFilter.trim().toLowerCase()
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false
      const cls = classById[s.classId]
      const sectionLabel = (s.section || cls?.section || '').trim()
      // Exact section filter (so "A" shows ONLY section A students)
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
  }, [students, search, classById, sectionFilter, classFilter])

  useEffect(() => {
    setPage(1)
  }, [search, sectionFilter, classFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const genderLabel = (g?: string) =>
    g === 'male' ? tc('gender.male') : g === 'female' ? tc('gender.female') : ''
  // Accepts the stored values (male/female), the translated labels used by the
  // export, and English initials (M/F).
  const parseGender = (raw?: string): string => {
    const v = (raw || '').trim().toLowerCase()
    if (!v) return ''
    if (v === tc('gender.male').toLowerCase()) return 'male'
    if (v === tc('gender.female').toLowerCase()) return 'female'
    if (v.startsWith('f')) return 'female'
    if (v.startsWith('m')) return 'male'
    return v
  }
  const languageLabel = (l?: string) => PARENT_LANGUAGES.find((x) => x.value === l)?.label ?? l ?? ''

  const handleExport = () => {
    exportToCsv(
      `students-${dateStamp()}.csv`,
      [
        t('csv.name'),
        t('csv.rollNumber'),
        t('csv.gender'),
        t('csv.age'),
        // Same label the importer expects, so an exported file can be imported again.
        t('csv.className'),
        t('csv.section'),
        t('csv.parentPhone'),
        t('csv.altPhone'),
        t('csv.parentLanguage'),
      ],
      filtered.map((s) => [
        s.name,
        s.rollNumber || '',
        genderLabel(s.gender),
        s.age ?? '',
        s.className || s.classId,
        sectionOf(s),
        s.parentPhone || '',
        s.alternativePhone || '',
        languageLabel(s.parentLanguage),
      ])
    )
  }

  // ---------------------------------------------------------------- CSV import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importError, setImportError] = useState('')

  const localizedColumns: Record<ColumnKey, string> = {
    name: t('csv.name'),
    roll: t('csv.rollNumber'),
    gender: t('csv.gender'),
    age: t('csv.age'),
    className: t('csv.className'),
    section: t('csv.section'),
    parentPhone: t('csv.parentPhone'),
    altPhone: t('csv.altPhone'),
  }

  const handleTemplate = () => {
    exportToCsv(
      'student-import-template.csv',
      [
        localizedColumns.name,
        localizedColumns.roll,
        localizedColumns.gender,
        localizedColumns.age,
        localizedColumns.className,
        localizedColumns.section,
        localizedColumns.parentPhone,
        localizedColumns.altPhone,
      ],
      [
        // Gender values stay 'male'/'female' — they are read back by the importer.
        [t('csv.exampleName1'), '001', 'male', '10', t('csv.exampleClass'), 'A', '09XX-XXXXXX', '09XX-YYYYYY'],
        [t('csv.exampleName2'), '', 'female', '11', t('csv.exampleClass'), 'B', '09XX-ZZZZZZ', ''],
      ]
    )
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
    setImportError('')
    setImportFileName(file.name)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) {
        setImportRows([])
        setImportError(t('importDialog.fileEmpty'))
        setImportOpen(true)
        return
      }
      const header = rows[0].map((h) => (h || '').trim())
      const col = buildColumnMap(header, localizedColumns)
      const hasHeader = col.name !== undefined && Object.keys(col).length >= 2
      const fallback: Record<ColumnKey, number> = {
        name: 0,
        roll: 1,
        gender: 2,
        age: 3,
        className: 4,
        section: 5,
        parentPhone: 6,
        altPhone: 7,
      }
      const use: Partial<Record<ColumnKey, number>> = hasHeader ? col : fallback
      const body = hasHeader ? rows.slice(1) : rows

      const classByName: Record<string, string> = {}
      classes.forEach((c) => {
        classByName[c.name.toLowerCase()] = c.id
        if (c.section) classByName[`${c.name} ${c.section}`.toLowerCase()] = c.id
      })

      const parsed = body
        .map((r) => r.map((c) => (c || '').trim()))
        .map((raw): ImportRow => {
          const at = (k: ColumnKey) => (use[k] !== undefined ? raw[use[k] as number] : undefined)
          const className = at('className') || ''
          const ageRaw = at('age')
          const ageNum = ageRaw !== undefined && ageRaw !== '' ? Number(ageRaw) : NaN
          const section = at('section') || ''
          const combined = section ? `${className} ${section}`.toLowerCase().trim() : ''
          const cid = (combined && classByName[combined]) || (className && classByName[className.toLowerCase()]) || ''
          return {
            name: at('name') || '',
            roll: at('roll') || '',
            gender: parseGender(at('gender')),
            age: Number.isNaN(ageNum) ? '' : ageNum,
            className,
            classId: cid,
            parentPhone: at('parentPhone') || '',
            altPhone: at('altPhone') || '',
          }
        })
        .filter((r) => r.name || r.className)
      setImportRows(parsed)
      setImportOpen(true)
    } catch {
      setImportRows([])
      setImportError(t('importDialog.fileUnreadable'))
      setImportOpen(true)
    }
  }

  // Rows that will actually be added (their class was recognised).
  const importReady = useMemo(() => importRows.filter((r) => r.name && r.classId), [importRows])
  const importSkipped = importRows.length - importReady.length

  /** Write the analysed rows. Only adds new students — never removes existing ones. */
  const confirmImport = async () => {
    if (importReady.length === 0) return
    setImporting(true)
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
          rollNumber: row.roll || getNextRollNumber(allStudents, row.classId || null),
          gender: row.gender === 'male' || row.gender === 'female' ? row.gender : undefined,
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
      toast.success(
        importSkipped
          ? t('toast.importedSkipped', { count: created, skipped: importSkipped })
          : t('toast.imported', { count: created })
      )
      setImportOpen(false)
      resetImport()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc('errors.generic'))
    } finally {
      setImporting(false)
    }
  }

  // ---------------------------------------------------------------- create / edit
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [gender, setGender] = useState('')
  const [age, setAge] = useState<number | ''>('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [parentLanguage, setParentLanguage] = useState<ParentLanguage | ''>('')
  const [classId, setClassId] = useState('')
  const [section, setSection] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [alternativePhone, setAlternativePhone] = useState('')
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setName('')
    setRollNumber('')
    setGender('')
    setAge('')
    setPhotoUrl('')
    setParentLanguage('')
    setClassId(classFilter)
    setSection(classById[classFilter]?.section || '')
    setParentPhone('')
    setAlternativePhone('')
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const startEdit = async (s: Student) => {
    setEditingId(s.id)
    setName(s.name)
    setRollNumber(s.rollNumber || '')
    setGender(s.gender || '')
    setAge(s.age ?? '')
    setParentLanguage(s.parentLanguage || '')
    setClassId(s.classId)
    setParentPhone(s.parentPhone)
    setAlternativePhone(s.alternativePhone || '')
    setSection(s.section || '')
    setPhotoUrl(isEmbeddedPhoto(s.photoUrl) ? s.photoUrl || '' : '')
    setFormOpen(true)
    // Photos live in their own node; if this record no longer embeds one,
    // fetch it on demand so re-saving an untouched photo keeps it around.
    if (!isEmbeddedPhoto(s.photoUrl)) {
      const photo = (await rtdb.getStudentPhoto(s.id)) || ''
      setPhotoUrl((curr) => curr || photo)
    }
  }

  const autoRoll = getNextRollNumber(allStudents, classId)
  /** Roll number actually being saved (manual entry, otherwise the suggested one). */
  const effectiveRoll = rollNumber.trim() || autoRoll

  /** True when another active student in the same class already has this roll number. */
  const rollTaken = useMemo(() => {
    const candidate = effectiveRoll.toLowerCase()
    return (
      candidate !== '' &&
      students.some(
        (s) => s.id !== editingId && s.classId === classId && String(s.rollNumber || '').toLowerCase() === candidate
      )
    )
  }, [students, editingId, effectiveRoll, classId])

  const sectionOptions = useMemo(
    () => Array.from(new Set(classes.map((c) => c.section).filter((s): s is string => Boolean(s)))),
    [classes]
  )

  const handleClassChange = (nextClassId: string) => {
    setClassId(nextClassId)
    setSection(classById[nextClassId]?.section || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rollTaken) return
    setSaving(true)
    try {
      const cls = classById[classId]
      const data = {
        name,
        rollNumber: effectiveRoll,
        gender: (gender as 'male' | 'female') || undefined,
        age: age === '' ? undefined : age,
        parentLanguage: parentLanguage || undefined,
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
        toast.success(t('toast.updated', { name }))
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
        toast.success(t('toast.created', { name, roll: effectiveRoll }))
      }
      setFormOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------- view / delete
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
  const [archiving, setArchiving] = useState<Student | null>(null)

  const pendingBadge = (s: Student) =>
    pendingByStudent[s.id] ? (
      <Link href="/admin/requests" title={t('row.pendingTitle')} className="inline-flex">
        <Badge variant="warning">
          <Clock /> {tr('teacher.pendingBadge')}
        </Badge>
      </Link>
    ) : null

  const renderActions = (s: Student) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('row.more', { name: s.name })}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setViewingStudent(s)}>
          <Eye /> {t('row.view')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => startEdit(s)}>
          <Pencil /> {t('row.edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setArchiving(s)}
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
        >
          <Trash2 /> {t('row.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const hasFilters = !!(search || sectionFilter || classFilter)

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Link
              href="/admin/students/deleted"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <Archive className="h-4 w-4" />
              {tr('deleted.link')}
              <Badge variant="secondary" aria-label={t('deletedCount', { count: archivedCount })}>
                {archivedCount}
              </Badge>
            </Link>
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download /> {tc('actions.exportCsv')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={importing}>
                  {importing ? <Loader2 className="animate-spin" /> : <Upload />}
                  {importing ? t('importing') : t('importMenu')}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <Upload /> {t('import')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleTemplate}>
                  <FileSpreadsheet /> {t('downloadTemplate')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openCreate}>
              <Plus /> {t('add')}
            </Button>
          </>
        }
      />
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />

      {pendingTotal > 0 && (
        <Alert variant="warning" className="mb-4">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t('pendingRequestsLink', { count: pendingTotal })}
            </span>
            <Link href="/admin/requests" className="text-sm font-medium underline-offset-4 hover:underline">
              {tr('admin.title')}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Label htmlFor="student-search" className="sr-only">
            {t('toolbar.searchLabel')}
          </Label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="student-search"
            type="search"
            placeholder={t('toolbar.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <div className="lg:w-48">
            <Label htmlFor="student-class-filter" className="sr-only">
              {t('toolbar.classFilter')}
            </Label>
            <Select id="student-class-filter" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">{t('toolbar.allClasses')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.section ? `${c.name} · ${c.section}` : c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="lg:w-40">
            <Label htmlFor="student-section-filter" className="sr-only">
              {t('toolbar.sectionFilter')}
            </Label>
            <Select id="student-section-filter" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
              <option value="">{t('toolbar.allSections')}</option>
              {filterSectionOptions.map((sec) => (
                <option key={sec} value={sec}>
                  {t('toolbar.sectionOption', { section: sec })}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground lg:ms-auto">
            {t('toolbar.summary', { shown: filtered.length, total: students.length })}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={Search} title={t('empty.search')} />
        ) : (
          <EmptyState
            icon={Users}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <Button onClick={openCreate}>
                <Plus /> {t('add')}
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {paginated.map((s) => {
              const sectionLabel = sectionOf(s)
              return (
                <li key={s.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setViewingStudent(s)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-start"
                    >
                      <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="md" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{s.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {s.className || s.classId}
                          {sectionLabel ? ` · ${sectionLabel}` : ''}
                          {' · '}
                          {s.rollNumber ? t('row.roll', { roll: s.rollNumber }) : t('row.noRoll')}
                        </span>
                      </span>
                    </button>
                    {renderActions(s)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {s.parentPhone && (
                      <a
                        href={`tel:${s.parentPhone}`}
                        dir="ltr"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-sm font-medium text-foreground"
                      >
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {s.parentPhone}
                      </a>
                    )}
                    {pendingBadge(s)}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>{t('table.student')}</th>
                <th>{t('table.roll')}</th>
                <th>{t('table.age')}</th>
                <th>{t('table.class')}</th>
                <th>{t('table.section')}</th>
                <th>{t('table.contact')}</th>
                <th className="text-end">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setViewingStudent(s)}
                          className="text-start font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {s.name}
                        </button>
                        {pendingByStudent[s.id] ? <div className="mt-1">{pendingBadge(s)}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="tabular-nums">{s.rollNumber || '—'}</td>
                  <td className="tabular-nums">{s.age ?? '—'}</td>
                  <td>{s.className || s.classId}</td>
                  <td>{sectionOf(s) || '—'}</td>
                  <td>
                    {s.parentPhone ? (
                      <a
                        href={`tel:${s.parentPhone}`}
                        dir="ltr"
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" /> {s.parentPhone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {s.alternativePhone && (
                      <a
                        href={`tel:${s.alternativePhone}`}
                        className="mt-0.5 block text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        {t('row.alt', { phone: s.alternativePhone })}
                      </a>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-end">{renderActions(s)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableContainer>

          <Pager page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        </>
      )}

      {/* Create / edit / move */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) resetForm()
        }}
      >
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editingId ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
              <DialogDescription>{editingId ? t('form.editDescription') : t('form.createDescription')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="st-name">{t('form.name')}</Label>
                <Input id="st-name" placeholder={t('form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-class">{t('form.class')}</Label>
                <Select id="st-class" value={classId} onChange={(e) => handleClassChange(e.target.value)} required>
                  <option value="">{t('form.classPlaceholder')}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.section ? ` · ${c.section}` : ''}
                      {c.grade ? ` (${c.grade})` : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-section">{t('form.section')}</Label>
                <Select id="st-section" value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">{t('form.sectionPlaceholder')}</option>
                  {sectionOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-roll">{t('form.rollNumber')}</Label>
                <Input
                  id="st-roll"
                  placeholder={autoRoll}
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  aria-invalid={rollTaken}
                  aria-describedby="st-roll-hint"
                />
                <p id="st-roll-hint" className={rollTaken ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                  {rollTaken ? t('form.rollTaken', { roll: effectiveRoll }) : t('form.rollSuggested', { roll: autoRoll })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-gender">{t('form.gender')}</Label>
                <Select id="st-gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">{t('form.genderPlaceholder')}</option>
                  <option value="male">{tc('gender.male')}</option>
                  <option value="female">{tc('gender.female')}</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-age">{t('form.age')}</Label>
                <Input
                  id="st-age"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  placeholder={t('form.agePlaceholder')}
                  value={age === '' ? '' : age}
                  onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-lang">{t('form.parentLanguage')}</Label>
                <Select
                  id="st-lang"
                  value={parentLanguage}
                  onChange={(e) => setParentLanguage(e.target.value as ParentLanguage | '')}
                >
                  <option value="">{t('form.parentLanguagePlaceholder')}</option>
                  {PARENT_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-phone">{t('form.parentPhone')}</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="st-phone"
                    type="tel"
                    dir="ltr"
                    placeholder={t('form.parentPhonePlaceholder')}
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="ps-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-alt">{t('form.altPhone')}</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="st-alt"
                    type="tel"
                    dir="ltr"
                    placeholder={t('form.altPhonePlaceholder')}
                    value={alternativePhone}
                    onChange={(e) => setAlternativePhone(e.target.value)}
                    className="ps-9"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('form.photo')}</p>
              <StudentPhotoCapture value={photoUrl} onChange={setPhotoUrl} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving || rollTaken}>
                {saving && <Loader2 className="animate-spin" />}
                {editingId ? t('form.save') : t('form.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CSV import preview */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          if (importing) return
          setImportOpen(o)
          if (!o) resetImport()
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('importDialog.title')}</DialogTitle>
            <DialogDescription>{t('importDialog.description')}</DialogDescription>
          </DialogHeader>
          {importError ? (
            <Alert variant="destructive">
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{importFileName}</span>
                </span>
                <Badge variant="success">
                  <CheckCircle2 /> {t('importDialog.ready', { count: importReady.length })}
                </Badge>
                {importSkipped > 0 && (
                  <Badge variant="warning">
                    <AlertTriangle /> {t('importDialog.skipped', { count: importSkipped })}
                  </Badge>
                )}
              </div>
              {importRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('importDialog.noRows')}</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-xl border">
                  <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:whitespace-nowrap [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_tbody_tr]:border-t">
                    <thead className="sticky top-0">
                      <tr>
                        <th>{t('importDialog.table.name')}</th>
                        <th>{t('importDialog.table.roll')}</th>
                        <th>{t('importDialog.table.gender')}</th>
                        <th>{t('importDialog.table.age')}</th>
                        <th>{t('importDialog.table.class')}</th>
                        <th>{t('importDialog.table.phone')}</th>
                        <th>{t('importDialog.table.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, i) => {
                        const ok = !!r.name && !!r.classId
                        return (
                          <tr key={i} className={ok ? '' : 'bg-warning/5'}>
                            <td className="font-medium text-foreground">{r.name || '—'}</td>
                            <td>{r.roll || <span className="text-muted-foreground">{t('importDialog.autoRoll')}</span>}</td>
                            <td>{genderLabel(r.gender) || r.gender || '—'}</td>
                            <td>{r.age === '' ? '—' : r.age}</td>
                            <td>{r.className || '—'}</td>
                            <td dir="ltr" className="text-start">
                              {r.parentPhone || '—'}
                            </td>
                            <td>
                              {ok ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> {t('importDialog.statusReady')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  {!r.name ? t('importDialog.statusNoName') : t('importDialog.statusNoClass')}
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
                <p className="text-xs text-muted-foreground">{t('importDialog.willAdd', { count: importReady.length })}</p>
              )}
            </>
          )}
          <p className="text-xs text-muted-foreground">{t('importDialog.columns')}</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload /> {t('importDialog.chooseAnother')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportOpen(false)
                resetImport()
              }}
              disabled={importing}
            >
              {tc('actions.cancel')}
            </Button>
            {!importError && (
              <Button type="button" onClick={confirmImport} disabled={importing || importReady.length === 0}>
                {importing ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {t('importDialog.confirm', { count: importReady.length })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete = archive with a reason (restorable from Deleted students) */}
      <AdminArchiveDialog
        student={archiving}
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        onDone={() => {
          if (archiving && editingId === archiving.id) {
            setFormOpen(false)
            resetForm()
          }
          setArchiving(null)
        }}
      />

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

function Pager({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  onPage: (p: number) => void
}) {
  const tc = useTranslations('common')
  if (totalPages <= 1) return null
  const from = (page - 1) * PER_PAGE + 1
  const to = Math.min(page * PER_PAGE, total)
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">{tc('pagination.showing', { from, to, total })}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="rtl:rotate-180" /> {tc('actions.previous')}
        </Button>
        <span className="text-sm text-muted-foreground">{tc('pagination.page', { page, pages: totalPages })}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          {tc('actions.next')} <ChevronRight className="rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
