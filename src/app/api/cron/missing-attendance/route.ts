import { NextResponse } from 'next/server'
import { runMissingAttendanceCheckServer } from '@/lib/attendanceReminderServer'

export const dynamic = 'force-dynamic'

/**
 * Scheduled endpoint for Vercel Cron.
 * The client-side scheduler handles the case where the app is open; this route
 * guarantees the reminders fire at the set times even when nobody is logged in.
 *
 * Env vars:
 *   - CRON_SECRET (optional)         -> if set, requests must carry
 *                                       `Authorization: Bearer <CRON_SECRET>`
 *   - APP_TIMEZONE (optional)        -> default 'Asia/Karachi'
 *   - FIREBASE_SERVICE_ACCOUNT       -> service account JSON (or
 *                                       GOOGLE_APPLICATION_CREDENTIALS path)
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  const hasAdminCreds =
    !!process.env.FIREBASE_SERVICE_ACCOUNT || !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!hasAdminCreds) {
    return NextResponse.json({
      ok: true,
      configured: false,
      reason: 'Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT)',
    })
  }

  try {
    const result = await runMissingAttendanceCheckServer()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Missing attendance cron failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
