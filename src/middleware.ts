import { NextResponse, type NextRequest } from 'next/server'
import { isValidSlug } from '@/lib/branding'

export const SESSION_COOKIE = 'khandaq_session'
// Set by the branded sign-in page /m/{slug} (see src/lib/brandMemory.ts).
const BRAND_COOKIE = 'khandaq_brand'

const PROTECTED_PREFIXES = ['/admin', '/teacher', '/dashboard', '/profile', '/superadmin']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = req.cookies.get(SESSION_COOKIE)?.value === 'true'
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Unauthenticated users are sent to the login page before protected pages load
  if (isProtected && !hasSession) {
    // Back to the madrasa's own branded sign-in page when this device uses one.
    const brand = req.cookies.get(BRAND_COOKIE)?.value
    const loginUrl = new URL(brand && isValidSlug(brand) ? `/m/${brand}` : '/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already signed in users shouldn't see the login page or landing page
  if ((pathname === '/login' || pathname === '/') && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/teacher/:path*', '/dashboard/:path*', '/profile/:path*', '/superadmin/:path*', '/login'],
}
