# hanapbuhay

A job, gig and skills-matching platform for the 15 towns of Oriental Mindoro. Workers build a
Skills Passport and are matched to jobs; employers post jobs and run a hiring pipeline;
clients post short gigs or book a worker's service; an administrator verifies accounts,
moderates posts, resolves disputes and watches payments.

| Part | Technology |
|---|---|
| Back end | PHP 8.2, [LavaLust](https://lavalust.netlify.app/docs) (MVC, Query Builder, API library, JWT) |
| Front end | React 18 + Vite, React Router |
| Database | MySQL 8 (Aiven), schema in versioned migrations |
| Chat, Help & Support | Firebase Realtime Database |
| Email · Payments | Brevo · PayMongo (sandbox) |
| Hosting | Render: `hanapbuhay-api` (Docker) and `hanapbuhay-web` (static site), see `render.yaml` |

## Project structure

```
backend/                     LavaLust API (only public/ is served)
  app/config/                framework config, plus one file per library (paymongo, mail, sms, firebase, google, resume)
  app/controllers/           request handling: who is asking, what they sent, the JSON answer
  app/models/                database access with the Query Builder (one model per area)
  app/libraries/             own libraries (matching, payments, mailer, Firebase, SMS…), autoloaded by Composer
  app/migrations/            000–022: every table and column, safe to re-run
  scheme/                    the LavaLust framework itself
  seed_demo.php              demo accounts and data for every screen (command line only)
  seed_accounts.php          create test accounts or promote an account to admin (command line only)
frontend/                    React app
  src/pages/                 one folder per area; dashboard/ has each role's own pages
  src/components/            shared parts (cards, pager, photo manager, dialogs…)
  src/utils/                 formatting, photos, categories, statuses
docs/                        how payments, gigs, matching, verification and security work
render.yaml                  the two Render services and their settings
```

## Run it locally

Requirements: PHP 8.2+ with `pdo_mysql`, `mbstring`, `openssl`, `zip`; Composer; Node 18+; a MySQL 8 database.

```bash
# back end  (http://localhost:3000)
cd backend
cp .env.example .env          # fill in the database and the two JWT secrets
composer install
php public/index.php migrate  # creates every table
php seed_demo.php             # optional: demo accounts (password printed at the end)
php lava serve

# front end (http://localhost:5173, /api is proxied to the back end)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Google sign-in: in Google Cloud Console → Clients → your Web client → Authorised JavaScript
origins, add `http://localhost:5173` and your Render front-end URL. The dev server is pinned to
port 5173 (`strictPort`); any other port gives `Error 400: origin_mismatch`. If it says the
port is in use, close the old dev server instead of changing the port.

## Deploy

Push to `main`. Render rebuilds both services. The API container starts Apache at once and
applies any new migrations in the background (`backend/docker-start.sh`). Secrets are set in
each service's **Environment** page on Render, never in the repository; `.env.example` lists
every key.

## Documentation

- [docs/SECURITY.md](docs/SECURITY.md): how each common web threat is handled
- [docs/GIGS.md](docs/GIGS.md): proposals, contracts, services, photos, invites
- [docs/PAYMENTS.md](docs/PAYMENTS.md): PayMongo plans, webhooks, refunds
- [docs/MATCHING.md](docs/MATCHING.md): the skills-matching score
- [docs/VERIFICATION.md](docs/VERIFICATION.md): identity and business verification
- [docs/DATABASE-CHANGES.md](docs/DATABASE-CHANGES.md): what each migration adds
