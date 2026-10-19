# MACS Active Task Context

## Task Metadata
- **Task ID**: `1.4`
- **Phase**: Phase 1: Multi-Agent Collaboration Infrastructure & Repository Hardening
- **Title**: Establish component testing scaffolding for core UI and auth guards
- **Assigned Agent**: Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: `APPROVED` (Ready for Implementation)
- **Initiated At**: 2026-10-19T15:57:00+03:00

---

## Approved File Mutex Locks
The following files/directories are approved for Kilo AI (`[implementer]`):
1. `tests/*` (new test suite directory)
2. `scripts/verify.mjs` (to integrate test runner into `npm run verify`)

*All other agents must treat these paths as read-only while this task is active.*

---

## Objectives & Acceptance Criteria
1. Create lightweight, zero-dependency unit tests using Node 20's native test runner (`node --test`):
   - `tests/attendanceReminder.test.mjs`: Test `isSunday`, `todayStr`, `currentHHMM`, and `detectMissingAttendance`.
   - `tests/pushNotification.test.mjs`: Test permission states, mock browser environment, and storage deduplication keys.
   - `tests/ethiopianDate.test.mjs`: Test Ethiopian calendar conversion edge cases (leap years, Pagume month).
2. Wire tests into `scripts/verify.mjs` so `npm run verify` runs typecheck, lint, and unit tests in under 30 seconds.
3. Ensure zero lint and typecheck errors with `npm run verify`.
