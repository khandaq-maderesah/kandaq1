import { isValidSlug, type PublicBranding } from '@/lib/branding'

/**
 * Server-side lookup of a madrasa's public branding by its link name. Uses
 * the public Realtime Database REST endpoints (no credentials needed) and
 * caches for a minute, so the branded pages and manifest stay fast.
 */
export async function getBrandingBySlug(
  slug: string
): Promise<{ schoolId: string; branding: PublicBranding } | null> {
  const db = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.replace(/\/+$/, '')
  if (!db || !isValidSlug(slug)) return null
  try {
    const idRes = await fetch(`${db}/slugs/${slug}.json`, { next: { revalidate: 60 } })
    if (!idRes.ok) return null
    const schoolId = (await idRes.json()) as string | null
    if (!schoolId || typeof schoolId !== 'string') return null
    const bRes = await fetch(`${db}/publicBranding/${encodeURIComponent(schoolId)}.json`, {
      next: { revalidate: 60 },
    })
    if (!bRes.ok) return null
    const branding = (await bRes.json()) as PublicBranding | null
    // The link must still belong to this madrasa (it may have been renamed).
    if (!branding || branding.slug !== slug) return null
    return { schoolId, branding }
  } catch {
    return null
  }
}
