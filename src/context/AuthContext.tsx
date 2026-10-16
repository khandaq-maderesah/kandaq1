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
import { getSchool, setCurrentSchoolId } from '@/lib/database'
import type { School, User } from '@/types'

interface LoginResult {
  credential: UserCredential
  /** User profile read from the Realtime Database right after sign-in. */
  profile: User | null
}

interface AuthContextType {
  user: User | null
  firebaseUser: FirebaseUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<LoginResult>
  logout: () => Promise<void>
  /** Admin of the current school (a superadmin who opened a school counts too). */
  isAdmin: boolean
  isTeacher: boolean
  isSuperAdmin: boolean
  /** The school whose data the app is showing, or null (superadmin, none opened). */
  school: School | null
  /** Superadmin only: open a school's admin area (null = back to all schools). */
  selectSchool: (schoolId: string | null) => Promise<void>
  /** Re-read the current school's info (after it is edited). */
  refreshSchool: () => Promise<void>
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
  const school = await getSchool(profile.schoolId)
  if (!school) throw accessError('app/no-school')
  if (school.status === 'suspended') throw accessError('app/school-suspended')
  return school
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)

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
        // Let server-side middleware know the user is signed in (non-httpOnly defense-in-depth)
        document.cookie = 'khandaq_session=true; path=/; SameSite=Lax; Max-Age=86400'
        // Fetch user data from Realtime Database
        try {
          const snapshot = await get(ref(db, 'users/' + fbUser.uid))
          if (snapshot.exists()) {
            const profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: fbUser.uid } as User
            applySchool(await resolveSchool(profile))
            setUser(profile)
          }
        } catch (error) {
          // Suspended school / deactivated account / missing school: sign out.
          console.error('Error loading user profile:', error)
          await clearSession()
        }
      } else {
        document.cookie = 'khandaq_session=; path=/; Max-Age=0'
        applySchool(null)
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [applySchool, clearSession])

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)

    // Set the session cookie *synchronously here* — the middleware decides access
    // based on this cookie, and it is NOT guaranteed to be written yet when
    // `onAuthStateChanged` fires. Setting it here prevents a logged-in user from
    // being bounced straight back to /login right after signing in.
    document.cookie = 'khandaq_session=true; path=/; SameSite=Lax; Max-Age=86400'
    setFirebaseUser(result.user)

    // Load the profile immediately so the caller can redirect straight to the
    // right dashboard without an intermediate /dashboard hop.
    const userRef = ref(db, 'users/' + result.user.uid)
    const snapshot = await get(userRef)
    let profile: User | null = null
    if (snapshot.exists()) {
      profile = { ...(snapshot.val() as Omit<User, 'uid'>), uid: result.user.uid } as User
      try {
        applySchool(await resolveSchool(profile))
      } catch (err) {
        await clearSession()
        throw err
      }
      await update(userRef, { lastLogin: new Date().toISOString() })
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
