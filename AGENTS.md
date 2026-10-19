# KMMS — Multi-Agent Collaboration System (MACS) & Workspace Standards

## 1. Project Overview & Tech Stack
**KMMS** (Khendeq Medresah Management System) is an enterprise-grade madrasa and student management application with real-time attendance tracking, multi-language localization, and role-based access control.

- **Framework**: Next.js 15 (App Router, Server & Client Components)
- **UI & Styling**: React 18, Tailwind CSS v3, Radix UI primitives, Lucide React icons
- **Language**: TypeScript 5.3+ (`strict: true`)
- **Backend & Database**: Firebase Authentication + Firebase Realtime Database (RTDB) + Cloud Storage
- **Admin SDK**: `firebase-admin` v14 (Server-side admin actions & scripts)
- **Internationalization (i18n)**: `next-intl` (English, Amharic, etc.)
- **Calendar System**: Gregorian & Ethiopian Calendar Date Converter (`ethiopian-calendar-date-converter`)
- **Package Manager**: `npm` (Lockfile: `package-lock.json`)

---

## 2. Multi-Agent Team Structure

| Agent Role | Identity | Core Ownership |
| :--- | :--- | :--- |
| **Lead Architect** | Antigravity (Gemini / Lead AI) | Architecture, database schemas, security rules, file locking authority, code review, git commits, phase sign-off. |
| **Specialist Implementer** | KiloCode Extension (Kilo AI) | Feature implementation, component development, unit & integration tests, linting, and local pre-verification. |

---

## 3. Communication Protocol for Non-Developer Project Owner

Every development phase or major milestone MUST conclude with a clear, non-technical 4-part summary formatted as follows:

```markdown
### Phase [X] Summary for Project Owner

1. **Done**
   - [Clear plain-English bullet 1]
   - [Clear plain-English bullet 2]
   - [Clear plain-English bullet 3]

2. **Check this**
   1. [Step 1: Open URL / page ...]
   2. [Step 2: Click on button X and verify ...]
   3. [Step 3: Confirm outcome Y appears ...]

3. **I need from you**
   - [API credentials, Firebase settings, external service tokens, or design decisions needed from the human]

4. **Risks / open issues**
   - [Known constraints, deprecations, edge cases, or items deferred to next phase]
```

---

## 4. Definition of Done (DoD)

Before any task can be marked as `MERGED` or checked off in `docs/TODO.md`:
1. **Typecheck Pass**: `npx tsc --noEmit` must return code 0 with zero errors.
2. **Lint Pass**: `npm run lint` must return code 0 with zero lint violations.
3. **Automated Verification**: Associated unit/smoke/integration tests execute and pass cleanly.
4. **Zero Plaintext Secrets**: No API secrets, service account credentials, or auth tokens committed.
5. **Verified Evidence**: Exact terminal command output must be appended to `docs/PROGRESS.md`.
6. **Lock Released**: Any file mutex acquired in `.agents/collab/BOARD.json` must be released.

---

## 5. Architectural & Safety Invariants

1. **Database & Storage Rules Integrity**:
   - `database.rules.json` and `storage.rules` define strict security boundaries.
   - Teachers (Ustaz) cannot read or write data outside their assigned madrasa or class scope.
   - Admin routes (`/admin/*`) and Admin actions must always verify role claims server-side.
2. **Pre-Migration Backup Requirement**:
   - Before any database schema change, bulk update, or backfill script is executed, `npm run backup:db` (or `node scripts/backup-db.mjs`) must be run.
3. **Terminology Consistency**:
   - The system uses Islamic educational terminology: **Madrasa** (not school), **Ustaz** (not teacher), **Student / Talib**.
4. **Dual Calendar Integrity**:
   - Dates shown to teachers and admins must consistently support both Gregorian and Ethiopian calendars without silent timezone drifting.
5. **i18n Key Completeness**:
   - Do not hardcode English strings into UI components. Use `next-intl` translation keys (`src/i18n/` and locale messages).
6. **Single-Pass Thermal Guard**:
   - Never run blocking daemon commands (`npm run dev`, `next dev`, `npm run start`, or any `--watch` flags) within automated task checks.
   - Maximum execution budget per verification run: 60 seconds.

---

## 6. Autopilot Execution Rule

- **Default Execution Mode**: Stop after completing the current task or phase, report the status, and await user direction.
- **AUTOPILOT Mode**: Continue autonomously from task to task ONLY when the user explicitly provides the prompt: `AUTOPILOT`. If interrupted or an invariant fails, immediately halt AUTOPILOT and request human intervention.
