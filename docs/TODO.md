# KMMS Unified Backlog & Phase Roadmap

This document serves as the single source of truth for all pending, active, and completed tasks across all agents.

Legend:
- `[lead]` : Antigravity (Gemini) — Lead Architect
- `[implementer]` : KiloCode (Kilo AI) — Specialist Implementer
- `[x]` : Completed and verified
- `[ ]` : Pending

---

## Phase 1: Multi-Agent Collaboration Infrastructure & Repository Hardening
- [x] **Task 1.1**: Initialize MACS collaboration framework, rules, board, and documentation [lead]
- [x] **Task 1.2**: Implement unified verification script (`npm test` / `verify.mjs`) and Thermal Guard runner [implementer]
- [ ] **Task 1.3**: Audit environment configuration (`.env.example`), Firebase rules, and backup automation [lead]
- [ ] **Task 1.4**: Establish component testing scaffolding for core UI and auth guards [implementer]

---

## Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish
- [ ] **Task 2.1**: Audit and harden Realtime Database rules (`database.rules.json`) for Ustaz role scoping [lead]
- [ ] **Task 2.2**: Audit all i18n translation namespaces (English & Amharic) for consistent Madrasa/Ustaz terminology [implementer]
- [ ] **Task 2.3**: Verify student photo upload, compression, and Cloud Storage security rule enforcement [implementer]
- [ ] **Task 2.4**: Verify database backup and restore scripts with automated dry-run validation [lead]
- [ ] **Task 2.5**: Implement Ustaz Attendance Submission Monitor & Admin Push Notification Engine [implementer]
  - Subtask 2.5a: Browser Push Notification Service & Service Worker Extension (`public/sw.js`, `src/lib/pushNotification.ts`)
  - Subtask 2.5b: Admin Live Ustaz Attendance Status Table/Widget (Submitted vs Missing Ustazes)
  - Subtask 2.5c: Automated Push Notification Trigger upon Missing Attendance Cutoff Time

---

## Phase 3: Dual-Calendar & Attendance Analytics Engine
- [ ] **Task 3.1**: Create comprehensive test suite for Ethiopian-to-Gregorian date conversion edge cases [implementer]
- [ ] **Task 3.2**: Optimize attendance overview aggregation query for large student rosters [implementer]
- [ ] **Task 3.3**: Architect multi-madrasa dashboard analytics views for Superadmin role [lead]

---

## Phase 4: Notifications & Student Identification Infrastructure
- [ ] **Task 4.1**: Build pluggable SMS provider client adapter (sandbox / production toggle) [implementer]
- [ ] **Task 4.2**: Configure human credentials & production SMS webhook gateway [lead]
- [ ] **Task 4.3**: Design printable student ID card batch generator with barcode/QR verification [implementer]
