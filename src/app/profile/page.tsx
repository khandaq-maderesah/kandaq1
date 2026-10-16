'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { Building2, KeyRound, Languages, Loader2, Mail, Save, Shield } from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/context/AuthContext'
import { rtdb } from '@/lib/database'
import { useLocaleSettings } from '@/i18n/I18nProvider'
import { LOCALES, LOCALE_NAMES, isLocale } from '@/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/page'

export default function ProfilePage() {
  const t = useTranslations('profile')
  const tc = useTranslations('common')
  const { user, school, loading } = useAuth()
  const { locale, setLocale } = useLocaleSettings()
  const router = useRouter()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdError, setPwdError] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await rtdb.updateUser(user.uid, {
        name,
        phone: phone || undefined,
        updatedAt: new Date().toISOString(),
      })
      toast.success(t('details.saved'))
    } catch (err) {
      console.error('Profile update failed', err)
      toast.error(t('details.failed'))
    } finally {
      setSaving(false)
    }
  }

  const handleLanguageChange = async (value: string) => {
    if (!isLocale(value) || value === locale) return
    setLocale(value)
    if (!user) return
    try {
      await rtdb.updateUser(user.uid, { language: value })
      toast.success(t('language.saved'))
    } catch (err) {
      console.error('Saving language failed', err)
      toast.error(t('language.failed'))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    if (newPassword.length < 6) {
      setPwdError(t('password.tooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdError(t('password.mismatch'))
      return
    }
    setSavingPwd(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser || !currentUser.email) {
        throw new Error('Not signed in')
      }
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t('password.updated'))
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwdError(t('password.wrongCurrent'))
      } else {
        console.error('Password update failed', err)
        setPwdError(t('password.failed'))
      }
    } finally {
      setSavingPwd(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="max-w-3xl space-y-6" aria-busy="true">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('account.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <dt className="text-sm text-muted-foreground">{t('account.email')}</dt>
                <dd className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate" dir="ltr">
                    {user.email}
                  </span>
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-sm text-muted-foreground">{t('account.role')}</dt>
                <dd className="flex items-center gap-2">
                  <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Badge>{tc(`roles.${user.role}`)}</Badge>
                </dd>
              </div>
              {school && (
                <div className="min-w-0 space-y-1 sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">{t('account.school')}</dt>
                  <dd className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{school.name}</span>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('details.title')}</CardTitle>
            <CardDescription>{t('details.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{tc('fields.fullName')}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{tc('fields.phone')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    dir="ltr"
                    className="text-start"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {tc('actions.saveChanges')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5 text-muted-foreground" />
              {t('language.title')}
            </CardTitle>
            <CardDescription>{t('language.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="language">{t('language.label')}</Label>
              <Select id="language" value={locale} onChange={(e) => handleLanguageChange(e.target.value)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-muted-foreground" />
              {t('password.title')}
            </CardTitle>
            <CardDescription>{t('password.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2 sm:max-w-[calc(50%-0.5rem)]">
                <Label htmlFor="currentPassword">{t('password.current')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">{t('password.new')}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="newPassword-hint"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <p id="newPassword-hint" className="text-xs text-muted-foreground">
                    {t('password.newHint')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('password.confirm')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              {pwdError && (
                <Alert variant="destructive">
                  <AlertDescription>{pwdError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={savingPwd}>
                {savingPwd ? <Loader2 className="animate-spin" /> : <KeyRound />}
                {t('password.update')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
