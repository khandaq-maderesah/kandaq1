# KMMS Development Progress & Verification Log

This chronological log tracks all completed tasks, architectural decisions, and verbatim terminal verification outputs.

---

## [2026-10-19 15:20:00] Task 1.1: Initialize MACS collaboration framework, rules, board, and documentation

- **Assigned Agent**: Lead Architect (`[lead]` / Antigravity Gemini)
- **Status**: Completed & Verified

### Summary of Changes
1. Created root configuration files:
   - `AGENTS.md`: Outlining KMMS tech stack, roles (Lead Architect Antigravity vs Specialist Implementer Kilo AI), 4-part owner communication protocol, Definition of Done, safety invariants, and AUTOPILOT execution rule.
   - `GEMINI.md`: Entry point directing the Lead Architect to master documentation, role mandates, and startup procedures.
2. Initialized `.agents/collab/` collaboration suite:
   - `BOARD.json`: Real-time agent statuses, active file mutex locks, and task lifecycle schema.
   - `RULES.md`: Hierarchical authority, file mutex locking rules, thermal guard (single-pass, max 60s), and state machine.
   - `MESSAGES.md`: Append-only communication log with standard headers (`[PROPOSAL]`, `[APPROVAL]`, `[VERIFIED]`, `[MERGED]`).
   - `CURRENT_TASK.md`: Live context tracker for active task metadata and locked files.
   - `GEMINI_TO_KILO.md`: Dedicated inbox for Lead directives to Kilo.
   - `KILO_TO_GEMINI.md`: Dedicated inbox for Kilo proposals and test submissions to Lead.
   - `README.md`: Mermaid sequence diagram and dual-agent quickstart guide.
3. Created always-on operating rules and Antigravity skills:
   - `.agents/rules/00-operating.md`: Single-task focus, evidence-based verification, and human queue rules.
   - `.agents/skills/project-verify/SKILL.md`: Single-pass typecheck and lint verification.
   - `.agents/skills/project-next-phase/SKILL.md`: Task backlog scanner and coordinator.
   - `.agents/skills/project-task/SKILL.md`: Mutex-guarded task executor.
   - `.agents/skills/project-end-phase/SKILL.md`: Invariant auditor and 4-part owner summary generator.
4. Created project backlog and documentation tracking:
   - `docs/TODO.md`: Unified backlog partitioned across 4 phases with task IDs and role assignees.
   - `docs/PROGRESS.md`: Chronological progress log.
   - `docs/HUMAN-TODO.md`: Human decision and credential intake queue.
   - `docs/PHASES.md`: Milestone roadmap with acceptance criteria.
   - `docs/VERSIONS.md`: Verified dependency versions and official references.

### Architectural Decisions
- Enforced single-pass unbuffered commands to eliminate IDE hanging.
- Set up bidirectional inboxes (`GEMINI_TO_KILO.md` and `KILO_TO_GEMINI.md`) alongside append-only board `MESSAGES.md` for clean asynchronous handoffs.
- Reserved git commit privileges and file lock authority exclusively to the Lead Architect.

### Verification Evidence

```text
> npx tsc --noEmit
Exit Code: 0
Diagnostic errors: 0

> npm run lint
> kmms@1.0.0 lint
> eslint .
Exit Code: 0
Lint errors: 0
```

---

## [2026-10-19 15:23:00] Task 1.2: Implement unified verification script and Thermal Guard runner

- **Assigned Agent**: Specialist Implementer (`[implementer]`) / Lead Review
- **Status**: Completed & Verified

### Summary of Changes
1. Created `scripts/verify.mjs`:
   - Single-pass non-interactive execution of `npx tsc --noEmit` and `npm run lint`.
   - Built-in 60,000ms timeout per step enforcing Thermal Guard.
   - ANSI color formatting with explicit `[PASS]` and `[FAIL]` status indicators and timing.
2. Wired `package.json` scripts:
   - Added `"verify": "node scripts/verify.mjs"`
   - Added `"test": "node scripts/verify.mjs"`

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (14.08s)
Checking ESLint Static Analysis... [PASS] (44.80s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-19 15:41:00] Task 2.5: Implement Ustaz Attendance Submission Monitor & Admin Push Notification Engine

- **Assigned Agents**: Specialist Implementer (`[implementer]` / Kilo AI) & Lead Architect (`[lead]` / Antigravity Gemini)
- **Status**: Completed & Verified

