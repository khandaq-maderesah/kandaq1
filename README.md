# Khandaq Madresah Attendance

A school attendance management system for Khandaq Madresah, built with **Next.js 15 (App Router)**, **React**, **Tailwind CSS**, and **Firebase (Authentication + Realtime Database)**.

## ✨ Features

### Admin
- **Users Management** — create/manage **admins** and **teachers**, activate/deactivate accounts
- **Classes Management** — create classes, assign teachers, view student counts
- **Students Management** — register students, assign to classes, activate/deactivate
- **Attendance Overview** — filter records by class/date, present/absent/late summary
- **Reports & Analytics** — stat cards + charts (status pie, daily attendance bars)

### Teacher
- **My Classes** — view assigned classes and student counts
- **Take Attendance** — pick a class + date, mark each student Present / Absent / Late
- **Attendance History** — filterable history of records the teacher marked

### General
- Email/password authentication with role-based route protection
- **Admin-created accounts** — admins/teachers are created by an admin (no public self-registration)
- **Forgot password** — users reset their own password by email from the login page
- Prepared for both admin (full control) and teacher (scoped) workflows
- Responsive UI using shadcn-style components

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
Copy the example and fill in your Firebase project values:
```bash
cp .env.example .env.local
```
Required variables (from Firebase Console → Project Settings → Your apps → Web app):
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
```

### 3. Enable Firebase services
1. **Authentication** → Sign-in method → enable **Email/Password**
2. **Realtime Database** → create in test mode → publish the rules in `database.rules.json`

### 4. Seed the initial admin account
```bash
npm run seed:admin
```
Creates (or updates) the master admin. Defaults can be overridden:
```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=YourPass1 npm run seed:admin
```

### 5. Run the app
```bash
npm run dev
```
Open http://localhost:3000 and sign in with your admin credentials.

> There is **no public registration**. All admin/teacher accounts are created by
> an admin from the **Users** page. Existing users can reset their own password
> using **Forgot password** on the login page.

## 🔐 Security Rules
The rules in `database.rules.json` enforce:
- Users can read/write **their own** profile; **admins** can read/write all users
- Only **admins** can create/update classes and students
- **Teachers** can mark attendance **only on classes they are assigned to**
- **Admins** can manage settings

## 📁 Project Structure
```
src/
  app/            # Next.js App Router pages (admin/, teacher/, login/)
  components/     # UI + navigation components
  context/        # AuthContext (Firebase auth + user state)
  hooks/          # useAuth helpers
  lib/            # firebase config + rtdb database helper
  types/          # TypeScript interfaces
scripts/
  seed-admin.mjs  # one-time admin seeding
```

## 🧹 Scripts
| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Lint |
| `npm run seed:admin` | Seed / update the master admin account |
