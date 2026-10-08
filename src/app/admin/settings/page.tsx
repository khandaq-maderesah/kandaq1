'use client'

import { useEffect, useState } from 'react'
import { rtdb } from '@/lib/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, School, Phone, MapPin, CalendarDays, UserPlus, Lock } from 'lucide-react'

export default function SettingsPage() {
  const [schoolName, setSchoolName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [savingRegister, setSavingRegister] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await rtdb.getSettings()
        setSchoolName(s.schoolName || '')
        setAddress(s.address || '')
        setPhone(s.phone || '')
        setAcademicYear(s.academicYear || '')
        setRegistrationOpen(s.registrationOpen !== 'false')
      } catch {
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await rtdb.updateSettings({ schoolName, address, phone, academicYear })
      setSuccess('Settings saved successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleRegistration = async () => {
    setSavingRegister(true)
    setError('')
    setSuccess('')
    const next = !registrationOpen
    try {
      await rtdb.updateSettings({ registrationOpen: next ? 'true' : 'false' })
      setRegistrationOpen(next)
      setSuccess(
        next
          ? 'Student registration opened. Teachers can now register new students.'
          : 'Student registration closed. Teachers can no longer register new students.'
      )
    } catch (err: any) {
      setError(err.message || 'Failed to update registration')
    } finally {
      setSavingRegister(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your school information</p>
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
            <School className="h-5 w-5" /> School Information
          </CardTitle>
          <CardDescription>
            These details are shown across the system and on printed reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name</Label>
              <div className="relative">
                <School className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="schoolName"
                  placeholder="e.g. Khendeq Medresah"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="address"
                  placeholder="Street, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="03XX-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic Year</Label>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="academicYear"
                  placeholder="e.g. 2026-2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Student Registration
          </CardTitle>
          <CardDescription>Control whether teachers can register new students</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex items-center justify-center rounded-lg p-2 ${registrationOpen ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <Lock className={`h-5 w-5 ${registrationOpen ? 'text-emerald-600' : 'text-red-600'}`} />
              </span>
              <div>
                <p className="font-medium text-gray-900">
                  {registrationOpen ? 'Registration is OPEN' : 'Registration is CLOSED'}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {registrationOpen
                    ? 'Teachers can register new students.'
                    : 'Teachers cannot register new students until you open registration again. Existing student records can still be edited.'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={registrationOpen ? 'destructive' : 'default'}
              disabled={savingRegister}
              onClick={handleToggleRegistration}
            >
              {savingRegister ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : registrationOpen ? (
                <Lock className="h-4 w-4 mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {registrationOpen ? 'Close Student Registration' : 'Open Student Registration'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
