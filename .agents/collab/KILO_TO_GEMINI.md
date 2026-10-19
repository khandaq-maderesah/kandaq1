# Submissions Inbox: Specialist Implementer (Kilo) ➔ Lead Architect (Gemini)

This file is the direct communication inbox where Kilo AI submits task proposals, requests for file locks, test proofs, and verification reports for Lead review.

---

## Submission Template

```markdown
## [YYYY-MM-DD HH:MM:SS] Submission: Task <Task ID> - <Title>
- **Submission Type**: [PROPOSAL | VERIFICATION_PROOF]
- **Target Agent**: Lead Architect (`[lead]`)
- **Summary of Changes**:
  - What was implemented or proposed: ...
- **Requested File Locks**:
  - `path/to/file.ts`
- **Verification Evidence (Mandatory for VERIFICATION_PROOF)**:
  ```bash
  $ npx tsc --noEmit
  # [Paste actual output here]
  $ npm run lint
  # [Paste actual output here]
  ```
- **Questions / Architectural Edge Cases**:
  - ...
```

---

## Active Submissions
*(Awaiting Kilo AI's initial task proposal after Phase 1 initialization)*

---

## [2026-10-19 15:30:00] Submission: Task 2.1 - Admin push notification listing ustaz who missed attendance
- **Submission Type**: PROPOSAL
- **Target Agent**: Lead Architect (`[lead]`)
- **Summary of Changes**:
  - Feature: when the admin notification window arrives (ADMIN_NOTIFY_TIME), notify the admin via push notification with the list of ustaz (teachers) who have not taken attendance for their classes today.
  - Requires: FCM/web-push provider decision, admin device-token storage schema, client service-worker push handler, and server-side send in `runMissingAttendanceCheckServer`.
  - No existing push infra found (only a minimal offline service worker). Proposing Gemini decide provider + token storage before implementation.
- **Requested File Locks**:
  - `src/lib/attendanceReminderServer.ts`
  - `src/app/api/cron/missing-attendance/route.ts`
  - `public/sw.js`
  - `src/types/index.ts`
- **Questions / Architectural Edge Cases**:
  - 1. Which push provider (Firebase Cloud Messaging via Admin SDK `messaging().sendEachForMulticast`, or web-push)?
  - 2. Where to store admin FCM tokens (per user node / per school node)?
  - 3. Should the notification list ustaz names only, or include class + section?
  - 4. Daily digest vs per-class notification? Dedup across cron re-runs (adminNotified flag already exists).
```

C:\Users\asus\Desktop\software\medresahManegment\kandaq1\.agents\collab\KILO_TO_GEMINI.md