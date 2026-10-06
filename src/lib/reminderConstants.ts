// Shared reminder timing constants used by both the client-side scheduler and
// the server-side cron endpoint so the times never drift apart.
// Teacher is reminded first (18:00 = sunset), admin 30 minutes later (18:30).
export const ADMIN_NOTIFY_TIME = '18:30'
export const TEACHER_NOTIFY_TIME = '18:00'
export const CHECK_INTERVAL_MS = 60_000
