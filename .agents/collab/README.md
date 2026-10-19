# Multi-Agent Collaboration System (MACS) — Overview & Quickstart

Welcome to the KMMS Multi-Agent Collaboration System. This framework coordinates two specialized AI agents to ensure rapid, concurrent development without regressions, race conditions, or unverified claims.

---

## 🏗️ Architecture & Interaction Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Project Owner (Human)
    participant Lead as Lead Architect (Gemini)
    participant Board as Collab Board (BOARD.json)
    participant Kilo as Specialist Implementer (Kilo)

    Note over Lead,Kilo: Phase Planning & Task Breakdown
    Lead->>Board: Initialize Phase Tasks in docs/TODO.md & BOARD.json
    Lead->>Kilo: Send Directive in GEMINI_TO_KILO.md

    Note over Kilo,Lead: Task Execution & Mutex Locking
    Kilo->>Board: Check active_locks
    Kilo->>Lead: Post [PROPOSAL] in KILO_TO_GEMINI.md
    Lead->>Board: Grant File Locks in active_locks
    Lead->>Kilo: Approve Proposal [APPROVAL] in MESSAGES.md
    Kilo->>Kilo: Implement code, UI, & tests

    Note over Kilo,Lead: Verification & Thermal Guard
    Kilo->>Kilo: Run npx tsc --noEmit (Single-pass < 60s)
    Kilo->>Kilo: Run npm run lint (Single-pass < 60s)
    Kilo->>Lead: Submit [VERIFIED] with terminal log in KILO_TO_GEMINI.md

    Note over Lead,Owner: Final Review & Git Merge
    Lead->>Lead: Audit code against invariants & DoD
    Lead->>Lead: Execute atomic git commit
    Lead->>Board: Release locks & update status to MERGED
    Lead->>Owner: Deliver 4-Part Plain-English Phase Summary
```

---

## 🚀 Quickstart Instructions

### For the Lead Architect (Gemini)
1. Read `AGENTS.md`, `docs/TODO.md`, and `.agents/collab/BOARD.json`.
2. Inspect `BOARD.json` to verify no lingering locks.
3. Review pending proposals in `.agents/collab/KILO_TO_GEMINI.md`.
4. Grant file locks by updating `active_locks` in `BOARD.json`.
5. When Kilo posts verification evidence:
   - Audit the code changes.
   - Run `/project-verify` (`npx tsc --noEmit` and `npm run lint`).
   - Append verification logs to `docs/PROGRESS.md`.
   - Perform git commit and release locks in `BOARD.json`.
6. Deliver the 4-part summary to the non-developer owner when a phase finishes.

### For the Specialist Implementer (Kilo AI)
1. Read `AGENTS.md` and check `docs/TODO.md` for tasks assigned to `[implementer]`.
2. Check `BOARD.json` -> `active_locks`. Do **NOT** edit any file that is locked.
3. Draft your task proposal and requested files to lock in `.agents/collab/KILO_TO_GEMINI.md`.
4. Wait for Lead approval and file lock grant in `.agents/collab/MESSAGES.md`.
5. Once approved:
   - Modify the code adhering to project patterns and invariants.
   - Run `npx tsc --noEmit` and `npm run lint`.
   - Keep command executions under 60 seconds (Thermal Guard).
6. Post the exact terminal output into `.agents/collab/KILO_TO_GEMINI.md` and mark task ready for verification.
