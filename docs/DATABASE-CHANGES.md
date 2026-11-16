# Database changes

The schema is built only by the migrations in `backend/app/migrations/`, run in order.
Every migration checks before it changes anything (`CREATE TABLE IF NOT EXISTS`, a column is
added only when missing), so running them again is safe.

## How migrations run

| Where | How |
|---|---|
| Render | Automatically. `backend/docker-start.sh` runs `php public/index.php migrate` in the background each time the API starts, and then clears the cached table list. Set `RUN_MIGRATIONS=false` to turn this off. |
| Locally | `cd backend` then `php public/index.php migrate` |
| Status | `php public/index.php status` lists which migrations are applied |

Migrations run only from the command line; the `/migrate` web routes answer 404.

While a migration has not run yet, the features that need its tables stay hidden instead of
failing: the code asks `Schema_info` whether a table or column exists first.

## What each migration adds

| No. | Adds |
|---|---|
| 000–002 | `users`, `refresh_tokens` |
| 003 | profile fields on `users` (location, phone, bio, picture, account type) |
| 004 | `jobs` |
| 005 | `applications` |
| 006 | `skills_passport` |
| 007 | `users.notification_prefs` |
| 008 | interview status, schedule and tracking on `applications` |
| 009 | `users.is_verified` |
| 010 | `subscriptions`, plan fields on `users` |
| 011 | email delivery tracking on `notifications` |
| 012 | `password_resets`, `job_reports` |
| 013 | removes the old MySQL `messages` table (chat moved to Firebase) |
| 014 | `email_verifications`, `saved_jobs` |
| 015 | `skill_certificates`, the Resume Builder draft on `users` |
| 016 | certificate review columns, `applications.withdrawn_at` |
| 017 | `employer_reviews`, availability, the public Skills Passport link |
| 018 | `follows`, `worker_reviews`, `saved_courses`, `course_enrollments`, `work_samples` |
| 019 | `talent_unlocks`, `talent_saved`, `talent_invites` |
| 020 | richer job fields (pay basis, openings, schedule, benefits, needed by, urgent, photo), `job_images`, `business_documents` |
| 021 | the public-ready platform: `verification_requests`, `verification_history`, `phone_otps`, `application_status_history`, `payments`, `subscription_events`, `paymongo_events`, and the gig workflow: `proposals`, `contracts`, `contract_milestones`, `contract_events`, `disputes`, `contract_reviews`, `worker_services` |
| 022 | the gig marketplace: `post_photos` (up to 6 photos per job, gig or service), `gig_invites`, service packages / requirements / changes included / views on `worker_services`, work photos and start date on `proposals`, `contracts.package_name` |

## Backups

Before changing the live database by hand, take a backup from the Aiven console (or
`mysqldump`). Backup files hold personal data: keep them out of the repository (`*.sql` and
`backups/` are git-ignored).
