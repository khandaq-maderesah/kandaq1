import { NextResponse } from 'next/server'
import { runMissingAttendanceCheckServer } from '@/lib/attendanceReminderServer'
import { sendAdminUnsentSmsPushes } from '@/lib/attendancePushServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Scheduled endpoint (Google Cloud Scheduler, or Vercel Cron).
 * The client-side scheduler handles the case where the app is open; this route
 * guarantees the reminders fire at the set times even when nobody is logged in.
 * The same evening run also sends each admin a push notification listing the
 * Ustazes who saved absent students but did not text the parents.
 *
 * Env vars:
 *   - CRON_SECRET (required)         -> requests must carry
 *                                       `Authorization: Bearer <CRON_SECRET>`
 *   - APP_TIMEZONE (optional)        -> default 'Africa/Addis_Ababa'
 *   - Admin credentials              -> on GCP (App Hosting / Cloud Run) the
 *                                       runtime service account is used
 *                                       automatically; elsewhere set
 *                                       FIREBASE_SERVICE_ACCOUNT or
 *                                       GOOGLE_APPLICATION_CREDENTIALS
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runMissingAttendanceCheckServer()
    // A failed notification must not hide the result of the reminder check.
    const adminSmsPush = await sendAdminUnsentSmsPushes().catch((err) => {
      console.error('Admin unsent-SMS push failed:', err)
      return { ok: false, configured: true, schools: [] }
    })
    return NextResponse.json({ ...result, adminSmsPush })
  } catch (err) {
    console.error('Missing attendance cron failed:', err)
    return NextResponse.json(
      { ok: false, error: 'Missing attendance check failed' },
      { status: 500 }
    )
  }
}
