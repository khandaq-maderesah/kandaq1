'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Building2,
  CheckCircle2,
  Loader2,
  LogIn,
  Mail,
  MapPin,
  PauseCircle,
  Phone,
  PlayCircle,
  Plus,
  UserPlus,
  Users,
} from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { School, User } from '@/types'
import { apiErrorKey } from '@/lib/apiErrors'

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa'

function newSchoolId(): string {
  return `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export default function SuperAdminPage() {
  const t = useTranslations('superadmin')
  const tc = useTranslations('common')
  const router = useRouter()
  const { user, selectSchool } = useAuth()
  const schoolsData = useLiveData<School[]>('schools', (emit) => rtdb.subscribeToSchools(emit))
  const usersData = useLiveData<User[]>('allUsers', (emit) => rtdb.subscribeToAllUsers(emit))

  // New school form
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [nameAm, setNameAm] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)
  const [creating, setCreating] = useState(false)

  // New school-admin form (one school at a time)
  const [adminFor, setAdminFor] = useState<string | null>(null)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

  // Suspend confirmation + per-school busy state
  const [suspendTarget, setSuspendTarget] = useState<School | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const schools = useMemo(
    () => [...(schoolsData.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [schoolsData.data]
  )

  const usersBySchool = useMemo(() => {
    const map = new Map<string, User[]>()
    for (const u of usersData.data ?? []) {
      if (!u.schoolId) continue
      const list = map.get(u.schoolId) ?? []
      list.push(u)
      map.set(u.schoolId, list)
    }
    return map
  }, [usersData.data])

  const stats = useMemo(() => {
    const suspended = schools.filter((s) => s.status === 'suspended').length
    const users = (usersData.data ?? []).filter((u) => u.schoolId).length
    return { total: schools.length, active: schools.length - suspended, suspended, users }
  }, [schools, usersData.data])

  const adminSchool = adminFor ? schools.find((s) => s.id === adminFor) : undefined

  const resetCreateForm = () => {
    setName('')
    setNameAm('')
    setAddress('')
    setPhone('')
    setTimezone(DEFAULT_TIMEZONE)
  }

  const resetAdminForm = () => {
    setAdminName('')
    setAdminEmail('')
    setAdminPhone('')
    setAdminPassword('')
  }

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const now = new Date().toISOString()
      const record: Omit<School, 'id'> = {
        name: name.trim(),
        status: 'active',
        timezone: timezone.trim() || DEFAULT_TIMEZONE,
        createdAt: now,
        createdBy: user?.uid ?? '',
        updatedAt: now,
      }
      if (nameAm.trim()) record.nameAm = nameAm.trim()
      if (address.trim()) record.address = address.trim()
      if (phone.trim()) record.phone = phone.trim()
      const id = newSchoolId()
      await rtdb.createSchool(id, record)
      toast.success(t('create.created', { name: record.name }))
      resetCreateForm()
      setShowCreate(false)
      resetAdminForm()
      setAdminFor(id)
    } catch (err) {
      console.error('Create school failed', err)
      toast.error(t('create.failed'))
    } finally {
      setCreating(false)
    }
  }

  const setStatus = async (school: School, next: School['status']) => {
    setBusyId(school.id)
    try {
      await rtdb.updateSchool(school.id, { status: next, updatedAt: new Date().toISOString() })
      toast.success(
        next === 'suspended' ? t('toast.suspended', { name: school.name }) : t('toast.reactivated', { name: school.name })
      )
      setSuspendTarget(null)
    } catch (err) {
      console.error('Update school failed', err)
      toast.error(t('toast.updateFailed'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleStatus = (school: School) => {
    if (school.status === 'active') setSuspendTarget(school)
    else setStatus(school, 'active')
  }

  const openSchool = async (school: School) => {
    setOpeningId(school.id)
    try {
      await selectSchool(school.id)
      router.push('/admin')
    } catch (err) {
      console.error('Open school failed', err)
      toast.error(tc('errors.generic'))
      setOpeningId(null)
    }
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminFor) return
    setAddingAdmin(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          phone: adminPhone || undefined,
          role: 'admin',
          schoolId: adminFor,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(t('admin.failed'), { description: tc(`errors.api.${apiErrorKey(data)}`) })
        return
      }
      toast.success(t('admin.created', { email: adminEmail }))
      resetAdminForm()
      setAdminFor(null)
    } catch (err) {
      console.error('Create admin failed', err)
      toast.error(t('admin.failed'), { description: tc('errors.network') })
    } finally {
      setAddingAdmin(false)
    }
  }

  const loading = schoolsData.data === undefined

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            {t('newSchool')}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('stats.total')} value={loading ? '—' : stats.total} icon={Building2} />
        <StatCard label={t('stats.active')} value={loading ? '—' : stats.active} icon={CheckCircle2} tone="success" />
        <StatCard label={t('stats.suspended')} value={loading ? '—' : stats.suspended} icon={PauseCircle} tone="warning" />
        <StatCard
          label={t('stats.users')}
          value={usersData.data === undefined ? '—' : stats.users}
          icon={Users}
          tone="info"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : schools.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus />
              {t('newSchool')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schools.map((school) => {
            const members = usersBySchool.get(school.id) ?? []
            const admins = members.filter((u) => u.role === 'admin')
            const teacherCount = members.filter((u) => u.role === 'teacher').length
            const suspended = school.status === 'suspended'
            return (
              <div key={school.id} className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-foreground">{school.name}</h2>
                      {school.nameAm && (
                        <p className="truncate text-sm text-muted-foreground" lang="am">
                          {school.nameAm}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={suspended ? 'warning' : 'success'} className="shrink-0">
                    {suspended ? <PauseCircle /> : <CheckCircle2 />}
                    {suspended ? tc('status.suspended') : tc('status.active')}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  {school.address || school.phone ? (
                    <>
                      {school.address && (
                        <p className="flex min-w-0 items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span className="truncate">{school.address}</span>
                        </p>
                      )}
                      {school.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span dir="ltr">{school.phone}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p>{t('card.noContact')}</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{t('card.admins', { count: admins.length })}</Badge>
                  <Badge variant="secondary">{t('card.teachers', { count: teacherCount })}</Badge>
                </div>
                {admins.length > 0 ? (
                  <p className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate" dir="ltr">
                      {admins.map((a) => a.email).join(', ')}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-warning">{t('card.noAdminYet')}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  <Button size="sm" onClick={() => openSchool(school)} disabled={openingId !== null}>
                    {openingId === school.id ? <Loader2 className="animate-spin" /> : <LogIn className="rtl:rotate-180" />}
                    {t('card.open')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      resetAdminForm()
                      setAdminFor(school.id)
                    }}
                  >
                    <UserPlus />
                    {t('card.addAdmin')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleStatus(school)}
                    disabled={busyId === school.id}
                    className={suspended ? undefined : 'text-destructive hover:text-destructive'}
                  >
                    {busyId === school.id ? (
                      <Loader2 className="animate-spin" />
                    ) : suspended ? (
                      <PlayCircle />
                    ) : (
                      <PauseCircle />
                    )}
                    {suspended ? t('card.reactivate') : t('card.suspend')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New school */}
      <Dialog open={showCreate} onOpenChange={(o) => !creating && setShowCreate(o)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>{t('create.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="school-name">{t('create.name')}</Label>
                <Input
                  id="school-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('create.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-name-am">{t('create.nameAm')}</Label>
                <Input id="school-name-am" lang="am" value={nameAm} onChange={(e) => setNameAm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-address">{t('create.address')}</Label>
                <Input id="school-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-phone">{t('create.phone')}</Label>
                <Input
                  id="school-phone"
                  type="tel"
                  dir="ltr"
                  className="text-start"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-tz">{t('create.timezone')}</Label>
                <Input
                  id="school-tz"
                  dir="ltr"
                  className="text-start"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                {t('create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New school admin */}
      <Dialog open={adminFor !== null} onOpenChange={(o) => !o && !addingAdmin && setAdminFor(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.title', { school: adminSchool?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('admin.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="admin-name">{t('admin.fullName')}</Label>
                <Input id="admin-name" required autoComplete="off" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">{t('admin.email')}</Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  dir="ltr"
                  className="text-start"
                  autoComplete="off"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone">{t('admin.phone')}</Label>
                <Input
                  id="admin-phone"
                  type="tel"
                  dir="ltr"
                  className="text-start"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">{t('admin.password')}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-describedby="admin-password-hint"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <p id="admin-password-hint" className="text-xs text-muted-foreground">
                  {t('admin.passwordHint')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdminFor(null)} disabled={addingAdmin}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" disabled={addingAdmin}>
                {addingAdmin ? <Loader2 className="animate-spin" /> : <UserPlus />}
                {t('admin.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suspend confirmation */}
      <Dialog open={suspendTarget !== null} onOpenChange={(o) => !o && busyId === null && setSuspendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('suspend.title', { name: suspendTarget?.name ?? '' })}</DialogTitle>
            <DialogDescription>{t('suspend.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSuspendTarget(null)} disabled={busyId !== null}>
              {tc('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => suspendTarget && setStatus(suspendTarget, 'suspended')}
            >
              {busyId !== null ? <Loader2 className="animate-spin" /> : <PauseCircle />}
              {t('suspend.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
