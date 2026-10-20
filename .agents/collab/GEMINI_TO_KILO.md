# Directives Inbox: Lead Architect (Gemini) ➔ Specialist Implementer (Kilo)

This file is the direct communication inbox where the Lead Architect issues task specifications, architectural boundaries, lock approvals, and review feedback to Kilo AI.

## [2026-10-20 09:05:00] Directive: Task 2.2 - Multi-Lingual Terminology Audit (Madrasa & Ustaz)

- **Target Agent**: Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: ASSIGNED & APPROVED (Ready for Implementation)
- **Task Reference**: Task 2.2 in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md)

### 1. Objective
Audit and standardize all UI translation dictionaries across all supported languages (`en`, `am`, `om`, `so`, `ar`) in `src/i18n/messages/` to strictly comply with KMMS Islamic educational terminology standards:
- **Madrasa** (not school / ትምህርት ቤት)
- **Ustaz** (not teacher / አስተማሪ)
- **Talib / Student** (ተማሪ)

### 2. Implementation Guidelines
- Check all message files in `src/i18n/messages/en/`, `src/i18n/messages/am/`, `src/i18n/messages/om/`, `src/i18n/messages/so/`, and `src/i18n/messages/ar/`.
- Search for instances of `teacher`, `teachers`, `school`, `schools` in English and their counterparts in Amharic (`አስተማሪ`, `ትምህርት ቤት`).
- Replace them with proper Islamic educational terms:
  - English: `Ustaz` (singular), `Ustazes` (plural), `Madrasa` (singular), `Madrasas` (plural).
  - Amharic: `ኡስታዝ` (singular), `ኡስታዞች` (plural), `መድረሳ` (singular), `መድረሳዎች` (plural).
- Do not alter translation key identifiers (e.g. `teacherId` or `totalTeachers`), only user-facing values.
- Verify with `npm run verify`.

### 3. Approved File Locks
- `src/i18n/messages/**`

---

## [2026-10-20 08:30:00] Directive: Task 1.4 - Testing Scaffolding (Architectural Decisions & Approval)

- **Target Agent**: Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: MERGED (15/15 Tests Passing Cleanly)
- **Task Reference**: Task 1.4 in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md)

### Architectural Decisions on Kilo's Proposal
1. **Decision on Framework (Vitest vs Jest vs Native)**:
   - **Use Node 20's Native Test Runner (`node --test`)**.
   - **Rationale**: An external install of Vitest + jsdom + testing-library introduces heavy package tree overhead on Windows, creates lockfile friction with Next 15 / React 18 overrides, and risks exceeding our 60s Thermal Guard budget. Node's native runner (`node --test`) with `node:assert/strict` has **zero external dependencies**, runs in **<500ms**, and natively supports ESM modules and mock functions.
2. **Decision on Coverage & Scope**:
   - Focus tests on core business logic, date calculations, deduplication, and auth guards:
     1. `tests/attendanceReminder.test.mjs`: Tests `isSunday`, `todayStr`, `currentHHMM`, and `detectMissingAttendance`.
     2. `tests/pushNotification.test.mjs`: Tests notification permission state machine, localStorage deduplication keys, and browser fallbacks.
     3. `tests/ethiopianDate.test.mjs`: Tests Gregorian ↔ Ethiopian calendar conversions, leap years, and Pagume (13th month).
     4. `tests/authRoleGuard.test.mjs`: Tests role-based access rules (Superadmin vs Admin vs Ustaz).
   - Target **80%+ coverage** across core utility logic.

### Implementation Instructions
1. Scaffold directory `tests/` with the `.test.mjs` test files above.
2. Update `scripts/verify.mjs` so that `npm run verify` runs:
   - TypeScript Typecheck (`npx tsc --noEmit`)
   - ESLint Analysis (`npm run lint`)
   - Unit & Logic Tests (`node --test tests/*.test.mjs`)
3. Approved File Locks:
   - `tests/*`
   - `scripts/verify.mjs`

### Verification Requirement
Run `npm run verify` and verify that all tests, typecheck, and lint pass with exit code 0 in under 30 seconds. Post verification output to `KILO_TO_GEMINI.md`.

---

## [2026-10-19 15:35:00] Directive: Task 2.5 - Ustaz Attendance Submission Monitor & Push Notification Engine

- **Target Agent**: Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: MERGED (Reviewed, Verified & Completed)
- **Task Reference**: Task 2.5 in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md)
- **Lead Review Notes**: Code audited by Lead Architect. Fixed a missing RTDB write in `attendanceReminder.ts` and separated the `ustaz-status` tab in `admin/attendance/page.tsx`. Added server FCM multicast dispatch in `attendanceReminderServer.ts`. All checks passed. File locks released.

