'use client'

import { useEffect, useState } from 'react'
import { auth } from '@/lib/firebase/config'
import { rtdb } from '@/lib/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { User as UserIcon, Mail, Phone, Loader2, Plus, Shield, Search, Download, GraduationCap, Trash2, Pencil, X } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import type { User, Class } from '@/types'
import { useLiveData } from '@/lib/dataStore'
import { exportToCsv, dateStamp } from '@/lib/exportCsv'

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher')
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null)
  const [editingClassIds, setEditingClassIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  const loadTeachers = async () => {
    setLoading(true)
    try {
      const users = await rtdb.getAllUsers()
      setTeachers(users.filter((u) => u.role === 'teacher' || u.role === 'admin'))
    } catch {
      setError('Could not load users. Publish database.rules.json in Firebase (Realtime Database > Rules) so admins can read the users list, then refresh.')
    } finally {
      setLoading(false)
    }
  }

  // Live updates via the shared store (the admin nav bells already keep these
  // channels open, so this page adds no extra downloads).
  const storeUsers = useLiveData<User[]>('users', (emit) => rtdb.subscribeToUsers(emit))
  const storeClasses = useLiveData<Class[]>('classes', (emit) => rtdb.subscribeToClasses(emit))

  useEffect(() => {
    if (storeUsers.data) {
      setTeachers(storeUsers.data.filter((u) => u.role === 'teacher' || u.role === 'admin'))
      setLoading(false)
    }
  }, [storeUsers.data])
  useEffect(() => {
    setClasses(storeClasses.data?.filter((c) => c.isActive) ?? [])
  }, [storeClasses.data])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      setSuccess(
        role === 'admin'
          ? 'Admin account created successfully'
          : 'Teacher account created successfully'
      )
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setRole('teacher')
      setSelectedClasses([])
      await loadTeachers()
    } catch (err: any) {
      setError(err.message || 'Failed to create teacher')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (t: User) => {
    try {
      await rtdb.updateUser(t.uid, {
        status: t.status === 'active' ? 'inactive' : 'active',
        updatedAt: new Date().toISOString(),
      })
      await loadTeachers()
    } catch (err: any) {
      setError(err.message || 'Failed to update status')
    }
  }

    const startAssignmentEdit = (t: User) => {
      setEditingTeacher(t)
      setEditingClassIds(classes.filter((c) => c.teacherId === t.uid).map((c) => c.id))
      setError('')
      setSuccess('')
    }

    const handleAssignmentSave = async () => {
      if (!editingTeacher) return
      setSaving(true)
      setError('')
      setSuccess('')
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
        if (!res.ok) throw new Error(data.error || 'Failed to update assignments')
        setSuccess(`Classes assigned to ${editingTeacher.name} successfully.`)
        setEditingTeacher(null)
        await loadTeachers()
      } catch (err: any) {
        setError(err.message || 'Failed to update assignments')
      } finally {
        setSaving(false)
      }
    }

  // Permanently delete a user via the admin-only server route.
  const handleDelete = async (t: User) => {
    if (!window.confirm(`Delete ${t.name} (${t.email})? This cannot be undone.`)) return
    setError('')
    setSuccess('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/admin/users/${t.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      let data: { error?: string } = {}
      try {
        data = await res.json()
      } catch {
        data = {
          error: `Server returned an unexpected response (${res.status}). If this just appeared, the latest code may not be deployed yet — please refresh and redeploy with \`vercel --prod\`.`,
        }
      }
      if (!res.ok) throw new Error(data.error || 'Failed to delete user')
      setSuccess(`User ${t.name} deleted.`)
      await loadTeachers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }
  const filtered = teachers.filter((t) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.phone || '').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    setPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const paginated = filtered.slice((page - 1) * perPage, page * perPage)

  const handleExport = () => {
    exportToCsv(
      `users-${dateStamp()}.csv`,
      ['Name', 'Email', 'Role', 'Phone', 'Status'],
      filtered.map((u) => [u.name, u.email, u.role, u.phone || '', u.status])
    )
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
        <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
        <p className="text-gray-600 mt-1">Create and manage admin and teacher accounts</p>
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
            <Plus className="h-5 w-5" /> Add New User
          </CardTitle>
          <CardDescription>Create an admin or teacher account with login credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="name" placeholder="Teacher name" value={name} onChange={(e) => setName(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="email" type="email" placeholder="teacher@school.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input id="phone" placeholder="Phone number (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input id="password" type="password" placeholder="Minimum 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'teacher')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500">Admins have full access and can manage other users.</p>
              </div>
            </div>
            {role === 'teacher' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-gray-400" /> Assign Classes (Grade • Section)
                </Label>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-input p-3">
                  {classes.length === 0 ? (
                    <p className="text-sm text-gray-500">No classes created yet. Create classes first, then assign the teacher.</p>
                  ) : (
                    classes.map((c) => {
                      const checked = selectedClasses.includes(c.id)
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedClasses((prev) =>
                                checked ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300 text-green-600"
                          />
                          {c.name}
                          {c.section ? ` • ${c.section}` : ''}
                          {c.grade ? ` (${c.grade})` : ''}
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create User
            </Button>
          </form>
        </CardContent>
      </Card>
<Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Users List ({filtered.length} / {teachers.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {search ? 'No users match your search.' : 'No users yet. Add your first user above.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-200 [&_th]:border [&_th]:border-gray-200 [&_td]:border [&_td]:border-gray-200">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t) => (
                    <tr key={t.uid} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{t.name}</td>
                      <td className="py-3 pr-4">{t.email}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            t.role === 'admin' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {t.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{t.phone || '—'}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startAssignmentEdit(t)}
                            disabled={t.role !== 'teacher'}
                            title={t.role === 'teacher' ? 'Edit assigned classes' : 'Admins do not have class assignments'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatus(t)}
                          >
                            {t.status === 'active' ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={t.uid === auth.currentUser?.uid}
                            onClick={() => handleDelete(t)}
                            title={t.uid === auth.currentUser?.uid ? 'You cannot delete your own account' : 'Delete user'}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
        </CardContent>
      </Card>

      {editingTeacher && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingTeacher(null)}
        >
          <Card className="w-full max-w-lg border-0 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="relative">
              <button
                type="button"
                aria-label="Close"
                className="absolute right-4 top-4 text-gray-400 transition hover:text-gray-600"
                onClick={() => setEditingTeacher(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <CardTitle>Edit Assigned Classes</CardTitle>
              <CardDescription>
                Select the classes currently taught by {editingTeacher.name}. Existing student records stay in their classes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-input p-3">
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-500">No classes created yet.</p>
                ) : (
                  classes.map((c) => {
                    const checked = editingClassIds.includes(c.id)
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditingClassIds((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300 text-green-600"
                        />
                        <span>
                          {c.name}
                          {c.section ? ` • ${c.section}` : ''}
                          {c.grade ? ` (${c.grade})` : ''}
                        </span>
                        {c.teacherId && c.teacherId !== editingTeacher.uid && (
                          <span className="ml-auto text-xs text-gray-400">Currently assigned</span>
                        )}
                      </label>
                    )
                  })
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingTeacher(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleAssignmentSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Assignments
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
