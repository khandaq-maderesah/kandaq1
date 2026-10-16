'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowRightLeft, Clock, MoreVertical, Phone, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { useLiveData } from '@/lib/dataStore'
import { useMyRequests } from '@/hooks/useRequestBadges'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { badgeVariants } from '@/components/ui/badge'
import { EmptyState, PageHeader, TableContainer } from '@/components/ui/page'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RequestDeleteDialog, RequestTransferDialog } from '@/components/requests/StudentChangeDialogs'
import { StudentAvatar } from '@/components/StudentAvatar'
import { StudentDetailCard } from '@/components/StudentDetailCard'
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

function PhoneLink({ phone }: { phone?: string }) {
  const t = useTranslations('teacherStudents')
  if (!phone) return <span className="text-muted-foreground">–</span>
  return (
    <a
      href={`tel:${phone}`}
      aria-label={t('callNumber', { phone })}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-accent"
    >
      <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span dir="ltr">{phone}</span>
    </a>
  )
}

export default function TeacherStudentsPage() {
  const t = useTranslations('teacherStudents')
  const tAdd = useTranslations('teacherClasses')
  const tc = useTranslations('common')
  const { user } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState('')
  const [search, setSearch] = useState('')
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null)
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
        // Server-side filtered: only the students of the teacher's own classes.
        const myStudents = (await Promise.all(myClasses.map((c) => rtdb.getStudentsByClass(c.id)))).flat()
        setClasses(myClasses)
        setStudents(myStudents)
        setClassId((cur) => cur || (myClasses.length > 0 ? myClasses[0].id : ''))
      } catch {
        toast.error(t('toast.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      .filter((s) => s.isActive !== false)
      .filter((s) => !classId || s.classId === classId)
      .filter((s) => {
        if (!q) return true
        const cls = classById[s.classId]
        return (
          s.name.toLowerCase().includes(q) ||
          (s.rollNumber || '').toLowerCase().includes(q) ||
          (s.parentPhone || '').toLowerCase().includes(q) ||
          (cls?.name || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }))
  }, [students, classId, search, classById])

  const classLabel = (s: Student) => {
    const cls = classById[s.classId]
    const name = cls?.name || s.className || '–'
    return cls?.section ? `${name} · ${cls.section}` : name
  }

  const actions = (s: Student) => {
    const pending = pendingIds.has(s.id)
    return (
      <div className="flex items-center justify-end gap-2">
        {pending && <PendingBadge />}
        <StudentRequestMenu
          pending={pending}
          onDelete={() => setDeleteTarget(s)}
          onTransfer={() => setTransferTarget(s)}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Link href="/teacher/classes#student-form" className={buttonVariants()}>
            <UserPlus /> {tAdd('form.submitAdd')}
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-[1fr_16rem] sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="stu-search">{t('filters.search')}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="stu-search"
              type="search"
              placeholder={t('filters.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stu-class">{t('filters.class')}</Label>
          <Select id="stu-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t('filters.allClasses')}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.section ? `${c.name} · ${c.section}` : c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState icon={Users} title={t('empty.noClasses')} description={t('empty.noClassesHint')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? tc('empty.noResults') : t('empty.noStudents')}
          description={search ? undefined : t('empty.noStudentsHint')}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{tc('count.students', { count: filtered.length })}</p>

          {/* Mobile: stacked cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((s) => (
              <li key={s.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setViewingStudent(s)}
                      aria-label={t('viewDetails', { name: s.name })}
                      className="block max-w-full truncate text-start font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {s.name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {[
                        s.rollNumber ? t('card.roll', { roll: s.rollNumber }) : null,
                        s.age != null ? t('card.age', { age: s.age }) : null,
                        s.gender ? tc(`gender.${s.gender}`) : null,
                        classLabel(s),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <StudentRequestMenu
                    pending={pendingIds.has(s.id)}
                    onDelete={() => setDeleteTarget(s)}
                    onTransfer={() => setTransferTarget(s)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.parentPhone && <PhoneLink phone={s.parentPhone} />}
                  {s.alternativePhone && <PhoneLink phone={s.alternativePhone} />}
                  {pendingIds.has(s.id) && <PendingBadge />}
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">{t('table.photo')}</span>
                </th>
                <th>{t('table.student')}</th>
                <th>{t('table.roll')}</th>
                <th>{t('table.age')}</th>
                <th>{t('table.class')}</th>
                <th>{t('table.gender')}</th>
                <th>{t('table.parentPhone')}</th>
                <th>{t('table.alternativePhone')}</th>
                <th className="text-end">
                  <span className="sr-only">{t('table.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="w-12">
                    <StudentAvatar photoUrl={s.photoUrl} studentId={s.id} name={s.name} size="sm" />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setViewingStudent(s)}
                      className="text-start font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="tabular-nums">{s.rollNumber || '–'}</td>
                  <td className="tabular-nums">{s.age ?? '–'}</td>
                  <td className="text-muted-foreground">{classLabel(s)}</td>
                  <td>{s.gender ? tc(`gender.${s.gender}`) : '–'}</td>
                  <td>
                    <PhoneLink phone={s.parentPhone} />
                  </td>
                  <td>
                    <PhoneLink phone={s.alternativePhone} />
                  </td>
                  <td className="text-end">{actions(s)}</td>
                </tr>
              ))}
            </tbody>
          </TableContainer>
        </>
      )}

      {viewingStudent && (
        <StudentDetailCard student={viewingStudent} classes={classes} onClose={() => setViewingStudent(null)} />
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
