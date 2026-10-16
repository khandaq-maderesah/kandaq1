import type { Metadata } from 'next'
import { brandingAssetUrl, DEFAULT_APP_FULL_NAME } from '@/lib/branding'
import { getBrandingBySlug } from '@/lib/server/publicBranding'

/**
 * Per-madrasa page metadata: the browser tab title/icon, the iOS home-screen
 * name/icon and the PWA manifest all come from the madrasa's branding, so
 * installing from /m/{slug} gives the madrasa's own app.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const found = await getBrandingBySlug(slug)
  if (!found) return { title: DEFAULT_APP_FULL_NAME, robots: { index: false } }
  const { schoolId, branding } = found
  return {
    title: { absolute: branding.name },
    applicationName: branding.appName,
    manifest: `/m/${slug}/manifest.webmanifest`,
    icons: {
      icon: brandingAssetUrl(schoolId, branding, 'favicon'),
      apple: brandingAssetUrl(schoolId, branding, 'apple'),
    },
    appleWebApp: { capable: true, title: branding.appName, statusBarStyle: 'default' },
    openGraph: { title: branding.name, type: 'website' },
  }
}

export default function MadrasaLayout({ children }: { children: React.ReactNode }) {
  return children
}
