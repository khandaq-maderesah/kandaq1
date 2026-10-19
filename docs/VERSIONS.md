# KMMS Verified Dependency Versions & Official Documentation References

This document records the exact, verified versions of core dependencies used in the project, along with their official documentation URLs for fast lookup by agents.

---

## Core Framework & Runtime

| Technology | Verified Version | Purpose | Documentation Reference |
| :--- | :--- | :--- | :--- |
| **Next.js** | `^15.0.0` | React Framework (App Router) | [Next.js Docs](https://nextjs.org/docs) |
| **React** | `^18.2.0` | UI Library | [React Docs](https://react.dev) |
| **React DOM** | `^18.2.0` | DOM Rendering | [React DOM Docs](https://react.dev/reference/react-dom) |
| **TypeScript** | `^5.3.0` | Type Safety | [TypeScript Handbook](https://www.typescriptlang.org/docs/) |
| **Node.js** | `>=20.x` | Execution Runtime | [Node.js Docs](https://nodejs.org/en/docs) |

---

## Backend & Cloud Services

| Technology | Verified Version | Purpose | Documentation Reference |
| :--- | :--- | :--- | :--- |
| **Firebase Web SDK** | `^10.7.0` | Client Auth, RTDB & Storage | [Firebase Web Docs](https://firebase.google.com/docs/web/setup) |
| **Firebase Admin SDK**| `^14.2.0` | Server-side DB & User Seeding | [Firebase Admin Node Docs](https://firebase.google.com/docs/admin/setup) |
| **Firebase RTDB** | Protocol 2 | Realtime Database Rules | [RTDB Rules Guide](https://firebase.google.com/docs/database/security) |
| **Firebase Storage** | v1 | Media & Student Photos | [Firebase Storage Rules](https://firebase.google.com/docs/storage/security) |

---

## UI, Styling & Internationalization

| Technology | Verified Version | Purpose | Documentation Reference |
| :--- | :--- | :--- | :--- |
| **Tailwind CSS** | `^3.3.0` | Utility-first CSS | [Tailwind CSS Docs](https://tailwindcss.com/docs) |
| **Radix UI Primitives**| `^1.1.x / ^2.1.x` | Accessible Dialogs & Dropdowns | [Radix UI Docs](https://www.radix-ui.com/primitives) |
| **Lucide React** | `^0.294.0` | UI Icons | [Lucide Icons Guide](https://lucide.dev) |
| **next-intl** | `4.4.0` | App Router Localization | [next-intl Docs](https://next-intl-docs.vercel.app/) |
| **Recharts** | `^2.10.0` | Attendance & Admin Charts | [Recharts Guide](https://recharts.org/en-US/) |
| **Sonner** | `^2.0.7` | Toast Notifications | [Sonner Docs](https://sonner.emilkowal.ski/) |
| **Zod** | `^3.22.0` | Schema Validation | [Zod Docs](https://zod.dev) |
| **React Hook Form** | `^7.48.0` | Form Management | [React Hook Form Docs](https://react-hook-form.com) |

---

## Domain-Specific Libraries

| Technology | Verified Version | Purpose | Documentation Reference |
| :--- | :--- | :--- | :--- |
| **ethiopian-calendar-date-converter** | `^2.1.6` | Ethiopian ↔ Gregorian Date Mapping | [npm package](https://www.npmjs.com/package/ethiopian-calendar-date-converter) |
| **date-fns** | `^2.30.0` | Date utility functions | [date-fns Docs](https://date-fns.org) |

---

## Code Quality & Tooling

| Tool | Verified Version | Purpose | Command |
| :--- | :--- | :--- | :--- |
| **ESLint** | `^8.54.0` | Static Code Analysis | `npm run lint` |
| **eslint-config-next** | `^15.0.0` | Next.js Linting Rules | Included in ESLint |
| **TypeScript Compiler** | `^5.3.0` | Single-pass type verification | `npx tsc --noEmit` |
