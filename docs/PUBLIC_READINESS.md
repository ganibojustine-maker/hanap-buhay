# Before going public: decisions and setup the team still owns

## Needs your input

| # | Item | Where |
|---|---|---|
| 1 | **Legal review.** Have the adviser or a lawyer review the Terms of Service and the Privacy Policy before launch, including the refund policy (7 days), the retention periods, and the minimum age (15 with consent, RA 9231). | `frontend/src/pages/Legal.jsx` |
| 2 | **Real support details**: support email, privacy email, phone, office address, and the Data Protection Officer's name. The defaults (`support@hanapbuhay.app`) are placeholders. | `frontend/.env`: `VITE_SUPPORT_*`, `VITE_DPO_NAME` |
| 3 | **NPC registration.** Register the data processing system and the DPO with the National Privacy Commission, if your setup requires it. | npc.gov.ph |
| 4 | **Money between clients and workers.** Right now clients pay workers directly and both confirm. Holding funds (escrow) needs a licensed partner. Decide whether to keep direct payment for the capstone. | docs/GIGS.md |
| 5 | **PayMongo account.** Which methods are actually turned on for your account (card, GCash, Maya, GrabPay, QR Ph…). Set `PAYMONGO_METHODS` to match. Also create the webhook. | `backend/.env` |
| 6 | **Semaphore SMS credits** for the phone codes. Without a key, test mode shows the code on screen. That is fine for the demo, but not for going live. | `SEMAPHORE_API_KEY` |
| 7 | **Partner offices.** The About page lists PESO, TESDA and DOLE offices as offices that "work alongside us", with a note that a listing does not mean endorsement. Confirm the wording, or get their permission to name them. | `frontend/src/data/site.js` |
| 8 | **Plan prices** (₱499 / ₱1,499 / ₱249 / ₱599). The names were changed away from "JobStreet" and "Street Job" to avoid using other companies' brands. | `backend/app/models/Subscription_model.php` |
| 9 | **Brand colors.** The new logo uses a lighter blue (#3F7BFF) and yellow (#FCC54E). The app theme still uses navy (#0D1B3E) and gold (#F5A623). Say if you want the theme moved to the logo colors. | `frontend/src/styles/base.css` |

## To run once

1. Apply the database update: `php public/index.php migrate` from `backend/`. Render does this on each deploy when `RUN_MIGRATIONS=true`. Migration 021 adds the new tables and columns and carries existing data over: client posts become gigs, every open post gets an end date, admin-verified accounts become `verified`, existing accounts are marked as having accepted the current terms, and paid subscriptions become payment rows.
2. Optional demo data on a test database only: `php seed_demo.php` (`--reset`, `--remove`).
3. Set up the cron pinger for `/api/cron/reminders?key=<CRON_SECRET>` every 15–30 minutes.

## Still to build later (not needed for the panel)

- Automatic deletion of ID images 1 year after the check (the Privacy Policy promises this). Add it to the cron.
- A "Download my data" export button in Settings. For now, privacy requests are handled by email as the policy says.
