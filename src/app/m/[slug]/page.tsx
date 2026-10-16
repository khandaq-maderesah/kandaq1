import { brandingAssetUrl } from '@/lib/branding'
import { getBrandingBySlug } from '@/lib/server/publicBranding'
import { MadrasaSignIn, MadrasaNotFound } from './MadrasaSignIn'

/** /m/{slug}: the madrasa's branded sign-in (and its app's start page). */
export default async function MadrasaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const found = await getBrandingBySlug(slug)
  if (!found) return <MadrasaNotFound />
  const { schoolId, branding } = found
  return (
    <MadrasaSignIn
      brand={{
        schoolId,
        slug,
        name: branding.name,
        appName: branding.appName,
        logoUrl: brandingAssetUrl(schoolId, branding, 'mark'),
      }}
    />
  )
}
