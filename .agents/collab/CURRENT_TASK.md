# MACS Active Task Context

## Task Metadata
- **Task ID**: `2.5`
- **Phase**: Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish
- **Title**: Implement Ustaz Attendance Submission Monitor & Admin Push Notification Engine
- **Assigned Agent**: Specialist Implementer (`implementer` / Kilo AI)
- **Status**: `APPROVED` (Ready for Implementation)
- **Initiated At**: 2026-10-19T15:35:00+03:00

---

## Approved File Mutex Locks
The following files are approved for locking by Kilo AI (`[implementer]`):
1. `public/sw.js`
2. `src/lib/pushNotification.ts` (new)
3. `src/components/admin/UstazAttendanceMonitor.tsx` (new)
4. `src/app/admin/attendance/page.tsx`
5. `src/lib/attendanceReminder.ts`

*All other agents must treat these paths as read-only while this task is in progress.*

---

## Objectives & Acceptance Criteria
1. **Browser Push Notification Engine**:
   - Update `public/sw.js` to listen for push & notification click events, routing to `/admin/attendance`.
   - Create `src/lib/pushNotification.ts` handling permission requests, service worker registration, and notification dispatch (`sendLocalNotification(title, body, url)`).
2. **Admin Ustaz Attendance Monitor UI**:
   - Provide a live table/widget in `/admin/attendance` (and/or dashboard) displaying:
     - Ustaz name & assigned class/section.
     - Today's submission status: `Submitted` (green badge with timestamp) vs `Not Taken Yet / Missing` (red badge).
     - Filter tabs: `All`, `Submitted`, `Missing`.
     - Direct action buttons (e.g., Call/SMS Ustaz, Quick reminder).
     - Push Notification permission enable/status toggle button.
3. **Automated Push Alert Triggering**:
   - When cutoff time (`ADMIN_NOTIFY_TIME` = 18:30) is reached or reminders trigger, dispatch browser push notifications to the Admin with the list of missing Ustazes.
   - Guard against duplicate notification spam using localStorage timestamp tracking.
4. **Verification**:
   - Run `npm run verify` (`npx tsc --noEmit` + `npm run lint`) and ensure exit code 0.
