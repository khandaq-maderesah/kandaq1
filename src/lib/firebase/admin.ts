import {
  initializeApp,
  cert,
  getApps,
  getApp,
  applicationDefault,
  type ServiceAccount,
} from 'firebase-admin/app'

/**
 * Initializes the Firebase Admin SDK for server-side operations (the scheduled
 * reminder cron). It reads credentials from one of:
 *   - FIREBASE_SERVICE_ACCOUNT  -> full JSON of the service account key
 *   - GOOGLE_APPLICATION_CREDENTIALS -> path to a service account JSON file
 * Falls back to Application Default Credentials if neither is set.
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
