'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { useLogin } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Lock, Mail, Loader2, KeyRound } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')
  const [sending, setSending] = useState(false)

  const loginUser = useLogin()
  const router = useRouter()

  const handleForgotPassword = async () => {
    setResetMsg('')
    setResetError('')
    if (!email.trim()) {
      setResetError('Please enter your email address.')
      return
    }
    setSending(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetMsg('Password reset email sent. Please check your inbox.')
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (forgotMode) {
      await handleForgotPassword()
      return
    }

    setIsLoading(true)

    const result = await loginUser(email, password)

    if (result.success) {
      // Go straight to the right dashboard. The `profile` was read during
      // login, so we skip the extra /dashboard -> /admin (or /teacher)
      // navigation and its accompanying layout + fresh data subscriptions.
      const role = result.profile?.role
      const next =
        role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/dashboard'
      router.replace(next)
    } else {
      setError(result.error || 'Login failed')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-700 via-blue-600 to-purple-700 p-4">
      <Card className="w-full max-w-md rounded-2xl border-0 shadow-2xl">
        <CardHeader className='space-y-1 pt-8'>
          <div className='mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-lg ring-2 ring-indigo-500/20'>
            <Image src='/image/logo2.jpg' alt='Khandaq Madresah logo' width={64} height={64} className='h-full w-full object-cover' />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Khandaq Madresah Attendance
          </CardTitle>
          <CardDescription className="text-center">
            {forgotMode ? 'Reset your password' : 'Sign in to your account to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {forgotMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {resetError && (
                  <Alert variant="destructive">
                    <AlertDescription>{resetError}</AlertDescription>
                  </Alert>
                )}
                {resetMsg && (
                  <Alert variant="success">
                    <AlertDescription>{resetMsg}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Send Password Reset Link
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-gray-600">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(false)
                      setResetMsg('')
                      setResetError('')
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Back to sign in
                  </button>
                </p>
              </>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@khandaqmadresah.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </>
            )}
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Need access? Contact the madresah administrator to create your account.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
