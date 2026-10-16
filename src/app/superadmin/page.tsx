'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase/config'
import { rtdb } from '@/lib/database'
import { useLiveData } from '@/lib/dataStore'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Loader2, Plus, LogIn, PauseCircle, PlayCircle, UserPlus, X } from 'lucide-react'
import type { School, User } from '@/types'

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa'

function newSchoolId(): string {
  return `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export default function SuperAdminPage() {
  const router = useRouter()
  const { user, selectSchool } = useAuth()
  const schoolsData = useLiveData<School[]>('schools', (emit) => rtdb.subscribeToSchools(emit))
  const usersData = useLiveData<User[]>('allUsers', (emit) => rtdb.subscribeToAllUsers(emit))

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
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
      setSuccess(`School "${record.name}" created. Now add its admin account.`)
      setName('')
      setNameAm('')
      setAddress('')
      setPhone('')
      setTimezone(DEFAULT_TIMEZONE)
      setShowCreate(false)
      setAdminFor(id)
    } catch (err: any) {
      setError(err.message || 'Failed to create school')
    } finally {
      setCreating(false)
    }
  }

  const toggleStatus = async (school: School) => {
    setError('')
    setSuccess('')
    const next = school.status === 'active' ? 'suspended' : 'active'
    if (
      next === 'suspended' &&
      !window.confirm(`Suspend "${school.name}"? Its admins and teachers will not be able to sign in until it is reactivated.`)
    ) {
      return
    }
    try {
      await rtdb.updateSchool(school.id, { status: next, updatedAt: new Date().toISOString() })
      setSuccess(`"${school.name}" is now ${next}.`)
    } catch (err: any) {
      setError(err.message || 'Failed to update school')
    }
  }

  const openSchool = async (school: School) => {
    await selectSchool(school.id)
    router.push('/admin')
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminFor) return
    setError('')
    setSuccess('')
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create admin')
      setSuccess(`Admin account created for ${adminEmail}.`)
      setAdminName('')
      setAdminEmail('')
      setAdminPhone('')
      setAdminPassword('')
      setAdminFor(null)
    } catch (err: any) {
      setError(err.message || 'Failed to create admin')
    } finally {
      setAddingAdmin(false)
    }
  }

  const loading = schoolsData.data === undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schools</h1>
          <p className="mt-1 text-gray-600">Create schools, give each one an admin, and open any school to manage it.</p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showCreate ? 'Cancel' : 'New school'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>New school</CardTitle>
            <CardDescription>The school starts empty. Its admin then adds classes, teachers and students.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSchool} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="school-name">School name *</Label>
                <Input id="school-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Khendeq Medresah" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-name-am">Name in Amharic (for SMS)</Label>
                <Input id="school-name-am" value={nameAm} onChange={(e) => setNameAm(e.target.value)} placeholder="e.g. ኸንደቅ መድረሳ" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-address">Address</Label>
                <Input id="school-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-phone">Phone</Label>
                <Input id="school-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school-tz">Timezone</Label>
                <Input id="school-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={creating} className="w-full">
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create school
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      ) : schools.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-600">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            No schools yet. Click <strong>New school</strong> to create the first one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schools.map((school) => {
            const members = usersBySchool.get(school.id) ?? []
            const admins = members.filter((u) => u.role === 'admin')
            const teacherCount = members.filter((u) => u.role === 'teacher').length
            const suspended = school.status === 'suspended'
            return (
              <Card key={school.id} className={suspended ? 'opacity-75' : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{school.name}</CardTitle>
                      <CardDescription>
                        {[school.address, school.phone].filter(Boolean).join(' · ') || 'No contact details'}
                      </CardDescription>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {suspended ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-gray-700">
                    <p>
                      <strong>{admins.length}</strong> admin{admins.length === 1 ? '' : 's'} ·{' '}
                      <strong>{teacherCount}</strong> teacher{teacherCount === 1 ? '' : 's'}
                    </p>
                    {admins.length > 0 && (
                      <p className="mt-1 truncate text-gray-500">{admins.map((a) => a.email).join(', ')}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openSchool(school)}>
                      <LogIn className="mr-1.5 h-4 w-4" /> Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAdminFor(adminFor === school.id ? null : school.id)}>
                      <UserPlus className="mr-1.5 h-4 w-4" /> Add admin
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(school)}>
                      {suspended ? (
                        <><PlayCircle className="mr-1.5 h-4 w-4" /> Reactivate</>
                      ) : (
                        <><PauseCircle className="mr-1.5 h-4 w-4" /> Suspend</>
                      )}
                    </Button>
                  </div>

                  {adminFor === school.id && (
                    <form onSubmit={handleAddAdmin} className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`an-${school.id}`}>Full name *</Label>
                        <Input id={`an-${school.id}`} required value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ae-${school.id}`}>Email *</Label>
                        <Input id={`ae-${school.id}`} type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`ap-${school.id}`}>Phone</Label>
                        <Input id={`ap-${school.id}`} value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`aw-${school.id}`}>Temporary password *</Label>
                        <Input id={`aw-${school.id}`} type="password" required minLength={6} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" size="sm" disabled={addingAdmin}>
                          {addingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create admin for {school.name}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
