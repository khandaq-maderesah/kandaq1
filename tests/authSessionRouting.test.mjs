import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const { middleware, SESSION_COOKIE, config } = await import('../src/middleware.ts')
const { NextRequest } = await import('next/server')

function request(url, cookies = {}) {
  const cookieHeader = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
  return new NextRequest(new URL(url), {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

function locationOf(response) {
  return response.headers.get('location')
}

describe('Session middleware routing', () => {
  test('protected routes without a session are sent to the sign-in page', () => {
    const res = middleware(request('http://localhost/teacher/attendance'))
    assert.equal(res.status, 307)
    const target = new URL(locationOf(res))
    assert.equal(target.pathname, '/login')
    assert.equal(target.searchParams.get('from'), '/teacher/attendance')
  })

  test('protected routes with a valid session pass through', () => {
    const res = middleware(
      request('http://localhost/teacher/attendance', { [SESSION_COOKIE]: 'true' })
    )
    assert.equal(locationOf(res), null)
  })

  test('every protected prefix is guarded', () => {
    for (const prefix of ['/admin', '/teacher', '/dashboard', '/profile', '/superadmin']) {
      const res = middleware(request(`http://localhost${prefix}`))
      assert.equal(res.status, 307, `${prefix} must be guarded by the session cookie`)
    }
  })

  test('a branded device is sent to its own sign-in page', () => {
    const res = middleware(
      request('http://localhost/teacher/attendance', { khandaq_brand: 'my-madrasa' })
    )
    const target = new URL(locationOf(res))
    assert.equal(target.pathname, '/m/my-madrasa')
    assert.equal(target.searchParams.get('from'), '/teacher/attendance')
  })

  test('an invalid branded slug falls back to the standard sign-in page', () => {
    for (const slug of ['Admin', 'has spaces', 'ab', 'a--b', 'admin', 'dashboard', 'm']) {
      const res = middleware(
        request('http://localhost/teacher/attendance', { khandaq_brand: slug })
      )
      const target = new URL(locationOf(res))
      assert.equal(target.pathname, '/login', `slug "${slug}" must not be trusted`)
    }
  })

  test('a signed-in user is redirected away from the landing page and the login page', () => {
    for (const pathname of ['/', '/login']) {
      const res = middleware(request(`http://localhost${pathname}`, { [SESSION_COOKIE]: 'true' }))
      assert.equal(res.status, 307)
      assert.equal(new URL(locationOf(res)).pathname, '/dashboard')
    }
  })

  test('a signed-out visitor still sees the landing page', () => {
    const res = middleware(request('http://localhost/'))
    assert.equal(locationOf(res), null)
  })

  test('the matcher covers the landing page and every protected area', () => {
    for (const entry of ['/', '/login', '/admin/:path*', '/teacher/:path*', '/dashboard/:path*', '/profile/:path*', '/superadmin/:path*']) {
      assert.ok(config.matcher.includes(entry), `matcher must include "${entry}"`)
    }
  })
})

describe('Role home routing', () => {
  const protectedRoute = fs.readFileSync(
    path.resolve('src/components/ProtectedRoute.tsx'),
    'utf8'
  )

  test('every role has a deterministic home screen', () => {
    assert.match(protectedRoute, /if \(role === 'superadmin'\) return hasSchool \? '\/admin' : '\/superadmin'/)
    assert.match(protectedRoute, /if \(role === 'admin'\) return '\/admin'/)
    assert.match(protectedRoute, /if \(role === 'teacher'\) return '\/teacher'/)
    assert.match(protectedRoute, /return '\/login'/)
  })

  test('the landing page and the sign-in page redirect an authenticated user home', () => {
    const landing = fs.readFileSync(path.resolve('src/app/page.tsx'), 'utf8')
    const signIn = fs.readFileSync(path.resolve('src/components/auth/SignInView.tsx'), 'utf8')

    for (const [name, source] of [
      ['landing page', landing],
      ['sign-in page', signIn],
    ]) {
      assert.match(source, /homePathFor\(user\.role, !!school\)/, `${name} must use homePathFor`)
      assert.match(source, /router\.replace\(/, `${name} must redirect`)
    }
  })

  test('the session cookie only carries the Secure flag on https', () => {
    const auth = fs.readFileSync(path.resolve('src/context/AuthContext.tsx'), 'utf8')
    assert.match(auth, /window\.location\.protocol === 'https:'/)
    assert.match(auth, /Max-Age=31536000/)
    assert.match(auth, /SameSite=Lax/)
  })
})
