'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Lock, Unlock, Save, UserPlus } from 'lucide-react'
import { rtdb } from '@/lib/database'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page'
import { cn } from '@/lib/utils'
import { BrandingEditor } from '@/components/branding/BrandingEditor'

export default function SettingsPage() {
  const t = useTranslations('adminSettings')
  const tc = useTranslations('common')
  const { school, branding, refreshSchool } = useAuth()
  const [schoolName, setSchoolName] = useState('')
  const [schoolNameAm, setSchoolNameAm] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [savingRegister, setSavingRegister] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        // Name/contact live on the school record (schoolInfo); the rest are
        // per-school settings.
        const s = await rtdb.getSettings()
        setSchoolName(school?.name || '')
        setSchoolNameAm(school?.nameAm || '')
        setAddress(school?.address || '')
        setPhone(school?.phone || '')
        setAcademicYear(s.academicYear || '')
        setRegistrationOpen(s.registrationOpen !== 'false')
      } catch (err) {
        console.error('Loading settings failed', err)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    })()
    // Load once for the school this page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!school) {
      setFormError(t('school.noSchool'))
      return
    }
    if (!schoolName.trim()) {
      setFormError(t('school.nameRequired'))
      return
    }
    setSaving(true)
    try {
      await rtdb.updateSchool(school.id, {
        name: schoolName.trim(),
        nameAm: schoolNameAm.trim(),
        address: address.trim(),
        phone: phone.trim(),
        updatedAt: new Date().toISOString(),
      })
      await rtdb.updateSettings({ academicYear })
      // Keep the public name (branded sign-in page, installed app) in sync.
      if (branding?.slug) {
        await rtdb.saveBranding(
          school.id,
          { name: schoolName.trim(), appName: branding.appName, slug: branding.slug },
          branding.slug
        )
      }
      await refreshSchool()
      toast.success(t('school.saved'))
    } catch (err) {
      console.error('Saving settings failed', err)
      toast.error(t('school.failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleRegistration = async () => {
    setSavingRegister(true)
    const next = !registrationOpen
    try {
      await rtdb.updateSettings({ registrationOpen: next ? 'true' : 'false' })
      setRegistrationOpen(next)
      toast.success(next ? t('registration.opened') : t('registration.closed'))
    } catch (err) {
      console.error('Updating registration failed', err)
      toast.error(t('registration.failed'))
    } finally {
      setSavingRegister(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="space-y-6">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{t('school.loadFailed')}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('school.title')}</CardTitle>
            <CardDescription>{t('school.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">{t('school.name')}</Label>
                  <Input
                    id="schoolName"
                    placeholder={t('school.namePlaceholder')}
                    value={schoolName}
                    onChange={(e) => {
                      setSchoolName(e.target.value)
                      setFormError('')
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolNameAm">{t('school.nameAm')}</Label>
                  <Input
                    id="schoolNameAm"
                    lang="am"
                    value={schoolNameAm}
                    onChange={(e) => setSchoolNameAm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t('school.address')}</Label>
                  <Input
                    id="address"
                    placeholder={t('school.addressPlaceholder')}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('school.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    dir="ltr"
                    className="text-start"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academicYear">{t('school.academicYear')}</Label>
                  <Input
                    id="academicYear"
                    placeholder={t('school.academicYearPlaceholder')}
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  />
                </div>
              </div>

              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? tc('status.saving') : t('school.save')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('registration.title')}</CardTitle>
            <CardDescription>{t('registration.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    registrationOpen ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  )}
                >
                  {registrationOpen ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {registrationOpen ? t('registration.openStatus') : t('registration.closedStatus')}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {registrationOpen ? t('registration.openHint') : t('registration.closedHint')}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={registrationOpen ? 'outline' : 'default'}
                className={cn('shrink-0', registrationOpen && 'text-destructive hover:text-destructive')}
                disabled={savingRegister}
                onClick={handleToggleRegistration}
              >
                {savingRegister ? <Loader2 className="animate-spin" /> : registrationOpen ? <Lock /> : <UserPlus />}
                {registrationOpen ? t('registration.close') : t('registration.open')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <BrandingEditor />
      </div>
    </div>
  )
}