### Summary of Changes
1. **Service Worker Push & Notification Click**:
   - Updated `public/sw.js` with `push` event listener and `notificationclick` handler focusing the window and routing to `/admin/attendance`.
2. **Push Notification Service (`src/lib/pushNotification.ts`)**:
   - Implemented `isNotificationSupported`, `getNotificationPermission`, `requestNotificationPermission`, and `showBrowserNotification`.
   - Handled duplicate alert prevention via daily localStorage tag keying.
3. **Live Ustaz Attendance Monitor (`src/components/admin/UstazAttendanceMonitor.tsx`)**:
   - Built a comprehensive dashboard widget displaying total, submitted, and missing counts.
   - Filter tabs: `All`, `Missing Only` (red alert border), and `Submitted Only`.
   - Direct Ustaz call/SMS links (`tel:`, `sms:`), copy phone number action, and real-time status badges.
   - Interactive push notification enable/test action banner.
4. **Admin Attendance Integration (`src/app/admin/attendance/page.tsx`)**:
   - Added `'ustaz-status'` tab to the attendance navigation.
   - Integrated `<UstazAttendanceMonitor />` with live class, user, and attendance feeds.
5. **Scheduler & Automated Dispatch (`src/lib/attendanceReminder.ts` & `src/lib/attendanceReminderServer.ts`)**:
   - Client: triggers `showBrowserNotification` with list of missing Ustaz names when admin cutoff time (`ADMIN_NOTIFY_TIME` = 18:30) is reached.
   - Server: added Firebase Cloud Messaging multicast dispatch in `attendanceReminderServer.ts` targeting registered `adminPushTokens`.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (5.35s)
Checking ESLint Static Analysis... [PASS] (6.61s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-19 15:56:00] Task 1.3: Audit environment configuration (.env.example), Firebase rules, and backup automation

- **Assigned Agent**: Lead Architect (`[lead]` / Antigravity Gemini)
- **Status**: Completed & Verified

### Summary of Changes
1. **Environment Configuration Audit**:
   - Overhauled `.env.example` with clear sections: Firebase client keys, server-side Admin SDK (`FIREBASE_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`), Cron configuration (`CRON_SECRET`, `APP_TIMEZONE`), Seed Admin options, and Phase 4 SMS placeholders.
2. **Realtime Database Security Rules Audit**:
   - Updated `scripts/generate-db-rules.py` to add strict security rules for `adminPushTokens` (only admin/superadmin of school can read/write) and `pushTokens` (only user/superadmin can read/write).
   - Regenerated `database.rules.json` and validated JSON schema.
3. **Backup Automation Audit**:
   - Audited `scripts/backup-db.mjs` prebuild checks and verified safety conditions for CI/cloud deployments.

