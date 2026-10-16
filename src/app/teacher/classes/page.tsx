'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ArrowRightLeft,
  Clock,
  GraduationCap,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { useMyRequests } from '@/hooks/useRequestBadges'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { badgeVariants } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/page'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RequestDeleteDialog, RequestTransferDialog } from '@/components/requests/StudentChangeDialogs'
import { StudentPhotoCapture } from '@/components/StudentPhotoCapture'
import { StudentAvatar } from '@/components/StudentAvatar'
import { isEmbeddedPhoto } from '@/hooks/useStudentPhoto'
import { getNextRollNumber } from '@/lib/rollNumber'
import { PARENT_LANGUAGES } from '@/lib/smsMessage'
import { cn } from '@/lib/utils'
import type { Class, Student } from '@/types'

/** "Request pending" pill linking to the teacher's requests page. */
function PendingBadge() {
  const tr = useTranslations('requests')
  return (
    <Link href="/teacher/requests" className={badgeVariants({ variant: 'warning' })}>
      <Clock />
      {tr('teacher.pendingBadge')}
    </Link>
  )
}

/** Actions menu: teachers ask an admin to delete or move a student. */
function StudentRequestMenu({
  pending,
  onDelete,
  onTransfer,
}: {
  pending: boolean
  onDelete: () => void
  onTransfer: () => void
}) {
  const tr = useTranslations('requests')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tr('actions.moreActions')}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={pending} onSelect={onTransfer}>
          <ArrowRightLeft />
          {tr('actions.requestTransfer')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={onDelete}
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
        >
          <Trash2 />
          {tr('actions.requestDelete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function TeacherClassesPage() {
  const t = useTranslations('teacherClasses')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState('')

  const [selectedClassId, setSelectedClassId] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [alternativePhone, setAlternativePhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [age, setAge] = useState<number | ''>('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [parentLanguage, setParentLanguage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [transferTarget, setTransferTarget] = useState<Student | null>(null)

  const allClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit)).data
  const myRequests = useMyRequests(user?.uid)
  const pendingIds = useMemo(
    () => new Set((myRequests ?? []).filter((r) => r.status === 'pending').map((r) => r.studentId)),
    [myRequests]
  )

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const classList = await rtdb.getAllClasses()
        const myClasses = classList.filter((c) => c.teacherId === user.uid && c.isActive !== false)
        const regOpen = await rtdb.getRegistrationOpen()
        // Server-side filtered: only the students of the teacher's own classes
        // (NOT the whole school, which used to include every student photo).
        const myStudents = (await Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id)))).flat()
        setClasses(myClasses)
        setStudents(myStudents)
        setRegistrationOpen(regOpen)
        if (myClasses.length > 0) {
          setSelectedClassId((current) => current || myClasses[0].id)
        }
      } catch {
        toast.error(t('toast.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // "Add student" buttons on other pages link to #student-form: open the form ready to type.
  useEffect(() => {
    if (loading || window.location.hash !== '#student-form') return
    focusAddForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Archived (deleted) students never appear in the teacher area.
  const activeStudents = useMemo(() => students.filter((s) => s.isActive !== false), [students])

  const autoRoll = getNextRollNumber(students, selectedClassId)

  /** The roll number to assign: manual entry when edited, else the suggested one. */
  const effectiveRoll = rollNumber.trim() || autoRoll

  /** True if this roll number is already used by ANOTHER student in the same class. */
  const rollTaken = activeStudents.some(
    (s) =>
      s.classId === selectedClassId &&
      s.id !== editingId &&
      String(s.rollNumber || '').trim().toLowerCase() === effectiveRoll.toLowerCase()
  )

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const classLabel = (c?: Class) => (c ? (c.section ? `${c.name} · ${c.section}` : c.name) : '')

  const classStudents = useMemo(
    () =>
      activeStudents
        .filter((s) => s.classId === selectedClassId)
        .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true })),
    [activeStudents, selectedClassId]
  )

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
    setEditingName('')
    setFormError('')
  }

  /** Scrolls to the add-student form (leaving edit mode) and focuses the name field. */
  const focusAddForm = () => {
    if (editingId) resetRegisterForm()
    requestAnimationFrame(() => {
      document.getElementById('student-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById('name')?.focus({ preventScroll: true })
    })
  }

  const reloadStudents = async () => {
    setStudents((await Promise.all(classes.map((c) => rtdb.getStudentsByClass(c.id)))).flat())
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !selectedClassId) return
    if (!editingId && !registrationOpen) {
      setFormError(t('toast.registrationClosed'))
      return
    }
    // Never allow a duplicate roll number within the same class.
    if (rollTaken) {
      setFormError(t('toast.rollTaken', { roll: effectiveRoll }))
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const studentName = name.trim()
      const fields = {
        name: studentName,
        rollNumber: effectiveRoll,
        gender: (gender as 'male' | 'female') || undefined,
        age: age === '' ? undefined : age,
        parentLanguage: (parentLanguage as Student['parentLanguage']) || undefined,
        parentPhone,
        alternativePhone,
        updatedAt: new Date().toISOString(),
      }
      if (editingId) {
        // Partial update: only the edited fields change. The class is never
        // written here — moving a student needs an approved request.
        await rtdb.setStudentPhoto(editingId, photoUrl)
        await rtdb.updateStudent(editingId, fields)
        await rtdb.logAction({
          actorId: user.uid,
          actorName: user.name,
          action: 'update',
          entity: 'student',
          entityId: editingId,
          details: studentName,
        })
        resetRegisterForm()
        toast.success(t('toast.updated', { name: studentName }))
      } else {
        const studentId = 'student_' + Date.now()
        await rtdb.createStudent(studentId, {
          id: studentId,
          ...fields,
          classId: selectedClassId,
          className: selectedClass?.name || '',
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
        toast.success(t('toast.added', { name: studentName, roll: fields.rollNumber }))
      }
      await reloadStudents()
    } catch {
      toast.error(t('toast.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const startEditStudent = async (s: Student) => {
    setSelectedClassId(s.classId)
    setEditingId(s.id)
    setEditingName(s.name)
    setName(s.name)
    setRollNumber(s.rollNumber || '')
    setGender(s.gender || '')
    setAge(s.age ?? '')
    setParentLanguage(s.parentLanguage || '')
    setParentPhone(s.parentPhone)
    setAlternativePhone(s.alternativePhone || '')
    setFormError('')
    // Photos live in their own node; fetch on demand for non-embedded records.
    let photo = s.photoUrl || ''
    if (!isEmbeddedPhoto(s.photoUrl)) {
      photo = (await rtdb.getStudentPhoto(s.id)) || ''
    }
    setPhotoUrl(photo)
    document.getElementById('student-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    )
  }

  if (classes.length === 0) {
    return (
      <div>
        <PageHeader title={t('title')} description={t('description')} />
        <EmptyState icon={GraduationCap} title={t('empty.noClasses')} description={t('empty.noClassesHint')} />
      </div>
    )
  }

  const editing = !!editingId
  const formDisabled = !editing && !registrationOpen

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={focusAddForm} disabled={formDisabled}>
            <UserPlus /> {t('form.submitAdd')}
          </Button>
        }
      />

      {/* Class picker cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => {
          const count = activeStudents.filter((s) => s.classId === c.id).length
          const selected = c.id === selectedClassId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (editing) resetRegisterForm()
                setSelectedClassId(c.id)
              }}
              aria-pressed={selected}
              aria-label={t('classCard.select', { name: classLabel(c) })}
              className={cn(
                'flex items-start gap-4 rounded-xl border bg-card p-5 text-start shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected && 'border-primary ring-1 ring-primary'
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-foreground">{c.name}</p>
                  {selected && (
                    <span className={badgeVariants({ variant: 'default' })}>{t('classCard.selected')}</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[
                    c.grade ? t('classCard.grade', { grade: c.grade }) : null,
                    c.section ? t('classCard.section', { section: c.section }) : null,
                    c.academicYear || null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {tc('count.students', { count })}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {!registrationOpen && !editing && (
        <Alert variant="warning" className="mt-6">
          <Lock className="h-4 w-4" />
          <AlertDescription>{t('registrationClosed')}</AlertDescription>
        </Alert>
      )}

      {selectedClassId && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-5">
          {/* Add / edit form */}
          <section id="student-form" className="scroll-mt-20 rounded-xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-3">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {editing ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  {editing ? t('form.editTitle', { name: editingName }) : t('form.addTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {editing ? t('form.editDescription') : t('form.addDescription')}
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <fieldset disabled={formDisabled || saving} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="cls">{t('form.class')}</Label>
                  {editing ? (
                    <>
                      <div className="relative">
                        <Input id="cls" value={classLabel(selectedClass)} readOnly disabled className="pe-9" />
                        <Lock
                          className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('form.classLocked')}</p>
                    </>
                  ) : (
                    <Select id="cls" value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} required>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {classLabel(c)}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">{t('form.name')}</Label>
                  <Input
                    id="name"
                    placeholder={t('form.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">{t('form.gender')}</Label>
                  <Select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">{t('form.genderPlaceholder')}</option>
                    <option value="male">{tc('gender.male')}</option>
                    <option value="female">{tc('gender.female')}</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">{t('form.age')}</Label>
                  <Input
                    id="age"
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
                  <Label htmlFor="parentLanguage">{t('form.parentLanguage')}</Label>
                  <Select id="parentLanguage" value={parentLanguage} onChange={(e) => setParentLanguage(e.target.value)}>
                    <option value="">{t('form.parentLanguagePlaceholder')}</option>
                    {PARENT_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rollNumber">{t('form.rollNumber')}</Label>
                  <Input
                    id="rollNumber"
                    placeholder={autoRoll}
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    aria-invalid={rollTaken}
                    aria-describedby="roll-hint"
                  />
                  <p
                    id="roll-hint"
                    className={cn('text-xs', rollTaken ? 'font-medium text-destructive' : 'text-muted-foreground')}
                  >
                    {rollTaken ? t('form.rollTaken') : t('form.rollHint', { roll: autoRoll })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pPhone">{t('form.parentPhone')}</Label>
                  <Input
                    id="pPhone"
                    type="tel"
                    dir="ltr"
                    placeholder={t('form.phonePlaceholder')}
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="altPhone">{t('form.alternativePhone')}</Label>
                  <Input
                    id="altPhone"
                    type="tel"
                    dir="ltr"
                    placeholder={t('form.phonePlaceholder')}
                    value={alternativePhone}
                    onChange={(e) => setAlternativePhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>{t('form.photo')}</Label>
                  <StudentPhotoCapture value={photoUrl} onChange={setPhotoUrl} />
                </div>
              </fieldset>

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {editing && (
                  <Button type="button" variant="outline" onClick={resetRegisterForm} disabled={saving}>
                    <X /> {t('form.cancelEdit')}
                  </Button>
                )}
                <Button type="submit" disabled={saving || formDisabled}>
                  {saving ? <Loader2 className="animate-spin" /> : editing ? <Pencil /> : <UserPlus />}
                  {editing ? t('form.submitEdit') : t('form.submitAdd')}
                </Button>
              </div>
            </form>
          </section>

          {/* Students of the selected class */}
          <section className="rounded-xl border bg-card shadow-sm lg:col-span-2">
            <div className="border-b p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                {t('list.title', { name: classLabel(selectedClass) })}
                <span className={badgeVariants({ variant: 'secondary' })}>{classStudents.length}</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('list.description')}</p>
            </div>
            {classStudents.length === 0 ? (
              <EmptyState
                className="m-5 border-dashed"
                icon={Users}
                title={t('list.empty')}
                description={t('list.emptyHint')}
              />
            ) : (
              <ul className="divide-y">
                {classStudents.map((s) => {
                  const pending = pendingIds.has(s.id)
                  return (
                    <li
                      key={s.id}
                      className={cn('flex items-center gap-3 px-4 py-3', s.id === editingId && 'bg-accent/50')}
                    >
                      <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            s.rollNumber ? t('list.roll', { roll: s.rollNumber }) : null,
                            s.age ? t('list.age', { age: s.age }) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {pending && (
                          <div className="mt-1">
                            <PendingBadge />
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => startEditStudent(s)}
                        aria-label={t('list.edit', { name: s.name })}
                        title={t('list.edit', { name: s.name })}
                      >
                        <Pencil />
                      </Button>
                      <StudentRequestMenu
                        pending={pending}
                        onDelete={() => setDeleteTarget(s)}
                        onTransfer={() => setTransferTarget(s)}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <RequestDeleteDialog
        student={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
      <RequestTransferDialog
        student={transferTarget}
        classes={(allClasses ?? []).filter((c) => c.isActive !== false)}
        open={!!transferTarget}
        onOpenChange={(open) => !open && setTransferTarget(null)}
      />
    </div>
  )
}
