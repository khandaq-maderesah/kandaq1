# Multi-Agent Collaboration System (MACS) — Rules & Protocols

This document defines the operating rules, authority hierarchy, file concurrency protocols, and thermal protection guardrails for the dual-agent environment operating on KMMS.

---

## 1. Hierarchy & Authority Structure

```
                  ┌───────────────────────────────┐
                  │       Non-Developer Owner     │
                  │   (Signs off phases, secrets) │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   Lead Architect (Gemini)     │
                  │ • Architecture & Schemas      │
                  │ • File Locking Authority      │
                  │ • Final Review & Git Commits  │
                  └───────────────┬───────────────┘
                                  │ Directives & Approvals
                                  ▼
                  ┌───────────────────────────────┐
                  │ Specialist Implementer (Kilo) │
                  │ • Feature Implementation      │
                  │ • Unit & Integration Testing  │
                  │ • Lint & Local Verification   │
                  └───────────────────────────────┘
```

1. **Lead Architect (Antigravity / Gemini)**:
   - Holds final authority over repository architecture, schemas (`database.rules.json`, `storage.rules`, types), package dependencies, and directory structures.
   - Manages task approvals, locks, verification reviews, and all git commits.
   - Formats the 4-part summary for the project owner.
2. **Specialist Implementer (KiloCode / Kilo AI)**:
   - Owns implementation of approved tasks, component styling, hook logic, unit/integration tests, and local pre-verification.
   - Never commits directly to git; submits implementation and terminal test logs to the Lead for review and merging.

---

## 2. File Mutex Protocol (Concurrency Control)

To guarantee that two agents never create merge conflicts or clobber each other's work:

1. **Check Before Write**:
   - Before modifying any file, an agent MUST inspect `.agents/collab/BOARD.json` under `active_locks`.
   - If a file path is listed under `active_locks`, it is **strictly read-only** to all other agents.
2. **Acquiring a Lock**:
   - When a task moves to `IN_PROGRESS`, the assigned agent records the target file paths in `.agents/collab/BOARD.json` under `active_locks` (e.g. `"src/components/StudentList.tsx": "implementer"`).
   - Wildcards are permitted only during major scaffolding (e.g. `".agents/*": "lead"`).
3. **Lock Scope Minimization**:
   - Locks must be requested strictly for files needed for the immediate task. Never lock the entire repository.
4. **Releasing Locks**:
   - Upon moving a task to `MERGED` or upon explicit task cancellation, the locking agent must remove the lock entries from `active_locks` in `BOARD.json`.

---

## 3. Thermal Guard & Zero-Freeze Execution Policy

To prevent IDE lockups, hanging processes, and resource exhaustion:

1. **No Background Watchers or Daemon Servers**:
   - Never execute `npm run dev`, `next dev`, `npm run start`, or any command with `--watch` inside background verification tasks.
   - If a dev server is required for visual inspection, it must be explicitly declared as a separate long-running daemon process or run manually.
2. **Single-Pass, Unbuffered Execution Only**:
   - Verification commands must be deterministic single-pass runs:
     - Typecheck: `npx tsc --noEmit`
     - Linting: `npm run lint`
     - Test runs: Single execution run, non-interactive.
3. **Strict 60-Second Execution Budget**:
   - Every verification command has a hard cap of 60 seconds.
   - If a command does not complete within 60 seconds, it must be terminated, treated as a failure, and investigated for hanging loops or interactive prompts.

---

## 4. Task Lifecycle State Machine

Every item from `docs/TODO.md` transitions through the following 6 states:

```
[ BACKLOG ] ──▶ [ PROPOSED ] ──▶ [ APPROVED ] ──▶ [ IN_PROGRESS ] ──▶ [ VERIFICATION ] ──▶ [ MERGED ]
                                                                             │
                                                                   Fail DoD  ▼
                                                             [ IN_PROGRESS (Fix) ]
```

| Lifecycle State | Description | Permitted Action | Responsible Agent |
| :--- | :--- | :--- | :--- |
| `BACKLOG` | Documented in `docs/TODO.md`. Not yet queued. | Prioritization | Lead Architect |
| `PROPOSED` | Implementer prepares plan, file list, and test strategy. | Post proposal to `MESSAGES.md` | Implementer |
| `APPROVED` | Lead reviews architectural contract, approves file locks. | Grant locks in `BOARD.json` | Lead Architect |
| `IN_PROGRESS` | Implementation underway. Files locked. | Edit locked files | Implementer |
| `VERIFICATION` | Code complete. Typecheck, lint, and tests executed. | Post logs in `MESSAGES.md` | Implementer |
| `MERGED` | Lead audits code, verifies clean DoD, commits to git, releases locks. | Git commit, release lock | Lead Architect |

---

## 5. Violation Handling

- **Lock Collision**: If an agent attempts to edit a locked file without holding the lock, the edit must immediately be reverted and a warning logged in `MESSAGES.md`.
- **Unverified Claims**: Any claim that a task is complete without terminal proof in `docs/PROGRESS.md` is automatically rejected.
