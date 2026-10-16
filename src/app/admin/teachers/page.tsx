'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'
import type { User, Class } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
import { apiErrorKey, TranslatedError } from '@/lib/apiErrors'

const PER_PAGE = 10

type StaffRole = 'admin' | 'teacher'

const classLabel = (c: Class) => `${c.name}${c.section ? ` · ${c.section}` : ''}${c.grade ? ` (${c.grade})` : ''}`

/** Checkbox list of classes (create form + assignment dialog). */
function ClassChecklist({
  classes,
  selected,
  onChange,
  currentUid,
  teacherNames,
}: {
  classes: Class[]
  selected: string[]
  onChange: (ids: string[]) => void
  currentUid?: string
  teacherNames: Record<string, string>
}) {
  const t = useTranslations('adminTeachers')
  if (classes.length === 0) {
    return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{t('form.noClassesYet')}</p>
  }
  return (
    <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
      {classes.map((c) => {
        const checked = selected.includes(c.id)
        const otherTeacher = c.teacherId && c.teacherId !== currentUid
        const id = `cls-${currentUid ?? 'new'}-${c.id}`
        return (
          <label key={c.id} htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
            <input
              id={id}
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
              className="h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
            />
            <span className="min-w-0 flex-1 truncate text-foreground">{classLabel(c)}</span>
            {otherTeacher && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {c.teacherId && teacherNames[c.teacherId]
                  ? t('assign.currentlyAssigned', { name: teacherNames[c.teacherId] })
                  : t('assign.currentlyAssignedOther')}
              </span>
            )}
          </label>
        )
      })}
    </div>
  )
}

