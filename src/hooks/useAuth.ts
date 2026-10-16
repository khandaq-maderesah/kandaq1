'use client'

import { useAuth } from '@/context/AuthContext'
import { getAuthErrorKey } from '@/lib/firebase/authErrors'

export function useLogin() {
  const { login } = useAuth()
  
  const loginUser = async (email: string, password: string, opts?: { schoolId?: string }) => {
    try {
      const { credential, profile } = await login(email, password, opts)
      return { success: true as const, user: credential.user, profile }
    } catch (error) {
      const info = getAuthErrorKey(error)
      if (info.key === 'configuration' || info.key === 'unknownWithCode' || info.key === 'unknown') {
        console.error('Sign-in failed', error)
      }
      // `error` is a translation key under `auth.errors` (plus the raw code).
      return {
        success: false as const,
        error: info,
      }
    }
  }
  
  return loginUser
}

export function useLogout() {
  const { logout } = useAuth()
  
  const logoutUser = async () => {
    try {
      await logout()
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Logout failed' 
      }
    }
  }
  
  return logoutUser
}

export function useUser() {
  const { user, loading } = useAuth()
  return { user, loading }
}

export function useIsAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin
}

export function useIsTeacher() {
  const { isTeacher } = useAuth()
  return isTeacher
}