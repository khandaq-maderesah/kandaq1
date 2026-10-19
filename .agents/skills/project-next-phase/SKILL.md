---
name: project-next-phase
description: >-
  Scans docs/TODO.md for the next unchecked task, validates current mutex locks,
  updates BOARD.json, and initializes the next active task.
---

# Project Next Phase & Task Discovery Skill

Use this skill when resuming work, completing a task, or when instructed to advance to the next item in the backlog.

## Procedure

1. **Scan Backlog**:
   - Inspect [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md).
   - Locate the first task item marked with `[ ]` (unchecked).
   - Note the Task ID (e.g. `1.2`), title, phase, and assigned role (`[lead]` or `[implementer]`).

2. **Verify Board State**:
   - Inspect [.agents/collab/BOARD.json](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/BOARD.json).
   - Ensure `active_locks` does not contain stale locks from previous tasks.
   - If previous task was completed, ensure its status is `MERGED`.

3. **Initialize Task**:
   - Update [.agents/collab/CURRENT_TASK.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/CURRENT_TASK.md) with:
     - Task ID and Title.
     - Assigned Agent.
     - Initial status: `IN_PROGRESS` (if lead) or `PROPOSED` (if implementer).
     - Target files to lock.
   - Update `BOARD.json` tasks array and agent status.

4. **Coordinate Execution**:
   - If assigned to `[implementer]`, post a task briefing directive in [.agents/collab/GEMINI_TO_KILO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/GEMINI_TO_KILO.md).
   - If assigned to `[lead]`, invoke `/project-task <task_id>`.

5. **Autopilot Check**:
   - If the user provided the `AUTOPILOT` command, immediately proceed to execution.
   - Otherwise, display the task plan and await confirmation.
