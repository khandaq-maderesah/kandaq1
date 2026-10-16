import { NextResponse } from 'next/server'
import { brandingAssetUrl } from '@/lib/branding'
import { getBrandingBySlug } from '@/lib/server/publicBranding'

/**
 * GET /m/{slug}/manifest.webmanifest — the madrasa's own installable app
 * (name + icons). A distinct `id` per madrasa lets one phone install several
 * madrasa apps side by side.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const found = await getBrandingBySlug(slug)
  if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { schoolId, branding } = found

  const manifest = {
    id: `/m/${slug}`,
    name: branding.name,
    short_name: branding.appName,
    description: branding.name,
    start_url: `/m/${slug}`,
    scope: '/',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#f5f6f8',
    icons: [
      { src: brandingAssetUrl(schoolId, branding, 'icon192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: brandingAssetUrl(schoolId, branding, 'icon512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: brandingAssetUrl(schoolId, branding, 'maskable512'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
