# MACS Active Task Context

## Task Metadata
- **Task ID**: `2.2`
- **Phase**: Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish
- **Title**: Audit all i18n translation namespaces (English & Amharic) for consistent Madrasa/Ustaz terminology
- **Assigned Agent**: Specialist Implementer (`[implementer]` / Kilo AI)
- **Status**: `APPROVED` (Ready for Implementation)
- **Initiated At**: 2026-10-20T09:07:00+03:00

---

## Approved File Mutex Locks
The following directory is approved for Kilo AI (`[implementer]`):
1. `src/i18n/messages/**`

*All other agents must treat these paths as read-only while this task is active.*

---

## Objectives & Acceptance Criteria
1. Scan all translation dictionaries in `src/i18n/messages/` (`en`, `am`, `om`, `so`, `ar`).
2. Replace all occurrences of:
   - "school" / "schools" -> "Madrasa" / "Madrasas" (and Amharic "ትምህርት ቤት" -> "መድረሳ")
   - "teacher" / "teachers" -> "Ustaz" / "Ustazes" (and Amharic "አስተማሪ" -> "ኡስታዝ")
3. Preserve JSON structure and translation keys (only edit values).
4. Run `npm run verify` to confirm clean typecheck, lint, and all 15 unit tests pass.
