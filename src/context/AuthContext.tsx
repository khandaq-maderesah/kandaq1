'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  UserCredential
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase/config'
import { ref, get, update } from 'firebase/database'
import { getPublicBranding, getSchool, setCurrentSchoolId } from '@/lib/database'
import type { PublicBranding } from '@/lib/branding'
import { rememberBrandSlug } from '@/lib/brandMemory'
import type { School, User } from '@/types'
import { useLocaleSettings } from '@/i18n/I18nProvider'
import { isLocale } from '@/i18n/config'

interface LoginResult {
  credential: UserCredential
  /** User profile read from the Realtime Database right after sign-in. */
  profile: User | null
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  /**
   * Signs in. With `schoolId` (the branded /m/{slug} sign-in page), only that
   * madrasa's accounts are accepted; a platform admin opens that madrasa.
   */
  login: (email: string, password: string, opts?: { schoolId?: string }) => Promise<LoginResult>
  logout: () => Promise<void>
  /** Admin of the current school (a superadmin who opened a school counts too). */
  isAdmin: boolean
  isTeacher: boolean
  isSuperAdmin: boolean
  /** The school whose data the app is showing, or null (superadmin, none opened). */
  school: School | null
  /** Superadmin only: open a school's admin area (null = back to all schools). */
  selectSchool: (schoolId: string | null) => Promise<void>
  /** Re-read the current school's info and branding (after they are edited). */
  refreshSchool: () => Promise<void>
  /** Public branding of the current school (link, app name, logo), if set up. */
  branding: PublicBranding | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Remembers which school a superadmin last opened (per browser tab session).
const SELECTED_SCHOOL_KEY = 'khandaq_selected_school'

function readSelectedSchool(): string | null {
  try {
    return sessionStorage.getItem(SELECTED_SCHOOL_KEY)
  } catch {
    return null
  }
}

function writeSelectedSchool(schoolId: string | null) {
  try {
    if (schoolId) sessionStorage.setItem(SELECTED_SCHOOL_KEY, schoolId)
    else sessionStorage.removeItem(SELECTED_SCHOOL_KEY)
  } catch {
    /* ignore */
  }
}

/** Error carrying a code that getAuthErrorMessage() turns into a friendly message. */
function accessError(code: string): Error {
  return Object.assign(new Error(code), { code })
}

/**
 * Resolves which school a profile works in and checks the account may use the
 * app. Throws an accessError for inactive accounts or suspended schools.
 */
async function resolveSchool(profile: User): Promise<School | null> {
  if (profile.status === 'inactive') throw accessError('app/account-inactive')

  if (profile.role === 'superadmin') {
    const selected = readSelectedSchool()
    return selected ? await getSchool(selected) : null
  }

  if (!profile.schoolId) throw accessError('app/no-school')
  try {
    const school = await getSchool(profile.schoolId)
    if (!school) throw accessError('app/no-school')
    if (school.status === 'suspended') throw accessError('app/school-suspended')
    try {
      localStorage.setItem('kmms_cached_school_' + profile.schoolId, JSON.stringify(school))
    } catch {
      /* ignore */
    }
    return school
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      throw err // accessError
    }
    // Try cached school if network failed
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('kmms_cached_school_' + profile.schoolId)
      if (cached) {
        try {
          return JSON.parse(cached) as School
        } catch {
          /* ignore */
        }
      }
    }
    throw err
  }
}

