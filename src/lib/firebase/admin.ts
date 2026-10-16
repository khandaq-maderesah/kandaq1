import {
  initializeApp,
  cert,
  getApps,
  getApp,
  applicationDefault,
  type ServiceAccount,
} from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'

/**
 * Initializes the Firebase Admin SDK for server-side operations (admin user
 * API + scheduled reminder cron). It reads credentials from one of:
 *   - FIREBASE_SERVICE_ACCOUNT  -> full JSON of the service account key
 *   - GOOGLE_APPLICATION_CREDENTIALS -> path to a service account JSON file
 * Falls back to Application Default Credentials if neither is set (this is
 * what runs on Firebase App Hosting / Cloud Run: the runtime service account).
 */
export function getAdminApp() {
  if (getApps().length > 0) return getApp()
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || ''

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as ServiceAccount
      return initializeApp({ credential: cert(sa), databaseURL })
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
    }
  }

  return initializeApp({ credential: applicationDefault(), databaseURL })
}

/** Error carrying the HTTP status an API route should respond with. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export interface Caller {
  uid: string
  role: 'superadmin' | 'admin'
  /** The admin's school; undefined for a superadmin. */
  schoolId?: string
}

/**
 * Verifies `Authorization: Bearer <idToken>` and that the caller is an active
 * superadmin or school admin. Throws HttpError(401/403) otherwise.
 */
export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!idToken) throw new HttpError(401, 'Missing sign-in token.')

  const admin = getAdminApp()
  let uid: string
  try {
    uid = (await getAuth(admin).verifyIdToken(idToken)).uid
  } catch {
    throw new HttpError(401, 'Invalid or expired sign-in. Please sign in again.')
  }

  const db = getDatabase(admin)
  const profile = (await db.ref('users/' + uid).get()).val()
  if (!profile || profile.status === 'inactive') throw new HttpError(403, 'Account is not active.')
  if (profile.role !== 'superadmin' && profile.role !== 'admin') {
    throw new HttpError(403, 'Admin privileges required.')
  }
  if (profile.role === 'admin') {
    if (!profile.schoolId) throw new HttpError(403, 'Admin is not linked to a school.')
    const status = (await db.ref(`schoolInfo/${profile.schoolId}/status`).get()).val()
    if (status !== 'active') throw new HttpError(403, 'This school is suspended.')
  }

  const caller: Caller = { uid, role: profile.role, schoolId: profile.schoolId }
  return { admin, db, caller }
}

/** Throws 403 unless the caller may manage users/data of `schoolId`. */
export function assertCanManageSchool(caller: Caller, schoolId: string | undefined) {
  if (caller.role === 'superadmin') return
  if (!schoolId || caller.schoolId !== schoolId) {
    throw new HttpError(403, 'You can only manage your own school.')
  }
}

/**
 * Mirrors role + school into the user's ID token (custom claims). Storage
 * rules use these to keep each school's files private.
 */
export async function syncUserClaims(uid: string, role: string, schoolId?: string) {
  const claims: Record<string, string> = { role }
  if (schoolId) claims.schoolId = schoolId
  await getAuth(getAdminApp()).setCustomUserClaims(uid, claims)
}

/** HTTP status for an error caught in an API route. */
export function errorStatus(err: unknown): number {
  return err instanceof HttpError ? err.status : 500
}
