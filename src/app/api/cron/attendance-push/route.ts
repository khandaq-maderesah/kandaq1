import { NextResponse } from 'next/server'
import { sendTeacherAttendancePushes } from '@/lib/attendancePushServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Scheduled endpoint (Google Cloud Scheduler, twice an evening: 16:45 and 17:10
 * Addis Ababa). Sends the "take today's attendance" push notification to every
 * Ustaz who has not taken it, from 1.5 hours before sunset (Ethiopian time; a
 * run also sends to those due within the next few minutes). Each Ustaz gets it
 * once a day; Sundays are skipped.
 *
 * Env vars:
 *   - CRON_SECRET (required)            -> `Authorization: Bearer <CRON_SECRET>`
 *   - VAPID_PRIVATE_KEY (required)      -> secret half of the Web Push key pair
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY      -> public half (also used by the browser)
 *   - VAPID_SUBJECT (optional)          -> contact URL/mailto sent to push services
 *   - APP_TIMEZONE (optional)           -> default 'Africa/Addis_Ababa'
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendTeacherAttendancePushes()
    return NextResponse.json(result)
  } catch (err) {
    console.error('Attendance push cron failed:', err)
    return NextResponse.json({ ok: false, error: 'Attendance push failed' }, { status: 500 })
  }
}