function writeSessionCookie() {
  if (typeof document === 'undefined') return
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `khandaq_session=true; path=/; SameSite=Lax; Max-Age=31536000${isSecure}`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [branding, setBranding] = useState<PublicBranding | null>(null)
  const [brandingTick, setBrandingTick] = useState(0)
  const { setLocale } = useLocaleSettings()

  // A signed-in user's saved language wins over this browser's choice.
  const applyProfileLocale = useCallback(
    (profile: User) => {
      if (isLocale(profile.language)) setLocale(profile.language)
    },
    [setLocale]
  )

  const applySchool = useCallback((next: School | null) => {
    setCurrentSchoolId(next?.id ?? null)
    setSchool(next)
  }, [])

  const clearSession = useCallback(async () => {
    document.cookie = 'khandaq_session=; path=/; Max-Age=0'
    writeSelectedSchool(null)
    applySchool(null)
    setUser(null)
    setFirebaseUser(null)
    try {
      await signOut(auth)
    } catch {
      /* ignore */
    }
  }, [applySchool])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)

      if (fbUser) {
        // Keep session alive for 1 year (31,536,000s) across app reopens
        writeSessionCookie()
        // Fetch user data from Realtime Database
        try {
          const snapshot = await get(ref(db, 'users/' + fbUser.uid))
          if (snapshot.exists()) {
            const profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: fbUser.uid } as User
            try {
              localStorage.setItem('kmms_cached_user_' + fbUser.uid, JSON.stringify(profile))
            } catch {
              /* ignore */
            }
            applySchool(await resolveSchool(profile))
            applyProfileLocale(profile)
            setUser(profile)
          }
        } catch (error) {
          // If network / offline error, restore from local cache rather than signing out
          const cached = typeof window !== 'undefined' ? localStorage.getItem('kmms_cached_user_' + fbUser.uid) : null
          if (cached) {
            try {
              const profile = JSON.parse(cached) as User
              setUser(profile)
              const cachedSchoolStr = profile.schoolId ? localStorage.getItem('kmms_cached_school_' + profile.schoolId) : null
              if (cachedSchoolStr) {
                applySchool(JSON.parse(cachedSchoolStr) as School)
              }
              applyProfileLocale(profile)
            } catch {
              await clearSession()
            }
          } else {
            console.error('Error loading user profile:', error)
            await clearSession()
          }
        }
      } else {
        document.cookie = 'khandaq_session=; path=/; Max-Age=0'
        applySchool(null)
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [applySchool, applyProfileLocale, clearSession])

  // Load the public branding whenever the current school changes.
  useEffect(() => {
    let active = true
    if (!school) {
      setBranding(null)
      return
    }
    getPublicBranding(school.id)
      .then((b) => {
        if (!active) return
        setBranding(b)
        // Staff of a madrasa come back to its branded sign-in page next time.
        if (b?.slug && user && user.role !== 'superadmin') rememberBrandSlug(b.slug)
      })
      .catch(() => active && setBranding(null))
    return () => {
      active = false
    }
  }, [school, user, brandingTick])

  const login = async (email: string, password: string, opts?: { schoolId?: string }) => {
    const result = await signInWithEmailAndPassword(auth, email, password)

    // Set the session cookie *synchronously here* — the middleware decides access
    // based on this cookie, and it is NOT guaranteed to be written yet when
    // `onAuthStateChanged` fires. Setting it here prevents a logged-in user from
    // being bounced straight back to /login right after signing in.
    writeSessionCookie()
    setFirebaseUser(result.user)

    // Load the profile immediately so the caller can redirect straight to the
    // right dashboard without an intermediate /dashboard hop.
    const userRef = ref(db, 'users/' + result.user.uid)
    const snapshot = await get(userRef)
    let profile: User | null = null
    if (snapshot.exists()) {
      profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: result.user.uid } as User
      try {
        localStorage.setItem('kmms_cached_user_' + result.user.uid, JSON.stringify(profile))
      } catch {
        /* ignore */
      }
      try {
        if (opts?.schoolId) {
          // Branded sign-in: the account must belong to this madrasa.
          if (profile.role === 'superadmin') writeSelectedSchool(opts.schoolId)
          else if (profile.schoolId !== opts.schoolId) throw accessError('app/other-madrasa')
        }
        applySchool(await resolveSchool(profile))
      } catch (err) {
        await clearSession()
        throw err
      }
      await update(userRef, { lastLogin: new Date().toISOString() })
      applyProfileLocale(profile)
      setUser(profile)
    }

    return { credential: result, profile }
  }

  const logout = async () => {
    await clearSession()
  }

  const selectSchool = async (schoolId: string | null) => {
    if (user?.role !== 'superadmin') return
    const next = schoolId ? await getSchool(schoolId) : null
    writeSelectedSchool(next?.id ?? null)
    applySchool(next)
  }

  const refreshSchool = async () => {
    if (!school) return
    applySchool(await getSchool(school.id))
    setBrandingTick((n) => n + 1)
  }

  const isSuperAdmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || (isSuperAdmin && !!school)
  const isTeacher = user?.role === 'teacher'

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      login,
      logout,
      isAdmin,
      isTeacher,
      isSuperAdmin,
      school,
      selectSchool,
      refreshSchool,
      branding,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
