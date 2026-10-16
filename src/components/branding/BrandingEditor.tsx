'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Copy, ExternalLink, Upload, Link2, Loader2, RotateCcw, Save } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import {
  getSchoolIdBySlug,
  removeBrandingLogo,
  saveBranding,
  uploadBrandingLogo,
} from '@/lib/database'
import {
  APP_NAME_MAX,
  RESERVED_SLUGS,
  brandingAssetUrl,
  isValidSlug,
  suggestSlug,
  type BrandingFile,
} from '@/lib/branding'
import { LOGO_ACCEPT, LogoError, processLogo } from '@/lib/logoProcessing'

/**
 * Edits the current madrasa's link (/m/{slug}), app name and logo. Used by
 * the madrasa admin (and the platform admin) in Settings.
 */
export function BrandingEditor() {
  const t = useTranslations('branding')
  const { school, branding, refreshSchool } = useAuth()
  const id = useId()
  const fileRef = useRef<HTMLInputElement>(null)

  const [appName, setAppName] = useState('')
  const [slug, setSlug] = useState('')
  const [logo, setLogo] = useState<Record<BrandingFile, Blob> | null>(null)
  const [logoError, setLogoError] = useState('')
  const [slugError, setSlugError] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Start from the saved branding (or sensible suggestions for a new setup).
  useEffect(() => {
    if (!school) return
    setAppName(branding?.appName ?? school.name.slice(0, APP_NAME_MAX))
    setSlug(branding?.slug ?? suggestSlug(school.name))
  }, [school, branding])

  // Preview URLs for a freshly chosen logo.
  const preview = useMemo(() => {
    if (!logo) return null
    return { mark: URL.createObjectURL(logo.mark), icon: URL.createObjectURL(logo.icon192) }
  }, [logo])
  useEffect(
    () => () => {
      if (preview) {
        URL.revokeObjectURL(preview.mark)
        URL.revokeObjectURL(preview.icon)
      }
    },
    [preview]
  )

  if (!school) return null

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const savedLink = branding?.slug ? `${origin}/m/${branding.slug}` : null
  const slugChanged = !!branding?.slug && slug !== branding.slug
  const markUrl = preview?.mark ?? brandingAssetUrl(school.id, branding, 'mark')
  const iconUrl = preview?.icon ?? brandingAssetUrl(school.id, branding, 'icon192')

  const validateSlug = (value: string): string => {
    if (RESERVED_SLUGS.has(value)) return t('slugReserved')
    if (!isValidSlug(value)) return t('slugInvalid')
    return ''
  }

  const chooseLogo = async (file: File | undefined) => {
    setLogoError('')
    if (!file) return
    try {
      setLogo(await processLogo(file))
    } catch (err) {
      const reason = err instanceof LogoError ? err.reason : 'decode'
      setLogoError(t(reason === 'type' ? 'logoErrorType' : reason === 'size' ? 'logoErrorSize' : 'logoErrorDecode'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanSlug = slug.trim().toLowerCase()
    const slugProblem = validateSlug(cleanSlug)
    setSlugError(slugProblem)
    if (slugProblem || !appName.trim()) return
    setSaving(true)
    try {
      if (cleanSlug !== branding?.slug) {
        const owner = await getSchoolIdBySlug(cleanSlug)
        if (owner && owner !== school.id) {
          setSlugError(t('slugTaken'))
          return
        }
      }
      await saveBranding(school.id, { name: school.name, appName: appName.trim(), slug: cleanSlug }, branding?.slug)
      if (logo) {
        try {
          await uploadBrandingLogo(school.id, logo)
          setLogo(null)
        } catch (err) {
          console.error('Logo upload failed', err)
          toast.error(t('uploadFailed'))
        }
      }
      await refreshSchool()
      toast.success(t('saved'))
    } catch (err) {
      console.error('Saving branding failed', err)
      toast.error(t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaultLogo = async () => {
    setRemoving(true)
    try {
      await removeBrandingLogo(school.id)
      setLogo(null)
      await refreshSchool()
      toast.success(t('logoRemoved'))
    } catch {
      toast.error(t('saveFailed'))
    } finally {
      setRemoving(false)
    }
  }

  const copyLink = async () => {
    if (!savedLink) return
    try {
      await navigator.clipboard.writeText(savedLink)
      toast.success(t('copied'))
    } catch {
      /* clipboard unavailable: the link is visible to copy by hand */
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current link */}
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t('yourLink')}</p>
          {savedLink ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code dir="ltr" className="min-w-0 break-all text-sm font-medium text-foreground">
                {savedLink}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                <Copy /> {t('copyLink')}
              </Button>
              <a href={savedLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <ExternalLink className="h-4 w-4" /> {t('openLink')}
              </a>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{t('notSetUp')}.</span> {t('notSetUpHint')}
            </p>
          )}
        </div>

        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${id}-app`}>{t('appName')}</Label>
              <Input
                id={`${id}-app`}
                required
                maxLength={APP_NAME_MAX}
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('appNameHint', { max: APP_NAME_MAX })}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-slug`}>{t('slug')}</Label>
              <div dir="ltr" className="flex items-center rounded-lg border border-input bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring">
                <span className="ps-3 text-sm text-muted-foreground">/m/</span>
                <Input
                  id={`${id}-slug`}
                  required
                  maxLength={40}
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setSlugError('')
                  }}
                  aria-invalid={!!slugError}
                  aria-describedby={`${id}-slug-hint`}
                  className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <p id={`${id}-slug-hint`} className={slugError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {slugError || t('slugHint')}
              </p>
            </div>
          </div>

          {slugChanged && (
            <Alert variant="warning">
              <AlertDescription>{t('slugChangeWarning')}</AlertDescription>
            </Alert>
          )}

          {/* Logo */}
          <div className="space-y-3">
            <Label>{t('logo')}</Label>
            <div className="flex flex-wrap items-center gap-6">
              <figure className="flex flex-col items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={markUrl} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
                <figcaption className="text-xs text-muted-foreground">{t('previewApp')}</figcaption>
              </figure>
              <figure className="flex flex-col items-center gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl border object-cover shadow-sm" />
                <figcaption className="text-xs text-muted-foreground">{t('previewIcon')}</figcaption>
              </figure>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept={LOGO_ACCEPT}
                  className="sr-only"
                  id={`${id}-logo`}
                  onChange={(e) => chooseLogo(e.target.files?.[0])}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload /> {branding?.logoVersion || logo ? t('changeLogo') : t('uploadLogo')}
                </Button>
                {branding?.logoVersion && !logo && (
                  <Button type="button" variant="ghost" onClick={resetToDefaultLogo} disabled={removing}>
                    {removing ? <Loader2 className="animate-spin" /> : <RotateCcw />} {t('removeLogo')}
                  </Button>
                )}
              </div>
            </div>
            <p className={logoError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{logoError || t('logoHint')}</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
