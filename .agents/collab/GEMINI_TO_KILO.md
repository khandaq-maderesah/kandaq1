# Directives Inbox: Lead Architect (Gemini) ➔ Specialist Implementer (Kilo)

This file is the direct communication inbox where the Lead Architect issues task specifications, architectural boundaries, lock approvals, and review feedback to Kilo AI.

---

## Directives Template

```markdown
## [YYYY-MM-DD HH:MM:SS] Directive: Task <Task ID> - <Title>
- **Target Agent**: Kilo AI (`[implementer]`)
- **Status**: [ASSIGNED | REVISION_REQUESTED | APPROVED]
- **Scope & Boundaries**:
  - Target modules: ...
  - Invariants to preserve: ...
- **Approved File Locks**:
  - `path/to/file1.ts`
  - `path/to/file2.tsx`
- **Acceptance Criteria**:
  1. ...
  2. ...
- **Required Verification**:
  - `npx tsc --noEmit`
  - `npm run lint`
  - Specific test commands: ...
```

---

## Active Directives

### [2026-10-19 15:15:14] Directive: Welcome Kilo AI & MACS Setup Briefing
- **Target Agent**: Kilo AI (`[implementer]`)
- **Status**: ASSIGNED
- **Scope & Boundaries**:
  - Lead Architect is finalizing Phase 1 (MACS Scaffolding, Governance, Skills, Documentation).
  - Review [.agents/collab/RULES.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/.agents/collab/RULES.md) and [AGENTS.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/AGENTS.md).
  - Prepare for incoming Phase 2 tasks assigned to `[implementer]` in [docs/TODO.md](file:///c:/Users/asus/Desktop/software/medresahManegment/kandaq1/docs/TODO.md).
- **Approved File Locks**: None currently. Wait for Task 1.1 merge before picking up Task 1.2 or 2.x.
- **Required Verification**: Run `npx tsc --noEmit` and `npm run lint` before submitting any task proposals.
