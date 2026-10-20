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
import { withTimeout } from '@/lib/asyncUtils'

interface LoginResult {
  credential: UserCredential
  /** User profile read from the Realtime Database right after sign-in. */
  profile: User | null
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  /** True when the device has no network connection right now. */
  offline: boolean
  /**
   * True when the session could not be resolved in time (usually because the
   * network is gone). The UI shows the offline screen instead of spinning.
   */
  stalled: boolean
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
    return selected ? await withTimeout(getSchool(selected), 2000).catch(() => null) : null
  }

  if (!profile.schoolId) throw accessError('app/no-school')

  // If offline, retrieve cached school immediately without network hang
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached =
      localStorage.getItem('kmms_cached_school_' + profile.schoolId) ||
      localStorage.getItem('kmms_last_active_school')
    if (cached) {
      try {
        return JSON.parse(cached) as School
      } catch {
        /* ignore */
      }
    }
  }

  try {
    const school = await withTimeout(getSchool(profile.schoolId), 2500)
    if (!school) throw accessError('app/no-school')
    if (school.status === 'suspended') throw accessError('app/school-suspended')
    try {
      localStorage.setItem('kmms_cached_school_' + profile.schoolId, JSON.stringify(school))
      localStorage.setItem('kmms_last_active_school', JSON.stringify(school))
    } catch {
      /* ignore */
    }
    return school
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      throw err // accessError
    }
    // Try cached school if network failed or timed out
    if (typeof window !== 'undefined') {
      const cached =
        localStorage.getItem('kmms_cached_school_' + profile.schoolId) ||
        localStorage.getItem('kmms_last_active_school')
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
  // Synchronous offline-first hydration from localStorage so the app never hangs on startup
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem('kmms_last_active_user')
      if (cached) return JSON.parse(cached) as User
    } catch {
      /* ignore */
    }
    return null
  })

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)

  const [school, setSchool] = useState<School | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cached = localStorage.getItem('kmms_last_active_school')
      if (cached) return JSON.parse(cached) as School
    } catch {
      /* ignore */
    }
    return null
  })

  // If the browser is offline and we already have a cached profile, never show the full-screen spinner
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const cached = localStorage.getItem('kmms_last_active_user')
        if (cached) return false
      } catch {
        /* ignore */
      }
    }
    return true
  })

  const [branding, setBranding] = useState<PublicBranding | null>(null)
  const [brandingTick, setBrandingTick] = useState(0)
  const { setLocale } = useLocaleSettings()

  // The device's connection state, kept live so the UI can say "offline"
  // instead of looking frozen.
  const [offline, setOffline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false
    return !navigator.onLine
  })

  // Set when the session could not be resolved in time.
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

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
    if (typeof window !== 'undefined') {
      try {
        if (next) localStorage.setItem('kmms_last_active_school', JSON.stringify(next))
        else localStorage.removeItem('kmms_last_active_school')
      } catch {
        /* ignore */
      }
    }
  }, [])

  const clearSession = useCallback(async () => {
    document.cookie = 'khandaq_session=; path=/; Max-Age=0'
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('kmms_last_active_user')
        localStorage.removeItem('kmms_last_active_school')
      } catch {
        /* ignore */
      }
    }
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
    let settled = false

    // Safety timeout: Ensure loading flips to false within 2s max (or 100ms if offline)
    // so offline mobile devices NEVER hang on the rotating loader screen.
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    const safetyTimer = setTimeout(() => {
      if (!settled) {
        if (typeof window !== 'undefined') {
          try {
            const cachedUserStr = localStorage.getItem('kmms_last_active_user')
            if (cachedUserStr) {
              const profile = JSON.parse(cachedUserStr) as User
              setUser(profile)
              applyProfileLocale(profile)
              const cachedSchoolStr = localStorage.getItem('kmms_last_active_school')
              if (cachedSchoolStr) {
                applySchool(JSON.parse(cachedSchoolStr) as School)
              }
            }
          } catch {
            /* ignore */
          }
        }
        // The session did not resolve in time: the UI must say so instead of
        // spinning forever.
        setStalled(true)
        setLoading(false)
      }
    }, isOffline ? 100 : 2000)

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)

      if (fbUser) {
        writeSessionCookie()

        // If currently offline, restore profile and school from local cache immediately
        // and do NOT attempt network RTDB requests that will hang indefinitely.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached =
            localStorage.getItem('kmms_cached_user_' + fbUser.uid) ||
            localStorage.getItem('kmms_last_active_user')
          if (cached) {
            try {
              const profile = JSON.parse(cached) as User
              setUser(profile)
              const cachedSchoolStr = profile.schoolId
                ? localStorage.getItem('kmms_cached_school_' + profile.schoolId) ||
                  localStorage.getItem('kmms_last_active_school')
                : null
              if (cachedSchoolStr) {
                applySchool(JSON.parse(cachedSchoolStr) as School)
              }
              applyProfileLocale(profile)
            } catch {
              /* ignore */
            }
          }
          settled = true
          clearTimeout(safetyTimer)
          setLoading(false)
          return
        }

        // Online: fetch user data with a strict timeout so it never hangs
        try {
          const snapshot = await withTimeout(get(ref(db, 'users/' + fbUser.uid)), 2500)
          if (snapshot.exists()) {
            const profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: fbUser.uid } as User
            try {
              localStorage.setItem('kmms_cached_user_' + fbUser.uid, JSON.stringify(profile))
              localStorage.setItem('kmms_last_active_user', JSON.stringify(profile))
            } catch {
              /* ignore */
            }
            const resolvedSchool = await withTimeout(resolveSchool(profile), 2500).catch(() => null)
            if (resolvedSchool) {
              applySchool(resolvedSchool)
            }
            applyProfileLocale(profile)
            setUser(profile)
          }
        } catch (error) {
          // If network / offline error, restore from local cache rather than signing out
          const cached =
            typeof window !== 'undefined'
              ? localStorage.getItem('kmms_cached_user_' + fbUser.uid) ||
                localStorage.getItem('kmms_last_active_user')
              : null
          if (cached) {
            try {
              const profile = JSON.parse(cached) as User
              setUser(profile)
              const cachedSchoolStr = profile.schoolId
                ? localStorage.getItem('kmms_cached_school_' + profile.schoolId) ||
                  localStorage.getItem('kmms_last_active_school')
                : null
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
        // Only clear session if we are actually online
        if (typeof navigator === 'undefined' || navigator.onLine) {
          document.cookie = 'khandaq_session=; path=/; Max-Age=0'
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('kmms_last_active_user')
              localStorage.removeItem('kmms_last_active_school')
            } catch {
              /* ignore */
            }
          }
          applySchool(null)
          setUser(null)
        }
      }

      settled = true
      clearTimeout(safetyTimer)
      setLoading(false)
    })

    return () => {
      settled = true
      clearTimeout(safetyTimer)
      unsubscribe()
    }
  }, [applySchool, applyProfileLocale, clearSession])

  // Load the public branding whenever the current school changes.
  useEffect(() => {
    let active = true
    if (!school) {
      setBranding(null)
      return
    }
    // Offline: branding is decoration, never block on it.
    if (offline) {
      setBranding(null)
      return
    }
    withTimeout(getPublicBranding(school.id), 2500)
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
  }, [school, user, brandingTick, offline])

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
    const snapshot = await withTimeout(get(userRef), 4000)
    let profile: User | null = null
    if (snapshot.exists()) {
      profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: result.user.uid } as User
      try {
        localStorage.setItem('kmms_cached_user_' + result.user.uid, JSON.stringify(profile))
        localStorage.setItem('kmms_last_active_user', JSON.stringify(profile))
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
      await update(userRef, { lastLogin: new Date().toISOString() }).catch(() => {
        /* ignore background lastLogin error */
      })
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
      offline,
      stalled,
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
