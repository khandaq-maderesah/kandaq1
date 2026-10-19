---
name: project-task
description: >-
  Executes a specific task given its task ID (e.g., 1.2). Acquires file mutex locks in
  BOARD.json, sets up CURRENT_TASK.md, guides implementation, runs verification,
  and logs results to docs/PROGRESS.md.
---

# Project Task Execution Skill

Use this skill to execute a single task end-to-end adhering strictly to MACS concurrency rules and the Definition of Done.

## Parameters
- **Task ID**: Numbered task ID from `docs/TODO.md` (e.g. `1.1`, `1.2`, `2.1`).

## Execution Workflow

```
[Acquire Locks in BOARD.json]
             ▼
[Update CURRENT_TASK.md]
             ▼
[Implement Code Changes]
             ▼
[Run /project-verify (tsc + lint)]
             ▼
[Append Terminal Proof to PROGRESS.md]
             ▼
[Release Locks in BOARD.json & Mark Checked in TODO.md]
```

### Step 1: Pre-Execution Lock Acquisition
1. Locate the task details in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md).
2. Identify all files to be created or modified.
3. Open [.agents/collab/BOARD.json](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/BOARD.json):
   - Confirm none of the target files are currently locked in `active_locks`.
   - Add entries in `active_locks`:
     ```json
     "path/to/target.ts": "lead"
     ```
   - Set task status to `IN_PROGRESS`.
4. Populate [.agents/collab/CURRENT_TASK.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/CURRENT_TASK.md).

### Step 2: Implementation
1. Perform required edits or additions while respecting invariants:
   - Preserve database rules and security boundaries.
   - Use `next-intl` translation keys for UI text.
   - Strictly follow TypeScript types.
   - Do not commit secrets or unvetted credentials.

### Step 3: Verification (Single-Pass Thermal Guard)
1. Execute the verification sequence:
   ```powershell
   npx tsc --noEmit
   npm run lint
   ```
2. If any failure occurs, repair immediately within the active task context.

### Step 4: Documentation & Progress Logging
1. Open [docs/PROGRESS.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/PROGRESS.md).
2. Append a chronological entry containing:
   - Task ID, title, timestamp.
   - Summary of changes made.
   - Verbatim terminal output from the verification commands.
   - Architectural decisions or notes.

### Step 5: Post-Execution Cleanup
1. Check off the task in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md):
   ```markdown
   - [x] Task 1.2: Description [lead]
   ```
2. In [.agents/collab/BOARD.json](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/BOARD.json):
   - Clear the acquired entries from `active_locks`.
   - Update task status to `MERGED`.
3. If this was the final task in a phase, invoke `/project-end-phase`.
