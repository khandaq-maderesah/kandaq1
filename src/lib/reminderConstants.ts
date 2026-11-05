// Shared reminder timing constants used by both the client-side scheduler and
// the server-side cron endpoint so the times never drift apart.
// The Ustaz is reminded an hour and a half before sunset (see lib/sunset.ts:
// about 16:30 to 17:20 in Ethiopia depending on the season); the admin 18:30.
export const ADMIN_NOTIFY_TIME = '18:30'
/** Fallback only: the real Ustaz time is `teacherReminderTime(date)` from lib/sunset.ts. */
export const TEACHER_NOTIFY_TIME = '16:45'
export const CHECK_INTERVAL_MS = 60_000
