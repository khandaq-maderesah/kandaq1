import type { MetadataRoute } from 'next'
import { cookies } from 'next/headers'
import { getBrandingBySlug } from '@/lib/server/publicBranding'
import { brandingAssetUrl, BRAND_COOKIE } from '@/lib/branding'

/**
 * Dynamic Root PWA Manifest (`/manifest.webmanifest`).
 *
 * When accessed from a madrasa device or subpath (via `khandaq_brand` cookie),
 * dynamically resolves the madrasa's name, custom uploaded logo, and app icon.
 * Ensures the custom uploaded logo is strictly served as the app icon whenever
 * available, preventing the generic default logo from overriding madrasa branding.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = 'MMS — Madrasa Management System'
  let short_name = 'MMS'
  let id = '/'
  let start_url = '/'
  let icons: MetadataRoute.Manifest['icons'] = [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]

  try {
    const cookieStore = await cookies()
    const slug = cookieStore.get(BRAND_COOKIE)?.value
    if (slug) {
      const found = await getBrandingBySlug(slug)
      if (found) {
        const { schoolId, branding } = found
        name = branding.name || name
        short_name = branding.appName || short_name
        id = `/m/${slug}`
        start_url = `/m/${slug}`

        // Only switch icons if the madrasa actually uploaded a custom logo!
        // Never show default logo as custom icon if madrasa has its own logo uploaded
        if (branding.logoVersion) {
          icons = [
            {
              src: brandingAssetUrl(schoolId, branding, 'icon192'),
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: brandingAssetUrl(schoolId, branding, 'icon512'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: brandingAssetUrl(schoolId, branding, 'maskable512'),
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ]
        }
      }
    }
  } catch (err) {
    console.error('Error resolving dynamic PWA manifest:', err)
  }

  return {
    name,
    short_name,
    description: name,
    id,
    start_url,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f6f8',
    theme_color: '#214dc4',
    categories: ['education', 'productivity'],
    icons,
    shortcuts: [
      {
        name: 'Dashboard',
        url: '/dashboard',
        description: 'Open the dashboard',
      },
    ],
  }
}