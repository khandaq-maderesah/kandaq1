import { NextResponse, type NextRequest } from 'next/server'

export const SESSION_COOKIE = 'khandaq_session'

const PROTECTED_PREFIXES = ['/admin', '/teacher', '/dashboard', '/profile']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = req.cookies.get(SESSION_COOKIE)?.value === 'true'
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  // Unauthenticated users are sent to the login page before protected pages load
  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already signed in users shouldn't see the login page
  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*', '/dashboard/:path*', '/profile/:path*', '/login'],
}
