# Database changes

Written for: whoever runs the HanapBuhay database (you, or the next person deploying it).

---

## 1. Read this first — your live database is five migrations behind

The live Aiven database currently records migrations up to **013**. Migrations **014–017**
were written but never applied, so on the live site these tables and columns **do not exist**:

| Missing since | What is switched off right now |
|---|---|
| 014 | `saved_jobs` — the bookmark button saves nothing; `email_verifications` |
| 015 | `skill_certificates`, `users.resume_data` — certificate upload and the Resume Builder draft |
| 016 | certificate review columns, `applications.withdrawn_at` |
| 017 | `employer_reviews`, availability columns, the public Skills Passport link (`users.share_token`) |

You can confirm it yourself — these two live endpoints answer `"enabled": false`, which is the
code noticing the table is absent and degrading instead of crashing:

```
GET /api/employers/10/reviews   →  {"success":true,"enabled":false, …}
GET /api/workers/3/reviews      →  {"success":true,"enabled":false, …}
```

Everything in this release is written the same way: each feature asks whether its table exists
(`Schema_info`) and hides itself politely if not. **Nothing breaks if you do not migrate** — but
nothing new turns on either.

---

## 2. What migration 018 adds

`backend/app/migrations/018_social_training_and_portfolio.php`

### New tables

**`follows`** — `(follower_id, following_id, created_at)`, PK on the pair.
Following is one-way. When both rows exist the two people are a **connection**: they can message
each other, and each shows on the other's profile. This is what fills the empty Messages inbox —
the app can now answer "who can I message?" from real relationships instead of a name search.

**`worker_reviews`** — the mirror image of `employer_reviews` (017).
Same shape, opposite direction: the employer or client rates the worker they hired.
`UNIQUE(application_id)` means one review per hire, editable afterwards. `is_hidden` lets an
admin take an abusive review out of the average without deleting it.

**`saved_courses`** — `(user_id, course_id, title, created_at)`, PK on the pair.
`course_id` is the TESDA catalogue slug (`welding-smaw-nc-ii`) or `db-<id>` for a course an admin
added to `training_courses`. The catalogue itself stays in the app; only the bookmark is stored.

**`course_enrollments`** — one row per person per course, `status` of `enrolled` or `completed`,
optional `certificate_id` pointing at `skill_certificates`.
This is what produces "23 people enrolled" on a course card, and what lets the Training page ask
for the certificate once someone marks a course finished.

**`work_samples`** — the work gallery. A photo (stored inline as a `data:` URL, same approach as
`users.picture`, because Render's free tier has no disk), a `title`, a `description` in the
worker's own words, and an optional `skill_name` tying it to a Skills Passport entry.
Capped at 24 photos per worker, 3 MB each, enforced in `PortfolioController`.

### Changed table

**`users.avatar_color`** — `TINYINT UNSIGNED NULL`, backfilled to `id % 8`.
Picks which of eight generated avatars an account gets when it has no photo. The app falls back to
`id % 8` on its own, so the column is a convenience, not a dependency.

### Nothing is dropped or rewritten
018 only adds. The `down()` method drops exactly what `up()` created.

---

## 3. How to apply

### Option A — the migration runner (preferred)

```bash
cd backend
php lava migration run      # applies 014, 015, 016, 017, 018 in order
php lava migration status   # confirm
```

Each migration is written to be safe to re-run: tables use `CREATE TABLE IF NOT EXISTS` and every
column add is guarded by `column_exists()`.

### Option B — plain SQL (Navicat, phpMyAdmin, mysql CLI)

Run [`docs/database-changes.sql`](database-changes.sql). It is the same schema, written with a
small `add_column_if_missing()` procedure so it can be run twice with no effect the second time.
It finishes by recording 14–18 in the `migrations` table so the runner will not redo them.

```bash
mysql -h <host> -P <port> -u <user> -p hanapbuhay < docs/database-changes.sql
```

---

## 4. After migrating, these switch on

| Feature | Needs |
|---|---|
| Save a job (bookmark) | `saved_jobs` (014) |
| Upload a certificate → it becomes a verified skill | `skill_certificates` (015) |
| Admin approves/rejects a certificate | review columns (016) |
| Worker withdraws an application | `applications.withdrawn_at` (016) |
| Public Skills Passport link / QR | `users.share_token` (017) |
| Open to work, expected rate, preferred towns | availability columns (017) |
| Worker rates the employer | `employer_reviews` (017) |
| **Employer rates the worker** | `worker_reviews` (018) |
| **Follow / connections / My Network** | `follows` (018) |
| **Bookmark a course, "N people enrolled"** | `saved_courses`, `course_enrollments` (018) |
| **Work photo gallery** | `work_samples` (018) |

---

## 5. Storage note

`skill_certificates.file_data` and `work_samples.file_data` hold base64 `data:` URLs rather than
paths, because the free Render container has no persistent disk. A 3 MB photo becomes roughly
4 MB of text, so a worker who fills both galleries can reach ~150 MB on their own. Watch the Aiven
plan's disk quota as uploads grow; moving these two columns to object storage (S3, Supabase,
Cloudflare R2) is the natural next step and needs no change to the rest of the app — both tables
already carry `file_mime` and `file_size` beside the data.
