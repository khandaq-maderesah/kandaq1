'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, ChevronRight as ChevronEnd, GraduationCap, Loader2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import type { Class, Student } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { StudentDetailCard } from '@/components/StudentDetailCard'
import { StudentAvatar } from '@/components/StudentAvatar'

const PER_PAGE = 10

export default function ClassesPage() {
  const t = useTranslations('adminClasses')
  const tc = useTranslations('common')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [section, setSection] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Class | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [studentsOfClass, setStudentsOfClass] = useState<Class | null>(null)
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)

  // Live updates via the shared store (the shell's bells already keep these
  // channels open, so this page adds no extra downloads).
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))
  const storeStudents = useLiveData<Student[]>('students', (emit) => rtdb.subscribeToStudents(emit))
  const classes = useMemo(() => storeClasses.data ?? [], [storeClasses.data])
  // Archived (deleted) students are not part of any class list.
  const students = useMemo(() => (storeStudents.data ?? []).filter((s) => s.isActive !== false), [storeStudents.data])
  const loading = !storeClasses.data

  const countByClass = useMemo(() => {
    const m: Record<string, number> = {}
    students.forEach((s) => {
      m[s.classId] = (m[s.classId] || 0) + 1
    })
    return m
  }, [students])

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === studentsOfClass?.id),
    [students, studentsOfClass]
  )

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setGrade('')
    setSection('')
    setAcademicYear('')
    setFormOpen(true)
  }

  const openEdit = (c: Class) => {
    setEditingId(c.id)
    setName(c.name)
    setGrade(c.grade || '')
    setSection(c.section || '')
    setAcademicYear(c.academicYear || '')
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        toast.success(t('toast.updated'))
      } else {
        const classId = `class_${Date.now()}`
        await rtdb.createClass(classId, {
          id: classId,
          ...data,
          isActive: true,
          createdAt: new Date().toISOString(),
          createdBy: 'admin',
        })
        toast.success(t('toast.created'))
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await rtdb.deleteClass(deleting.id)
      toast.success(t('toast.deleted', { name: deleting.name }))
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : tc('errors.generic'))
    } finally {
      setDeleteBusy(false)
    }
  }

  const deletingCount = deleting ? countByClass[deleting.id] || 0 : 0

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={openCreate}>
            <Plus /> {t('add')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Label htmlFor="class-search" className="sr-only">
            {t('searchLabel')}
          </Label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="class-search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground">{t('summary', { shown: filtered.length, total: classes.length })}</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        search ? (
          <EmptyState icon={Search} title={t('empty.search')} />
        ) : (
          <EmptyState
            icon={GraduationCap}
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
            {paginated.map((c) => {
              const count = countByClass[c.id] || 0
              return (
                <li key={c.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {c.name}
                        {c.section ? ` · ${c.section}` : ''}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {c.teacherName || t('unassigned')} · {c.academicYear}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label={t('editClass', { name: c.name })} onClick={() => openEdit(c)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={t('deleteClass', { name: c.name })}
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setStudentsOfClass(c)}>
                    <Users /> {t('studentCount', { count })}
                  </Button>
                </li>
              )
            })}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>{t('table.class')}</th>
                <th>{t('table.section')}</th>
                <th>{t('table.teacher')}</th>
                <th>{t('table.year')}</th>
                <th>{t('table.students')}</th>
                <th className="text-end">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => {
                const count = countByClass[c.id] || 0
                return (
                  <tr key={c.id}>
                    <td className="font-medium text-foreground">{c.name}</td>
                    <td>{c.section || '—'}</td>
                    <td>
                      {c.teacherName || <span className="text-muted-foreground">{t('unassigned')}</span>}
                    </td>
                    <td>{c.academicYear}</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStudentsOfClass(c)}
                        aria-label={t('viewStudents', { name: c.name })}
                      >
                        <Users /> {count}
                      </Button>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={t('editClass', { name: c.name })} onClick={() => openEdit(c)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={t('deleteClass', { name: c.name })}
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableContainer>

          <Pager page={page} totalPages={totalPages} total={filtered.length} onPage={setPage} />
        </>
      )}

      {/* Create / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{editingId ? t('form.editTitle') : t('form.createTitle')}</DialogTitle>
              <DialogDescription>{editingId ? t('form.editDescription') : t('form.createDescription')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="class-name">{t('form.name')}</Label>
                <Input id="class-name" placeholder={t('form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-grade">{t('form.grade')}</Label>
                <Input id="class-grade" placeholder={t('form.gradePlaceholder')} value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-section">{t('form.section')}</Label>
                <Input id="class-section" placeholder={t('form.sectionPlaceholder')} value={section} onChange={(e) => setSection(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-year">{t('form.year')}</Label>
                <Input
                  id="class-year"
                  placeholder={t('form.yearPlaceholder')}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {editingId ? tc('actions.saveChanges') : t('form.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title', { name: deleting?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('delete.description')}</DialogDescription>
          </DialogHeader>
          {deletingCount > 0 && (
            <Alert variant="warning">
              <AlertDescription>{t('delete.withStudents', { count: deletingCount })}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="animate-spin" />}
              {t('delete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Students of a class */}
      <Dialog open={!!studentsOfClass} onOpenChange={(o) => !o && setStudentsOfClass(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('studentsDialog.title', { name: studentsOfClass?.name ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('studentsDialog.meta', {
                year: studentsOfClass?.academicYear ?? '',
                section: studentsOfClass?.section || t('noSection'),
                teacher: studentsOfClass?.teacherName || t('unassigned'),
              })}
            </DialogDescription>
          </DialogHeader>
          {classStudents.length === 0 ? (
            <EmptyState icon={Users} title={t('studentsDialog.empty')} className="py-8" />
          ) : (
            <ul className="-mx-2 divide-y">
              {classStudents.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setViewingStudent(s)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-start transition-colors hover:bg-muted"
                  >
                    <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.rollNumber ? t('studentsDialog.roll', { roll: s.rollNumber }) : t('studentsDialog.noRoll')} ·{' '}
                        <span dir="ltr">{s.parentPhone || t('studentsDialog.noPhone')}</span>
                      </span>
                    </span>
                    <ChevronEnd className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {viewingStudent && (
        <StudentDetailCard student={viewingStudent} classes={classes} onClose={() => setViewingStudent(null)} />
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
