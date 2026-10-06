# Performance Fixes – July 2026

The app was taking **minutes** to load. Root causes (all fixed):

| Symptom | Cause | Fix |
|---|---|---|
| Slow to open / login / after login | The **navbar mounted 3 bell components**, each subscribing to the *entire* Realtime Database — `attendance` was downloaded **3× simultaneously**, `students` 2×, `classes` 3×, `users` 2× | New **shared live-data store** (`src/lib/dataStore.ts`) keeps ONE RTDB subscription per unique key; every component (bells + dashboards) reads the same channel |
| Attendance history at every load | Dashboards/bells subscribed to the whole `attendance` node (every student × every day) | New **date-scoped subscriptions/fetches** (`subscribeToAttendanceSince`, `getAllAttendanceSince`) only transfer recent records (default 15 days). "Show all dates" opts into full history on demand |
| Every student photo (~15-35 KB base64 each) downloaded with every student list just to render lists | Photos were stored *inside* the `students` node | Photos now live in a sibling **`/studentPhotos/{studentId}`** node (rules included). Avatars fetch a photo **on demand**, only when actually shown (`src/hooks/useStudentPhoto.ts`). List pages load lean student records (no photos). **Run the migration** to move existing photos. |
| Login bounced back to `/login`, then `/dashboard` → `/admin` → fresh subscriptions | The session cookie was only written asynchronously by `onAuthStateChanged` | `login()` now sets the cookie synchronously, reads the user's role during login, and redirects **straight** to `/admin` or `/teacher` (login page). |
| Reminder bells wrote redundant rows every minute | The interval re-`GET` old alerts and wrote unchanged reminders | `runMissingAttendanceCheck` reuses the live alerts channel and **skips redundant writes**, waking fewer subscribers |

## Result
- One screen previously opened **~9 separate RTDB subscriptions** (many of them the whole history / all students including every photo). It now opens **1 subscription per unique data channel** (a handful, date-scoped), and most of those are shared with the navbar bells.
- Student lists/screens download only the metadata; photos transfer only when a specific avatar/card needs them.

## Required steps after deploy

1. **Publish the updated database rules** (`database.rules.json`) — adds `studentPhotos` node + indexes for `attendance/date` and `attendance/studentId`. Without this the new date/student scoped queries fall back to full-history downloads (still correct, just slower).

2. **Run the photo migration** (moves legacy base64 photos out of `students`):

   ```bash
   npm install  # if needed
   node scripts/migrate-photos.mjs
   ```

   The script signs in with the seeded admin account (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) and is safe + idempotent (every  photo that's still a `data:` URL gets moved; students that are already clean are left untouched).

## What was NOT changed (and why)
- **`/admin/reports`** still subscribes to full attendance (`attendance:all`): reports are the one screen that legitimately analyzes all history. It still shares the same students/classes/users channels as the navbar so nothing else duplicates.
- **`/teacher` dashboards** stay teacher-scoped (server-side `teacherId` query + per-class students) and also use on-demand photos.
- **First-load JS** is unchanged (~190-300 KB, mostly recharts + Firebase) because the biggest win was network/RTDB traffic, not bundle size.

## ⚠️ IMPORTANT: Data-loss incident & recovery (student records)

**What happened (Aug 2026).** The original `scripts/migrate-photos.mjs` cleanup step used:

```js
update(ref(db, 'students'), { [studentId]: { photoUrl: null } })
```

In Firebase Realtime Database, `update()` treats each top-level key of the object as a **child path** and **replaces** the value at that path — it does **not** merge deeper. So `students/{id}` was replaced with `{ photoUrl: null }`, wiping the entire student record (name, class, parent phone, …) for every student that had a photo. Only the ~94 students **without** photos survived.

**Recovery (already in the repo):**
1. `npm run backup:db` — full export of every node to `backups/` (do this FIRST).
2. `npm run recover:students` — dry-run: rebuilds the missing students from
   `/attendance` + `/exams` + `/absentAlerts` + `/classes` (+ `/studentPhotos`,
   which were saved correctly). Prints a report and writes a payload file.
3. Review `backups/recovered-students-*.json`, then `npm run recover:students -- --apply`
   to write them back (safe per-student merge; the intact 94 are never touched).

**What CANNOT be auto-recovered** (they lived only on the wiped records):
parent phone, parent name/email, parent language, address, gender, age/DOB.

If you have Firebase RTDB backups enabled (Console → Realtime Database → Backups),
restoring the pre-migration backup is the best recovery option — check that first.

**Golden rules for RTDB writes (learned the hard way):**
- `update(ref, obj)` replaces each **top-level child path** entirely — deeper
  fields are NOT merged. To remove one field: `update(ref(db, 'x/' + id), { field: null })`
  (reference AT the record) or use a path fan-out key `{ [id + '/field']: null }`.
- Never overwrite a whole node to "clean" it without first reading + exporting.
- Back up before every migration: `npm run backup:db`.