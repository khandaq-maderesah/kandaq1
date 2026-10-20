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
- [x] **Task 1.3**: Audit environment configuration (`.env.example`), Firebase rules, and backup automation [lead]
- [x] **Task 1.4**: Establish component testing scaffolding for core UI and auth guards [implementer]

---

## Phase 2: Role Isolation & Ustaz/Madrasa Workflow Polish
- [x] **Task 2.1**: Audit and harden Realtime Database rules (`database.rules.json`) for Ustaz role scoping [lead]
- [x] **Task 2.2**: Audit all i18n translation namespaces (English & Amharic) for consistent Madrasa/Ustaz terminology [implementer]
- [x] **Task 2.3**: Verify student photo upload, compression, and Cloud Storage security rule enforcement [implementer]
- [x] **Task 2.4**: Verify database backup and restore scripts with automated dry-run validation [lead]
- [x] **Task 2.5**: Implement Ustaz Attendance Submission Monitor & Admin Push Notification Engine [implementer & lead]
  - [x] Subtask 2.5a: Browser Push Notification Service & Service Worker Extension (`public/sw.js`, `src/lib/pushNotification.ts`)
  - [x] Subtask 2.5b: Admin Live Ustaz Attendance Status Table/Widget (Submitted vs Missing Ustazes)
  - [x] Subtask 2.5c: Automated Push Notification Trigger upon Missing Attendance Cutoff Time

---

## Phase 3: Dual-Calendar & Attendance Analytics Engine
- [x] **Task 3.1**: Create comprehensive test suite for Ethiopian-to-Gregorian date conversion edge cases [implementer]
- [x] **Task 3.2**: Optimize attendance overview aggregation query for large student rosters [implementer]
- [x] **Task 3.3**: Architect multi-madrasa dashboard analytics views for Superadmin role [lead]

---

## Phase 4: Notifications & Student Identification Infrastructure
- [x] **Task 4.1**: Build pluggable SMS provider client adapter (sandbox / production toggle) [implementer]
- [x] **Task 4.2**: Configure human credentials & production SMS webhook gateway [lead]
- [x] **Task 4.3**: Design printable student ID card batch generator with barcode/QR verification [implementer]

---

## Phase 5: Offline PWA, Persistent Auth & Custom Madrasa App Icon
- [x] **Task 5.1**: Persistent Auth & Session Longevity (Eliminate auto-logout on window close, extend session cookies to 1 year) [lead]
- [x] **Task 5.2**: Dynamic Madrasa PWA App Icon & Manifest (read branding from cookie, custom logo check, fallback elimination) [lead]
- [x] **Task 5.3**: Offline Attendance Take & Background Auto-Sync Engine (local storage caching for offline Ustazes) [lead]
- [x] **Task 5.4**: Service Worker Pre-caching & Standalone Native PWA Polish [lead]
- [x] **Task 5.5**: Multi-Device PWA Smoke Verification & Ustaz Offline Sync Edge Testing [implementer]
