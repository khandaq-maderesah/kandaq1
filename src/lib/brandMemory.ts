/**
 * Remembers which madrasa link (/m/{slug}) this device signs in through, so
 * signing out or an expired session leads back to that madrasa's branded
 * sign-in page instead of the generic one. Stored in a cookie (read by the
 * middleware for server-side redirects) and mirrored in localStorage.
 */
import { isValidSlug } from './branding'

export const BRAND_COOKIE = 'khandaq_brand'
const STORAGE_KEY = 'khandaq_brand'

export function rememberBrandSlug(slug: string | null) {
  try {
    if (slug && isValidSlug(slug)) {
      document.cookie = `${BRAND_COOKIE}=${slug}; path=/; SameSite=Lax; Max-Age=31536000`
      localStorage.setItem(STORAGE_KEY, slug)
    } else {
      document.cookie = `${BRAND_COOKIE}=; path=/; Max-Age=0`
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function getRememberedBrandSlug(): string | null {
  try {
    const slug = localStorage.getItem(STORAGE_KEY)
    return slug && isValidSlug(slug) ? slug : null
  } catch {
    return null
  }
}

/** Where to send someone who needs to sign in. */
export function signInPath(): string {
  const slug = getRememberedBrandSlug()
  return slug ? `/m/${slug}` : '/login'
}
