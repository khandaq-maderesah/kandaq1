# KMMS Development Milestone Roadmap & Phase Criteria

This document defines the high-level roadmap, objective milestones, and strict acceptance criteria for each development phase of the Khendeq Medresah Management System (KMMS).

---

## 🗺️ Milestone Roadmap

| Phase | Milestone Name | Objective | Primary Agent | Target Exit Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Collaboration & Hardening | Establish MACS multi-agent framework, operating skills, unified backlog, and thermal guard checks. | Lead Architect | COMPLETE |
| **Phase 2** | Role Isolation & Ustaz Polish | Harden Firebase Realtime Database rules, lock down Ustaz access scopes, and ensure consistent multi-lingual terminology. | Implementer & Lead | COMPLETE |
| **Phase 3** | Dual Calendar & Attendance Analytics | Stress-test Ethiopian calendar conversion, optimize attendance queries, and refine admin analytics dashboards. | Implementer | COMPLETE |
| **Phase 4** | Notifications & ID Systems | Integrate SMS API notifications, create parent dispatch queues, and generate printable student ID cards. | Implementer & Lead | COMPLETE |

---

## 🎯 Phase Acceptance Criteria

### Phase 1: Collaboration & Hardening
- [x] Multi-agent collaboration directory `.agents/collab/` established with live board and locking protocol.
- [x] Operating rules `.agents/rules/00-operating.md` and Antigravity skills created.
- [x] Single source of truth backlog `docs/TODO.md` created with numbered IDs and assignees.
- [x] Non-developer communication protocol active (`Done`, `Check this`, `I need from you`, `Risks / open issues`).
- [x] Automated verification script configured for fast single-pass execution.
- [x] Typecheck (`npx tsc --noEmit`) and ESLint (`npm run lint`) pass with exit code 0.

### Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish
- [x] Database rules (`database.rules.json`) strictly prevent Ustaz users from modifying other classes or reading unauthorized student records.
- [x] All i18n translation strings in English and Amharic use standardized terminology: Madrasa, Ustaz, Talib.
- [x] Student profile photo uploads verified with image size constraints and secure Firebase Storage bucket rules.
- [x] Automated database backup scripts validated with test restore dry-run.

### Phase 3: Dual-Calendar & Attendance Analytics Engine
- [x] Ethiopian Calendar Date Converter validated across leap years, Pagume month (13th month), and cross-century dates.
- [x] Daily attendance aggregation queries execute in under 300ms for classes with 100+ students.
- [x] Admin reporting charts accurately reflect Present / Absent / Late distribution in real time.

### Phase 4: Notifications & Student Identification Infrastructure
- [x] Pluggable SMS architecture supporting both mock sandbox and live gateway dispatches.
- [x] Parent notification triggered reliably upon absent/late attendance submission.
- [x] Printable student ID cards formatted for standard PVC/paper sizes with scannable barcode or QR token.