### Verification Evidence
```text
> python scripts/generate-db-rules.py
ok

> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (5.70s)
Checking ESLint Static Analysis... [PASS] (7.05s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-20 09:02:00] Task 1.4: Establish component testing scaffolding for core UI and auth guards

- **Assigned Agent**: Specialist Implementer (`[implementer]` / Kilo AI) & Lead Architect (`[lead]` / Antigravity Gemini)
- **Status**: Completed & Verified

### Summary of Changes
1. **ESLint & Path Resolution Configuration**:
   - Added `"tests/**"` to `eslint.config.mjs` ignores so test files are excluded from Next.js web vitals linter.
   - Restored missing attendance auto-resolve loop in `src/lib/attendanceReminderServer.ts` resolving unused `recordedKeys` variable.
2. **Native Node.js 24 Test Suite**:
   - Implemented `tests/attendanceReminder.test.mjs` (5 tests for `isSunday`, `todayStr`, `currentHHMM`, `isPastHHMM`, and `detectMissingAttendance`).
   - Implemented `tests/ethiopianDate.test.mjs` (5 tests for `ETHIOPIAN_MONTHS`, `toEthiopianParts`, `ethiopianDateShort`, `ethiopianDateLabel`, and invalid date fallbacks).
   - Implemented `tests/pushNotification.test.mjs` (5 tests for browser/headless detection, permission states, and non-throwing fallbacks).
3. **Verification Pipeline Integration**:
   - Updated `scripts/verify.mjs` to execute unit tests as a 3rd verification stage via `npx tsx --test`.
   - All 15 tests execute cleanly with zero external framework dependencies.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (38.36s)
Checking ESLint Static Analysis... [PASS] (53.40s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (19.71s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-20 09:30:00] Tasks 2.1, 2.2, 2.3, 2.4: Phase 2 Sign-off & Repository Hardening

- **Assigned Agents**: Lead Architect (`[lead]` / Antigravity Gemini) & Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: Completed, Verified & Merged
- **Phase**: Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish (100% Complete)

### Summary of Changes
1. **Task 2.1 (RTDB Rules & Ustaz Role Scoping)**:
   - Audited all security rules in `database.rules.json` and `scripts/generate-db-rules.py`.
   - Hardened `studentPhotos/$studentId/photo` with `.validate: !newData.exists() || (newData.isString() && newData.val().length < 150000)` preventing payload bloat.
   - Enforced class-scoped teacher isolation via `PHOTO_CLASS_TEACHER` and `NEW_CLASS_TEACHER`.
   - Added `tests/authRoleGuard.test.mjs` (4 tests).
2. **Task 2.2 (Multi-Lingual Terminology Audit)**:
   - Audited all 27 translation namespaces across 5 locales (`en`, `am`, `om`, `so`, `ar`) in `src/i18n/messages/`.
   - Verified that user-facing strings consistently enforce Islamic educational standards (Madrasa / Ustaz / Talib).
   - Created `tests/i18nTerminology.test.mjs` (3 tests) validating no prohibited terms (`school`, `teacher`, `አስተማሪ`, `ትምህርት ቤት`) appear in translation values.
3. **Task 2.3 (Student Photo Compression & Cloud Storage Rules)**:
   - Verified client-side downscaling and compression in `src/components/StudentPhotoCapture.tsx` (`MAX_DIMENSION = 360`, `JPEG_QUALITY = 0.62`, payload 15-35 KB).
   - Audited `storage.rules` confirming strict size boundaries (25MB announcements, 2MB PNG branding, catch-all deny).
   - Added `tests/photoStorage.test.mjs` (3 tests).
4. **Task 2.4 (Database Backup & Restore Pipeline)**:
   - Refactored `scripts/restore-students-from-backup.mjs` to support modern multi-tenant `schoolData` JSON backups alongside legacy flat backups and gzipped archives.
   - Added exported parsing and validation utilities with CLI execution guards.
   - Added automated dry-run test suite `tests/backupRestore.test.mjs` (5 tests).
5. **Unified Verification Expansion**:
   - Expanded test runner to 7 test suites containing 30 automated tests (`tests/*.test.mjs`).
   - All tests execute cleanly in under 4 seconds via native Node test runner.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (7.20s)
Checking ESLint Static Analysis... [PASS] (8.45s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (3.77s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-20 09:42:00] Tasks 3.1, 3.2, 3.3: Phase 3 Sign-off & Dual-Calendar Analytics Engine

- **Assigned Agents**: Lead Architect (`[lead]` / Antigravity Gemini) & Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: Completed, Verified & Merged
- **Phase**: Phase 3: Dual-Calendar & Attendance Analytics Engine (100% Complete)

### Summary of Changes
1. **Task 3.1 (Ethiopian Calendar Edge Cases)**:
   - Expanded `tests/ethiopianDate.test.mjs` with comprehensive edge cases.
   - Tested Enkutatash (Ethiopian New Year 2017: 2024-09-11), Pagume month 13 (2024-09-06 -> 2016-13-01), Gregorian year boundary transition (2024-12-31 to 2025-01-01 within Tahsas 2017), and ISO timestamp / timezone robustness (6 tests).
2. **Task 3.2 (High-Performance Attendance Overview Aggregation)**:
   - Created `src/lib/attendanceAnalytics.ts` with `aggregateAttendanceOverview()`.
   - Replaced multiple array filter/find passes with O(1) Maps for users, classes, and active students.
   - Built single-pass demographic gender breakdown and 7-day daily attendance classification (present, absent, late, excused).
   - Created `tests/attendanceAggregation.test.mjs` (3 tests) including high-volume benchmark (processes 2,000 students and 10,000 attendance records in < 26ms).
3. **Task 3.3 (Superadmin Multi-Madrasa Dashboard Analytics)**:
   - Implemented real-time search input by madrasa name, city/address, or slug in `src/app/superadmin/page.tsx`.
   - Added filter pill buttons (`All`, `Active`, `Suspended`).
   - Enhanced platform-wide metric computation (active vs suspended madrasas, total ustazes, total admins, average ustazes per madrasa).
   - Created `tests/superadminAnalytics.test.mjs` (3 tests).
4. **Verification Expansion**:
   - Expanded test runner to 9 test suites containing 37 automated unit & logic tests (`tests/*.test.mjs`).
   - All 37 tests execute in under 5 seconds with zero external package dependencies.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (13.35s)
Checking ESLint Static Analysis... [PASS] (8.58s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (4.06s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-20 09:49:00] Tasks 4.1, 4.2, 4.3: Phase 4 Sign-off & Notifications/Student ID Infrastructure

- **Assigned Agents**: Lead Architect (`[lead]` / Antigravity Gemini) & Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: Completed, Verified & Merged
- **Phase**: Phase 4: Notifications & Student Identification Infrastructure (100% Complete)

### Summary of Changes
1. **Task 4.1 (Pluggable SMS Provider Client Adapter)**:
   - Created `src/lib/server/smsAdapter.ts` with pluggable `SmsProvider` interface.
   - Built `SandboxSmsProvider` for zero-cost, in-memory simulated delivery during development and tests.
   - Built `AfroMessageSmsProvider` for production Ethiopian SMS delivery (AfroMessage HTTP API).
   - Added phone number normalizer `normalizePhoneNumber` converting Ethiopian local numbers (`09...`, `07...`, `251...`) into E.164 international standard (`+251...`).
   - Created `tests/smsAdapter.test.mjs` (5 tests).
2. **Task 4.2 (Human Credentials & Production SMS Webhook Gateway)**:
   - Created authenticated Admin API route `src/app/api/admin/sms/route.ts` requiring Admin/Superadmin session and school management authorization.
   - Implemented automatic RTDB audit log recording under `schoolData/{schoolId}/audit` for every dispatched SMS.
   - Documented production SMS gateway environment variables (`SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_NAME`, `SMS_IDENTIFIER_ID`) in `.env.example`.
3. **Task 4.3 (Printable Student ID Card Batch Generator with Barcode Verification)**:
   - Created `src/lib/idCardBarcode.ts` with verification code generation (`KMMS-{ROLL}-{HASH}`) and scalable Code 39 SVG barcode generator.
   - Built `src/components/admin/PrintableStudentIdCard.tsx` with standard CR80 credit-card dimensions (85.6mm x 54mm) and `@media print` 2x4 batch grid layout for A4 printing.
   - Created `tests/idCardBarcode.test.mjs` (3 tests).
4. **Complete Repository Test Suite**:
   - Expanded test runner to 11 test suites containing 45 automated unit & logic tests (`tests/*.test.mjs`).
   - All 45 tests execute cleanly in under 4 seconds via native Node test runner.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (5.60s)
Checking ESLint Static Analysis... [PASS] (8.10s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (3.91s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```

---

## [2026-10-20 10:40:00] Phase 5: Offline PWA, Persistent Auth & Custom Madrasa App Icon

- **Assigned Agents**: Lead Architect (`[lead]` / Antigravity Gemini) & Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: Completed, Verified & Merged
- **Phase**: Phase 5: Offline PWA, Persistent Auth & Custom Madrasa App Icon (100% Complete)

### Summary of Changes
1. **Task 5.1 (Persistent Auth & Auto-Logout Elimination)**:
   - Root cause diagnosed and eliminated: `src/lib/firebase/config.ts` was previously forcing `browserSessionPersistence`, clearing tokens on window close.
   - Upgraded to `browserLocalPersistence` and extended the `khandaq_session` cookie from 24h to 1 year (`Max-Age=31536000`).
   - Added offline user profile and school caching (`kmms_cached_user_*`, `kmms_cached_school_*`) in `src/context/AuthContext.tsx`. When offline, `resolveSchool()` and `onAuthStateChanged` recover from device cache instead of triggering `clearSession()`.
2. **Task 5.2 (Dynamic Root PWA App Icon & Manifest)**:
   - Made `src/app/manifest.ts` dynamic and async, reading the `khandaq_brand` cookie and public branding from Realtime Database.
   - When a madrasa has uploaded a custom logo (`logoVersion > 0`), the PWA install manifest dynamically serves the custom high-resolution icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`). The generic default logo is never shown when custom branding is present.
3. **Task 5.3 (Offline Attendance Engine & Auto-Sync Hook)**:
   - Built `src/lib/offlineAttendance.ts` with local device queueing, deduplication by `id`, and batch synchronization to Firebase RTDB.
   - Added `teacherId` and `markedBy` to the offline record payload to satisfy RTDB security rule `database.rules.json:138`.
   - Built `src/hooks/useOfflineAttendanceSync.ts` with real-time online/offline network listeners and auto-sync trigger on reconnect.
4. **Task 5.4 (Teacher Attendance Page Offline Mode & UI Banner)**:
   - Updated `src/app/teacher/attendance/page.tsx` with local caching for assigned classes and enrolled students.
   - Wired offline fallback into `handleSave`: if offline or if network fails, attendance is safely queued on device.
   - Added a pixel-perfect, responsive offline/sync status banner displaying network state, queued records count, and a manual "Sync Now" trigger with localized strings across all 5 languages (`en`, `am`, `ar`, `om`, `so`).
5. **Task 5.5 (Service Worker Pre-caching & Verification Suite)**:
   - Upgraded `public/sw.js` to `v2` with pre-caching for navigation routes (`/`, `/login`, `/dashboard`, `/teacher/attendance`, `/teacher/classes`) and app icons in the `install` event.
   - Added `tests/offlineAttendance.test.mjs` with comprehensive queue, sync, resilience, and payload invariant tests.
   - Single-pass verification runner (`scripts/verify.mjs`) verified 62/62 tests passing cleanly across 12 test suites in under 35 seconds.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (12.34s)
Checking ESLint Static Analysis... [PASS] (9.52s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (12.69s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0
```


---

## [2026-10-20 10:55:00] Task 5.5 - Multi-Device PWA Smoke Verification & Ustaz Offline Sync Edge Testing (Implementer: Kilo AI)

### Summary of Changes
1. **PWA Smoke Verification Suite** (`tests/pwaOffline.test.mjs`, 29 tests / 4 suites):
   - Dynamic manifest contract: async route export, `display: standalone`, `orientation: portrait`, root scope, 192 + 512 + maskable icon triplet (default and branded), every referenced `/icons/*` file exists in `public/icons`, default identity matches `DEFAULT_APP_FULL_NAME` / `DEFAULT_APP_NAME`, branding resolved from the `khandaq_brand` cookie, generic icon only replaced when `branding.logoVersion` is set.
   - Service worker pre-cache integrity: all lifecycle handlers registered, `skipWaiting()` + `clients.claim()`, versioned cache with stale-cache purge, **every precached route resolves to a real App Router page**, every precached asset exists in `/public`, `/api/*` and cross-origin bypass, navigation fallback points at a precached route, HTTP 503 offline response.
   - Persistent auth contracts: `browserLocalPersistence` in use, `browserSessionPersistence` removed, 1-year session cookie, cached user + madrasa profile, sign-out only reached when no cache exists.
   - 12 Ustaz offline-sync edge cases: queue survives an app restart, storage-quota failure cannot break marking, mixed-date records sync oldest-first, a failed record is retried first and keeps its queue position, corrupted queue cannot break auto-sync, 500-record roster syncs within budget, connectivity detection, offline queue storage-key contract, class list + student roster cached for offline marking, cloud-write failure always falls back to the device queue.
2. **Payload Invariant Suite** (`tests/offlineAttendancePayload.test.mjs`, 3 tests) - locks the `database.rules.json:138` contract: `teacherId`/`markedBy` must exist on the queue type, on every offline enqueue payload, and must be forwarded by the sync hook.
3. **Offline Queue Hardening** - the Lead-authored `tests/offlineAttendance.test.mjs` tests were kept intact and 7 hardening tests appended (corrupted / non-array payload resilience, multi-class coexistence, owner-field round trip, payload fidelity, non-`Error` rejection safety, true online/offline detection, server-side no-op safety).
4. **i18n Completeness** - added a locale key-parity invariant to `tests/i18nTerminology.test.mjs` (it immediately caught the missing `offline.*` keys in `om` and `so`), translated the remaining offline toast keys into all 5 locales (`en`, `am`, `ar`, `om`, `so`) and wired them so the offline flow contains no hardcoded English.

### Verification Evidence
```text
> kmms@1.0.0 verify
> node scripts/verify.mjs

========================================
KMMS SINGLE-PASS VERIFICATION RUNNER
========================================

Checking TypeScript Typecheck... [PASS] (6.53s)
Checking ESLint Static Analysis... [PASS] (8.62s)
Checking Unit & Logic Tests (Node Test Runner)... [PASS] (17.05s)

========================================
STATUS: ALL VERIFICATION CHECKS PASSED
========================================
Exit Code: 0

$ npx tsx --test tests/<14 suites>
info tests 91
info suites 16
info pass 91
info fail 0
info cancelled 0
info skipped 0
info todo 0
info duration_ms 2369.9142
```
