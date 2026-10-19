---
name: project-verify
description: >-
  Runs project verification (TypeScript typecheck and ESLint linting) in single-pass mode.
  Outputs green/red status lines. Use this skill whenever validating code changes,
  before committing, or before closing a task.
---

# Project Verification Skill

This skill executes fast, single-pass verification checks across the codebase, enforcing zero-freeze Thermal Guard constraints.

## Verification Checklist

1. **Typecheck (TypeScript)**
   - Command: `npx tsc --noEmit`
   - Budget: 60s
   - Expected Output: Exit code 0, no diagnostic errors.

2. **Linting (ESLint)**
   - Command: `npm run lint`
   - Budget: 60s
   - Expected Output: Exit code 0, no lint errors or unhandled warnings.

## Execution Procedure

Run the single-pass verification commands sequentially:

```powershell
# 1. Run Typecheck
npx tsc --noEmit

# 2. Run Lint
npm run lint
```

## Result Output Format

Format the terminal verification results clearly:

```text
========================================
KMMS VERIFICATION REPORT
========================================
[PASS] TypeScript Typecheck (npx tsc --noEmit)
[PASS] ESLint Validation (npm run lint)
========================================
STATUS: ALL CHECKS PASSED (Ready for Merge)
========================================
```

If any check fails:
```text
========================================
KMMS VERIFICATION REPORT
========================================
[FAIL] TypeScript Typecheck (see diagnostic output above)
[PASS] ESLint Validation
========================================
STATUS: VERIFICATION FAILED (Fix required before merge)
========================================
```

## Post-Verification Action
- If passed: Copy exact terminal output into `docs/PROGRESS.md` under the active task.
- If failed: Revert or fix the broken lines before proceeding.
