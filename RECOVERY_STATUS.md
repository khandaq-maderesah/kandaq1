# Recovery Status — Aug 23 2026

After the photo-migration incident, here is the **exact, verified** state of the
student data — and what is / is not possible to restore.

## Current numbers (verified against the live database)

| Metric | Count | Notes |
|---|---|---|
| Total students in `/students` | **458** | matches the original "Scanned 458" |
| Students with intact original data | **98** | these never had photos; they kept parentPhone, roll, gender, age, language, etc. |
| Students recreated by recovery (name+class only) | **295** | rebuilt from `/attendance`, `/exams`, `/absentAlerts` |
| Photo-only placeholders (need a name) | **65** | photo is safe under `/studentPhotos`; name only existed on the wiped record |
| Students with a parentPhone today | **99** | = 98 untouched + 1 manually re-entered |

## Photos: FULLY RECOVERED ✅
All **360 photos** are safe in `/studentPhotos` and display in the app (photos are fetched by student id on demand). Nothing to do here.

## What CANNOT be recovered automatically ⚠️
- **Parent phone, alternative phone, parent name, parent email, parent language, address, gender, age/DOB** for the **360 wiped students** (all except the 98 untouched).
  - They only ever existed inside the deleted records.
  - Firebase RTDB backup feature is **not enabled** (needs the paid plan), and the only exported `.json` files on this PC were taken **after** the wipe (they contain just the 98 survivors).
  - No roster CSV/Excel with these phones exists on this machine (we checked Desktop, Downloads, Documents, and all temp project folders — files were empty, unrelated, or a duplicate of the 98-unique Amharic doc).
- The **names of the 65 photo-only students** — they only existed on the wiped records.

So there is **no hidden copy of the 360 students' parent-contact data** to restore from.

## How to get the missing info back in (the only way, manual)
1. **Open the current roster** (already exported, with internal ids so it can be written back):
   `backups/students-2026-08-23T07-01-19-106Z.csv`
2. In Excel, fill in **Parent Phone / Alternative Phone / Parent Name / Address / etc.** for the students who are missing them, and **rename the 65 "photo only — re-enter name"** rows.
3. Write it back safely (dry-run first — it only ever updates the cells you filled):
   ```
   npm run apply:students -- backups/students-YYYY....csv
   npm run apply:students -- backups/students-YYYY....csv --apply
   ```
   Empty cells are ignored; existing values are preserved.

## Safety lessons (now embedded in the repo)
- `npm run backup:db` — take a full export before ANY migration/change.
- `update(ref, obj)` in RTDB **replaces** each child path — never merge-delete with
  `{ id: { field: null } }`; always target the student path when deleting one field.
- Migrations must be verified (count named records before/after) — the fixed
  `migrate-photos.mjs` now does exactly that.

## Repo tooling (kept for future use)
| Command | Purpose |
|---|---|
| `npm run backup:db` | full RTDB export → `backups/rtdb-*.json` |
| `npm run export:students` | current roster → CSV (with ids) |
| `npm run apply:students -- <csv>` | apply filled-in CSV (dry-run / `--apply`) |
| `npm run restore:students -- <backup.json>` | restore students from a JSON export |
| `npm run recover:students` | rebuild missing students from attendance/exams/alerts/photos |