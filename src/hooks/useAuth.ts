'use client'

import { useAuth } from '@/context/AuthContext'
import { getAuthErrorMessage } from '@/lib/firebase/authErrors'

export function useLogin() {
  const { login } = useAuth()
  
  const loginUser = async (email: string, password: string) => {
    try {
      const { credential, profile } = await login(email, password)
      return { success: true as const, user: credential.user, profile }
    } catch (error) {
      return { 
        success: false as const, 
        error: getAuthErrorMessage(error) 
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