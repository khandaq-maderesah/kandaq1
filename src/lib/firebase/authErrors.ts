/**
 * Convert a Firebase Authentication (or app-level sign-in) error into a
 * translation key under `auth.errors.*`.
 *
 * The raw SDK errors (e.g. "Firebase: Error (auth/network-request-failed).")
 * are cryptic and don't tell the user what to do next. Screens translate the
 * returned key instead:
 *
 *   const err = getAuthErrorKey(error)
 *   t(`errors.${err.key}`, { code: err.code })   // with useTranslations('auth')
 */
export type AuthErrorKey =
  | 'invalidEmail'
  | 'invalidCredential'
  | 'userDisabled'
  | 'tooManyRequests'
  | 'emailInUse'
  | 'weakPassword'
  | 'network'
  | 'unauthorizedDomain'
  | 'configuration'
  | 'accountInactive'
  | 'schoolSuspended'
  | 'noSchool'
  | 'otherMadrasa'
  | 'unknownWithCode'
  | 'unknown'

export interface AuthErrorInfo {
  /** Key under `auth.errors`. */
  key: AuthErrorKey
  /** The raw error code (may be empty). Used by `unknownWithCode`. */
  code: string
}

export function getAuthErrorKey(error: unknown): AuthErrorInfo {
  const code = getErrorCode(error)
  return { key: keyForCode(code), code }
}

/** @deprecated Use getAuthErrorKey — kept as an alias for older callers. */
export const getAuthErrorMessage = getAuthErrorKey

function keyForCode(code: string): AuthErrorKey {
  switch (code) {
    case 'auth/invalid-email':
      return 'invalidEmail'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'invalidCredential'
    case 'auth/user-disabled':
      return 'userDisabled'
    case 'auth/too-many-requests':
      return 'tooManyRequests'
    case 'auth/email-already-in-use':
      return 'emailInUse'
    case 'auth/weak-password':
      return 'weakPassword'
    case 'auth/network-request-failed':
    case 'auth/internal-error':
      return 'network'
    case 'auth/unauthorized-domain':
      return 'unauthorizedDomain'
    // Deployment problems (invalid API key, sign-in method disabled). Details
    // are logged by the caller; users only need to know whom to contact.
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
    case 'auth/operation-not-allowed':
      return 'configuration'
    case 'app/account-inactive':
      return 'accountInactive'
    case 'app/school-suspended':
      return 'schoolSuspended'
    case 'app/no-school':
      return 'noSchool'
    case 'app/other-madrasa':
      return 'otherMadrasa'
    default:
      return code ? 'unknownWithCode' : 'unknown'
  }
}

function getErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return ''
}
