/**
 * Convert a Firebase Authentication error into a friendly, actionable message.
 *
 * The raw SDK errors (e.g. "Firebase: Error (auth/network-request-failed).")
 * are cryptic and don't tell the user what to do next. Dashboard/sign-in pages
 * should surface these human-readable messages instead.
 */
export function getAuthErrorMessage(error: unknown): string {
  const code = getErrorCode(error)

  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the administrator.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/network-request-failed':
    case 'auth/internal-error':
      return (
        'Check your internet connection, ' +
        'disable any ad-blocker, VPN, or proxy, and try again.'
      )
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized to sign in. Add it under ' +
        'Firebase Console > Authentication > Settings > Authorized domains.'
    case 'auth/api-key-not-valid':
      return 'The Firebase API key is invalid. Check your .env.local configuration.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this project. ' +
        'Enable it in Firebase Console > Authentication > Sign-in method.'
    default:
      if (code) {
        return `Login failed (${code}). Please try again.`
      }
      return 'Login failed. Please try again.'
  }
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}