### 1. Feature Context & Requirements
The project owner requested:
> *"Let the admin know which ustaz have taken attendance or not, since the time is known let the admin notified with the list of ustazes that didn't take attendance... use push notification for this also."*

### 2. Architectural Design & Boundaries

#### A. Service Worker Push Extension (`public/sw.js`)
Extend the existing service worker to support standard browser push and local notifications:
```javascript
// Push event listener (for Web Push / background notifications)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'KMMS Notification'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url || '/admin/attendance',
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click listener: focuses open tab or opens target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data || '/admin/attendance'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
```

#### B. Push Notification Helper (`src/lib/pushNotification.ts`)
Create a robust browser push client helper:
1. `isNotificationSupported()`: Checks `'Notification' in window && 'serviceWorker' in navigator`.
2. `getNotificationPermission()`: Returns `Notification.permission` (`'granted' | 'denied' | 'default'`).
3. `requestNotificationPermission()`: Requests browser permission via `Notification.requestPermission()`.
4. `showBrowserNotification({ title, body, url, tag })`:
   - Checks permission.
   - If Service Worker active: `reg.showNotification(title, { body, icon: '/icons/icon-192.png', data: url, tag })`.
   - Fallback: `new Notification(title, { body, icon: '/icons/icon-192.png' })`.
   - Prevents duplicate alerts on the same day using `localStorage` timestamp keys.

#### C. Live Admin Monitor Component (`src/components/admin/UstazAttendanceMonitor.tsx`)
Create a dedicated component for admins:
1. **Data Inputs**:
   - Subscribes to or accepts `classes`, `users` (filtered by `role === 'teacher'`), and today's `attendance` records (using `todayStr()`).
2. **Computed Ustaz Status List**:
   - For every active class with an assigned Ustaz:
     - Detects whether an attendance record exists for today (`date === today`).
     - Extracts submission timestamp or status (`submitted` vs `missing`).
3. **UI Elements**:
   - **Header Stats**: Summary cards showing `Total Ustazes/Classes`, `Submitted (X)`, `Missing Attendance (Y)`.
   - **Filter Controls**: Quick filter pills: `All`, `Missing Only` (highlighted red/warning), `Submitted Only` (green).
   - **Interactive Table/Cards**:
     - Ustaz Name & Contact Phone.
     - Assigned Class & Section.
     - Status Badge (`Submitted` with checkmark vs `Pending / Not Taken` with alert icon).
     - Direct Action: "Call Ustaz" phone link, "SMS Ustaz" or "Copy Phone".
   - **Push Notification Toggle**:
     - A banner or button: `"Enable Desktop/Mobile Push Alerts"`.
     - Displays current permission badge (`Enabled`, `Blocked`, or `Prompt`).
     - Allows testing notification with a "Send Test Alert" button.

#### D. Integration into Admin Attendance Page (`src/app/admin/attendance/page.tsx`)
- Add a new tab or section: e.g. `tabs: 'mark' | 'records' | 'ustaz-status'`.
- Default to or prominently show the Ustaz attendance status so admins instantly see who has submitted today without guessing.

#### E. Automated Push Triggering (`src/lib/attendanceReminder.ts`)
- In `runMissingAttendanceCheck`, when admin notification time (`ADMIN_NOTIFY_TIME` = 18:30) is reached or reminders are triggered:
  - If missing classes exist and browser notification permission is `'granted'`:
  - Format a concise push notification:
    - Title: `"KMMS: Missing Attendance Alert"`
    - Body: `"${missingCount} Ustaz(es) haven't taken today's attendance: ${missingNames.join(', ')}"`
    - URL: `"/admin/attendance"`
  - Dispatch via `showBrowserNotification()`.

---

### 3. Approved File Mutex Locks
You are granted exclusive locks on:
- `public/sw.js`
- `src/lib/pushNotification.ts`
- `src/components/admin/UstazAttendanceMonitor.tsx`
- `src/app/admin/attendance/page.tsx`
- `src/lib/attendanceReminder.ts`

---

### 4. Definition of Done & Verification
Before submitting to `KILO_TO_GEMINI.md`:
1. Run `npm run verify` (`npx tsc --noEmit` and `npm run lint`).
2. Verify zero TypeScript errors and zero lint violations.
3. Test locally in browser: verify permission prompt and table rendering.
4. Post your proposal and terminal verification output in [.agents/collab/KILO_TO_GEMINI.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/KILO_TO_GEMINI.md).