export default function TeachersPage() {
  const t = useTranslations('adminTeachers')
  const tc = useTranslations('common')

  const [teachers, setTeachers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'' | StaffRole>('')
  const [page, setPage] = useState(1)

  // Create form
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('teacher')
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Assignment edit
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null)
  const [editingClassIds, setEditingClassIds] = useState<string[]>([])

  // Delete
  const [deleting, setDeleting] = useState<User | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const loadTeachers = async () => {
    try {
      const users = await rtdb.getAllUsers()
      setTeachers(users.filter((u) => u.role === 'teacher' || u.role === 'admin'))
    } catch {
      toast.error(t('toast.loadError'))
    } finally {
      setLoading(false)
    }
  }

  // Live updates via the shared store (the shell's bells already keep these
  // channels open, so this page adds no extra downloads).
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))

  useEffect(() => {
    if (storeUsers.data) {
      setTeachers(storeUsers.data.filter((u) => u.role === 'teacher' || u.role === 'admin'))
      setLoading(false)
    }
  }, [storeUsers.data])
  const classes = useMemo(() => storeClasses.data?.filter((c) => c.isActive) ?? [], [storeClasses.data])

  const teacherNames = useMemo(() => {
    const m: Record<string, string> = {}
    teachers.forEach((u) => {
      m[u.uid] = u.name
    })
    return m
  }, [teachers])

  const classesByTeacher = useMemo(() => {
    const m: Record<string, Class[]> = {}
    classes.forEach((c) => {
      if (c.teacherId) (m[c.teacherId] ||= []).push(c)
    })
    return m
  }, [classes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teachers.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q)
      )
    })
  }, [teachers, search, roleFilter])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const myUid = auth.currentUser?.uid

  // Only messages we translated ourselves are shown; anything else (network, SDK) gets the generic text.
  const errorText = (err: unknown) => (err instanceof TranslatedError ? err.message : tc('errors.generic'))

  const openCreate = () => {
    setName('')
    setEmail('')
    setPhone('')
    setPassword('')
    setRole('teacher')
    setSelectedClasses([])
    setCreateOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone: phone || undefined,
          role,
          assignedClassIds: selectedClasses,
          schoolId: rtdb.getCurrentSchoolId(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new TranslatedError(tc(`errors.api.${apiErrorKey(data)}`))
      toast.success(role === 'admin' ? t('toast.adminCreated') : t('toast.teacherCreated'))
      setCreateOpen(false)
      await loadTeachers()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (u: User) => {
    const next = u.status === 'active' ? 'inactive' : 'active'
    try {
      await rtdb.updateUser(u.uid, {
        status: next,
        updatedAt: new Date().toISOString(),
      })
      toast.success(next === 'active' ? t('toast.activated', { name: u.name }) : t('toast.deactivated', { name: u.name }))
      await loadTeachers()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const startAssignmentEdit = (u: User) => {
    setEditingTeacher(u)
    setEditingClassIds(classes.filter((c) => c.teacherId === u.uid).map((c) => c.id))
  }

  const handleAssignmentSave = async () => {
    if (!editingTeacher) return
    setSaving(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/admin/users/${editingTeacher.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ assignedClassIds: editingClassIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new TranslatedError(tc(`errors.api.${apiErrorKey(data)}`))
      toast.success(t('toast.assigned', { name: editingTeacher.name }))
      setEditingTeacher(null)
      await loadTeachers()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  // Permanently delete a user via the admin-only server route.
  const confirmDelete = async () => {
    const u = deleting
    if (!u) return
    setDeleteBusy(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/admin/users/${u.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        data = { error: t('toast.unexpectedResponse', { status: res.status }) }
      }
      if (!res.ok) throw new TranslatedError(tc(`errors.api.${apiErrorKey(data)}`))
      toast.success(t('toast.deleted', { name: u.name }))
      setDeleting(null)
      await loadTeachers()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const roleLabel = (r: string) => (r === 'admin' ? tc('roles.admin') : r === 'teacher' ? tc('roles.teacher') : r)
  const statusLabel = (s: string) => (s === 'active' ? tc('status.active') : tc('status.inactive'))

  const handleExport = () => {
    exportToCsv(
      `users-${dateStamp()}.csv`,
      [t('csv.name'), t('csv.email'), t('csv.role'), t('csv.phone'), t('csv.status')],
      filtered.map((u) => [u.name, u.email, roleLabel(u.role), u.phone || '', statusLabel(u.status)])
    )
  }

  const renderActions = (u: User) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('actions.more', { name: u.name })}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {u.role === 'teacher' && (
          <DropdownMenuItem onSelect={() => startAssignmentEdit(u)}>
            <Pencil /> {t('actions.editClasses')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => toggleStatus(u)}>
          <Power /> {u.status === 'active' ? t('actions.deactivate') : t('actions.activate')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={u.uid === myUid}
          onSelect={() => setDeleting(u)}
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
        >
          <Trash2 /> {u.uid === myUid ? t('actions.cannotDeleteSelf') : t('actions.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const roleBadge = (r: string) => (
    <Badge variant={r === 'admin' ? 'default' : 'secondary'}>{roleLabel(r)}</Badge>
  )
  const statusBadge = (s: string) => (
    <Badge variant={s === 'active' ? 'success' : 'secondary'}>{statusLabel(s)}</Badge>
  )

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download /> {tc('actions.exportCsv')}
            </Button>
            <Button onClick={openCreate}>
              <UserPlus /> {t('add')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Label htmlFor="user-search" className="sr-only">
            {t('searchLabel')}
          </Label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="user-search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="user-role-filter" className="sr-only">
            {t('roleFilter')}
          </Label>
          <Select id="user-role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as '' | StaffRole)}>
            <option value="">{t('allRoles')}</option>
            <option value="teacher">{tc('roles.teacher')}</option>
            <option value="admin">{tc('roles.admin')}</option>
          </Select>
        </div>
        {!loading && (
          <p className="text-sm text-muted-foreground sm:ms-auto">
            {t('summary', { shown: filtered.length, total: teachers.length })}
          </p>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        search || roleFilter ? (
          <EmptyState icon={Search} title={t('empty.search')} />
        ) : (
          <EmptyState
            icon={UserPlus}
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
            {paginated.map((u) => {
              const assigned = classesByTeacher[u.uid] ?? []
              return (
                <li key={u.uid} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {u.name}
                        {u.uid === myUid && <span className="ms-1.5 text-xs text-muted-foreground">({t('you')})</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground" dir="ltr">
                        {u.email}
                      </p>
                      {u.phone && (
                        <p className="text-sm text-muted-foreground" dir="ltr">
                          {u.phone}
                        </p>
                      )}
                    </div>
                    {renderActions(u)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {roleBadge(u.role)}
                    {statusBadge(u.status)}
                    {u.role === 'teacher' && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <GraduationCap className="h-3.5 w-3.5" /> {t('classCount', { count: assigned.length })}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Desktop: table */}
          <TableContainer className="hidden md:block">
            <thead>
              <tr>
                <th>{t('table.name')}</th>
                <th>{t('table.email')}</th>
                <th>{t('table.role')}</th>
                <th>{t('table.classes')}</th>
                <th>{t('table.phone')}</th>
                <th>{t('table.status')}</th>
                <th className="text-end">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u) => {
                const assigned = classesByTeacher[u.uid] ?? []
                return (
                  <tr key={u.uid}>
                    <td className="font-medium text-foreground">
                      {u.name}
                      {u.uid === myUid && <span className="ms-1.5 text-xs font-normal text-muted-foreground">({t('you')})</span>}
                    </td>
                    <td>
                      <span dir="ltr">{u.email}</span>
                    </td>
                    <td>
                      {roleBadge(u.role)}
                    </td>
                    <td className="max-w-[16rem]">
                      {u.role !== 'teacher' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : assigned.length === 0 ? (
                        <span className="text-muted-foreground">{t('noClasses')}</span>
                      ) : (
                        <span className="line-clamp-2 text-sm" title={assigned.map(classLabel).join(', ')}>
                          {assigned.map((c) => (c.section ? `${c.name} · ${c.section}` : c.name)).join(', ')}
                        </span>
                      )}
                    </td>
                    <td>{u.phone ? <span dir="ltr">{u.phone}</span> : '—'}</td>
                    <td>
                      {statusBadge(u.status)}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {renderActions(u)}
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

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleCreate} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{t('form.createTitle')}</DialogTitle>
              <DialogDescription>{t('form.createDescription')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">{t('form.name')}</Label>
                <Input id="user-name" placeholder={t('form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">{t('form.email')}</Label>
                <Input
                  id="user-email"
                  type="email"
                  dir="ltr"
                  autoComplete="off"
                  placeholder={t('form.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-phone">{t('form.phone')}</Label>
                <Input
                  id="user-phone"
                  type="tel"
                  dir="ltr"
                  placeholder={t('form.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">{t('form.password')}</Label>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  placeholder={t('form.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-role">{t('form.role')}</Label>
                <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                  <option value="teacher">{tc('roles.teacher')}</option>
                  <option value="admin">{tc('roles.admin')}</option>
                </Select>
                <p className="text-xs text-muted-foreground">{t('form.roleHint')}</p>
              </div>
            </div>
            {role === 'teacher' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{t('form.classes')}</p>
                <p className="text-xs text-muted-foreground">{t('form.classesHint')}</p>
                <ClassChecklist
                  classes={classes}
                  selected={selectedClasses}
                  onChange={setSelectedClasses}
                  teacherNames={teacherNames}
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {t('form.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit class assignments */}
      <Dialog open={!!editingTeacher} onOpenChange={(o) => !o && setEditingTeacher(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assign.title')}</DialogTitle>
            <DialogDescription>{t('assign.description', { name: editingTeacher?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <ClassChecklist
            classes={classes}
            selected={editingClassIds}
            onChange={setEditingClassIds}
            currentUid={editingTeacher?.uid}
            teacherNames={teacherNames}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingTeacher(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleAssignmentSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {t('assign.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete.title', { name: deleting?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('delete.description', { email: deleting?.email ?? '' })}</DialogDescription>
          </DialogHeader>
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
