---
name: project-end-phase
description: >-
  Audits invariants, verifies all phase tasks in docs/TODO.md are complete, checks
  board mutex hygiene, and generates the mandatory 4-part summary for the non-developer owner.
---

# Project End Phase Skill

Use this skill whenever all tasks within a development phase or milestone are complete, or when preparing a phase handoff to the non-developer owner.

## Phase Closing Procedure

### 1. Invariant & Backlog Audit
1. Open [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md):
   - Confirm all tasks in the concluding phase have their checkbox marked as `[x]`.
2. Open [.agents/collab/BOARD.json](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/BOARD.json):
   - Confirm `active_locks` is completely empty (`{}`). If any stale locks remain, investigate and clear them.
3. Open [docs/PROGRESS.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/PROGRESS.md):
   - Confirm that all tasks in this phase have terminal proof logged.

### 2. Full Suite Verification Run
Run the final verification checks to guarantee the branch is completely clean:
```powershell
npx tsc --noEmit
npm run lint
```

### 3. Generate 4-Part Plain-English Owner Summary
Format the final response for the non-developer owner strictly adhering to the 4-part protocol:

```markdown
### Phase [X]: [Phase Title] — Completion Summary

1. **Done**
   - [Bullet 1: Concrete achievement in plain English]
   - [Bullet 2: Concrete achievement in plain English]
   - [Bullet 3: Concrete achievement in plain English]
   - [Bullet 4: Concrete achievement in plain English]

2. **Check this**
   1. [Step 1: Where the owner can look or test]
   2. [Step 2: What action to take]
   3. [Step 3: What successful result to confirm]

3. **I need from you**
   - [External API keys, credentials, or business decisions needed, or state 'None at this time']

4. **Risks / open issues**
   - [Upcoming considerations, dependencies, or edge cases]
```

### 4. Next Phase Queue
Inform the user of the next upcoming phase documented in `docs/PHASES.md` and `docs/TODO.md`, and wait for user direction (or proceed if `AUTOPILOT` mode is active).
