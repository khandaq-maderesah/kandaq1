/**
 * Per-madrasa branding (white-label).
 *
 * Each madrasa can have its own link (`/m/{slug}`), app name and logo. The
 * public part lives at `publicBranding/{schoolId}` and `slugs/{slug} -> schoolId`
 * in the Realtime Database (readable without signing in, because the branded
 * sign-in page needs it). Logo files live in Firebase Storage under
 * `branding/{schoolId}/` and are generated in the browser from one upload.
 * Without branding, the default MMS identity is used.
 */
import { transliterateAmharicToLatin } from './transliteration'

export interface PublicBranding {
  slug: string
  /** Madrasa display name. */
  name: string
  /** Short name under the home-screen icon / in the browser tab. */
  appName: string
  /** Set when a logo is uploaded (cache-busting version); absent = default logo. */
  logoVersion?: number
}

export const BRAND_COOKIE = 'khandaq_brand'
export const DEFAULT_APP_NAME = 'MMS'
export const DEFAULT_APP_FULL_NAME = 'MMS — Madrasa Management System'
export const APP_NAME_MAX = 20

/** Files generated from an uploaded logo. */
export const BRANDING_FILES = {
  mark: 'mark.png', // transparent, square, for in-app use
  icon192: 'icon-192.png',
  icon512: 'icon-512.png',
  maskable512: 'icon-maskable-512.png',
  apple: 'apple-touch-icon.png',
  favicon: 'favicon-64.png',
} as const
export type BrandingFile = keyof typeof BRANDING_FILES

const DEFAULT_ASSETS: Record<BrandingFile, string> = {
  mark: '/image/logo-mark.png',
  icon192: '/icons/icon-192.png',
  icon512: '/icons/icon-512.png',
  maskable512: '/icons/icon-maskable-512.png',
  apple: '/icons/apple-touch-icon.png',
  favicon: '/icons/favicon-64.png',
}

export function brandingStoragePath(schoolId: string, file: BrandingFile): string {
  return `branding/${schoolId}/${BRANDING_FILES[file]}`
}

/** Public URL of a branding asset (falls back to the default MMS asset). */
export function brandingAssetUrl(
  schoolId: string | null | undefined,
  branding: Pick<PublicBranding, 'logoVersion'> | null | undefined,
  file: BrandingFile
): string {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!schoolId || !branding?.logoVersion || !bucket) return DEFAULT_ASSETS[file]
  const path = encodeURIComponent(brandingStoragePath(schoolId, file))
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${path}?alt=media&v=${branding.logoVersion}`
}

// ---------------------------------------------------------------- slugs

/** Words that can never be a madrasa link (they collide with app routes). */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'dashboard', 'login', 'logout', 'm', 'mms', 'profile', 'settings',
  'superadmin', 'teacher', 'www', 'static', 'assets', 'icons', 'image', 'images', 'help', 'support',
])

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug)
}

/** Suggests a link name from a madrasa name (Amharic names are transliterated). */
export function suggestSlug(name: string): string {
  const latin = /[ሀ-፿]/.test(name) ? transliterateAmharicToLatin(name) || name : name
  return latin
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
    .replace(/-+$/g, '')
}
