/**
 * Maps the `code` returned by /api/admin/* (see ApiErrorCode in
 * src/lib/firebase/admin.ts, plus Firebase Auth codes) to a key under
 * `common.errors.api`, so the message is shown in the user's language.
 */
export type ApiErrorKey =
  | 'emailInUse'
  | 'invalidEmail'
  | 'weakPassword'
  | 'sessionExpired'
  | 'forbidden'
  | 'schoolSuspended'
  | 'otherSchool'
  | 'notFound'
  | 'cannotDeleteSelf'
  | 'invalid'
  | 'generic'

const KEYS: Record<string, ApiErrorKey> = {
  'auth/email-already-exists': 'emailInUse',
  'auth/invalid-email': 'invalidEmail',
  'auth/invalid-password': 'weakPassword',
  'session-expired': 'sessionExpired',
  forbidden: 'forbidden',
  'school-suspended': 'schoolSuspended',
  'other-school': 'otherSchool',
  'not-found': 'notFound',
  'cannot-delete-self': 'cannotDeleteSelf',
  invalid: 'invalid',
}

export function apiErrorKey(data: unknown): ApiErrorKey {
  const code = (data as { code?: unknown } | null)?.code
  return (typeof code === 'string' && KEYS[code]) || 'generic'
}

/** An error whose message is already translated (safe to show to the user). */
export class TranslatedError extends Error {}
