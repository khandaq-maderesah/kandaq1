# Core Operating Invariants & Execution Rules

This rule is **always active** across all directories and all agent workflows within the KMMS workspace.

---

## 1. Single Task Focus
- Work on **exactly one TODO item at a time**.
- Do not multitask across different items in `docs/TODO.md`. Complete, verify, and log the active item before starting the next.
- Maintain `CURRENT_TASK.md` updated with the active task ID and locked files.

---

## 2. Evidence-Based Verification (Zero Hallucinations)
- **Never claim** that a test, typecheck, build, or lint passed without executing the command and showing the actual terminal output.
- Any completion claim lacking terminal output in `docs/PROGRESS.md` is strictly invalid.
- Command outputs must be recorded verbatim with timestamps.

---

## 3. Mandatory Progress & Human Queue Maintenance
- **Update `docs/PROGRESS.md`**:
  - Log every completed task with its task ID, description, timestamp, architectural notes, and exact verification terminal output.
- **Update `docs/HUMAN-TODO.md`**:
  - Immediately log any blocker, required Firebase credentials, third-party API keys (e.g., SMS provider credentials), or owner design sign-offs into `docs/HUMAN-TODO.md`.
  - Never leave human-dependent items buried in chat transcripts or generic markdown notes.

---

## 4. File Concurrency & Mutex Protocol
- Inspect `.agents/collab/BOARD.json` before modifying any file.
- If a target file is listed in `active_locks` by another agent, it is **strictly read-only**.
- Release file locks immediately upon task verification and merge.

---

## 5. Thermal Guard & Zero-Freeze Execution
- **Strictly single-pass commands**:
  - Typecheck: `npx tsc --noEmit`
  - Linting: `npm run lint`
- **Never spawn live background dev servers** (`npm run dev`, `next dev`, `npm run start`, or any command with `--watch`) during automated verification.
- **Max 60-second budget**: Verification commands must terminate within 60 seconds.

---

## 6. Autopilot Protocol
- Proceed automatically to the next task only if the user explicitly commanded `AUTOPILOT`.
- In standard mode, halt after completing and logging the active task, present the status, and await user direction.
