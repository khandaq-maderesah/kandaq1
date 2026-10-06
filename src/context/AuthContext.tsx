'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  UserCredential
} from 'firebase/auth'
import { auth, db } from '@/lib/firebase/config'
import { ref, get, update } from 'firebase/database'
import { User } from '@/types'

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
  isAdmin: boolean
  isTeacher: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      
      if (fbUser) {
        // Let server-side middleware know the user is signed in (non-httpOnly defense-in-depth)
        document.cookie = 'ansar_session=true; path=/; SameSite=Lax; Max-Age=86400'
        // Fetch user data from Realtime Database
        try {
          const userRef = ref(db, 'users/' + fbUser.uid)
          const snapshot = await get(userRef)
          if (snapshot.exists()) {
            const userData = snapshot.val() as Omit<User, 'uid'>
            setUser({
              uid: fbUser.uid,
              ...userData,
            })
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
        }
      } else {
        document.cookie = 'ansar_session=; path=/; Max-Age=0'
        setUser(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)

    // Set the session cookie *synchronously here* — the middleware decides access
    // based on this cookie, and it is NOT guaranteed to be written yet when
    // `onAuthStateChanged` fires. Setting it here prevents a logged-in user from
    // being bounced straight back to /login right after signing in.
    document.cookie = 'ansar_session=true; path=/; SameSite=Lax; Max-Age=86400'
    setFirebaseUser(result.user)

    // Load the profile immediately so the caller can redirect straight to the
    // right dashboard without an intermediate /dashboard hop.
    const userRef = ref(db, 'users/' + result.user.uid)
    await update(userRef, {
      lastLogin: new Date().toISOString()
    })
    const snapshot = await get(userRef)
    let profile: User | null = null
    if (snapshot.exists()) {
      const userData = snapshot.val() as Omit<User, 'uid'>
      profile = {
        uid: result.user.uid,
        ...userData,
      }
      setUser(profile)
    }

    return { credential: result, profile }
  }

  const logout = async () => {
    document.cookie = 'ansar_session=; path=/; Max-Age=0'
    await signOut(auth)
    setUser(null)
    setFirebaseUser(null)
  }

  const isAdmin = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      login, 
      logout, 
      isAdmin, 
      isTeacher 
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
