# HANAPBUHAY
Monorepo: `backend/` (LavaLust PHP API) and `frontend/` (React + Vite).
Stack: Aiven MySQL, Render (Docker web service + static site), GitHub.

## Local
Backend (`backend/.env` from `.env.example`):
`cd backend && php lava migration run && php lava serve`  -> http://localhost:3000/api/health

Frontend (`frontend/.env` from `.env.example`):
`cd frontend && npm install && npm run dev`  -> http://localhost:5173

Google sign-in (Google Cloud Console > Clients > your Web client > Authorised JavaScript origins):
- `http://localhost:5173`  (the dev server is pinned to this port with `strictPort`)
- `http://127.0.0.1:5173`  (optional, if you open the app by IP)
- your Render frontend URL once deployed

If `npm run dev` says "Port 5173 is already in use", an old dev server is still running. Close it instead of
using another port: any other port gives `Error 400: origin_mismatch` on the Google popup.
Open the app in Chrome/Edge at http://localhost:5173 (embedded editor browsers can block Google sign-in).
