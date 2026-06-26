# Deploying Abu Dhabi Economic Intelligence

Stack: **FastAPI** backend on **Render**, **Next.js** frontend on **Vercel**,
**MongoDB** on **Atlas**, **PostgreSQL** on **Neon**. All have a free tier.

The backend reads every secret/DB from environment variables and the frontend
reads the API URL from `NEXT_PUBLIC_API_BASE`, so nothing is hard-coded.
**Your real keys live only in each host's dashboard — never in git** (`.gitignore`
excludes `**/.env`).

---

## 0. Put the code on GitHub

From the folder that contains `backend/` and `frontend/` (this folder):

```bash
git init
git add .
git commit -m "Abu Dhabi Economic Intelligence"
git branch -M main
git remote add origin https://github.com/<you>/event-intelligence.git
git push -u origin main
```

Confirm `backend/.env` is **NOT** in the push (`git status` should not list it).

---

## 1. MongoDB — Atlas (free M0)

1. https://www.mongodb.com/cloud/atlas → create a free **M0** cluster.
2. **Database Access** → add a user + password.
3. **Network Access** → Add IP → `0.0.0.0/0` (Render's egress IP isn't fixed on free).
4. **Connect → Drivers** → copy the string:
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
   → this is your **`MONGO_URI`**.

## 2. PostgreSQL — Neon (free)

1. https://neon.tech → new project.
2. Copy the **connection string** (Pooled is fine):
   `postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require`
   → this is your **`DATABASE_URL`**. (The backend creates its `gauges` table itself.)

## 3. Backend — Render

1. https://render.com → **New + → Blueprint** → pick your GitHub repo.
   Render reads `render.yaml` and creates the `event-intelligence-api` web service.
2. It will prompt for the secret env vars (marked `sync: false`):
   - `MONGO_URI` = from step 1
   - `DATABASE_URL` = from step 2
   - `GEMINI_API_KEY` = your Gemini key (https://aistudio.google.com/apikey)
   - `GNEWS_KEY`, `FINNHUB_KEY`, `NEWSAPI_KEY` = optional news keys (blank is OK)
   - `CORS_ORIGINS` = leave as `http://localhost:3000` for now; you'll update it in step 5
3. **Create** → wait for the build. You get a URL like
   `https://event-intelligence-api.onrender.com`. Check `…/api/health` → `{"ok":true}`.

## 4. Frontend — Vercel

1. https://vercel.com → **Add New → Project** → import the same repo.
2. **Root Directory** → set to **`frontend`**.
3. **Environment Variables** → add
   `NEXT_PUBLIC_API_BASE = https://event-intelligence-api.onrender.com` (your step-3 URL).
4. **Deploy** → you get `https://<your-project>.vercel.app`.

## 5. Connect them (CORS)

Back in **Render → your service → Environment**, set:

```
CORS_ORIGINS = https://<your-project>.vercel.app
```

Save (Render redeploys). Open the Vercel URL — the dashboard now loads live data.

---

## Notes

- **Free Render sleeps** after ~15 min idle; the next request cold-starts (~30–60s)
  and the 30-min news scheduler only runs while awake. To keep it always-on and
  auto-refreshing: upgrade to Render **Starter ($7/mo)**, or ping `…/api/health`
  every 10 min with a free monitor (UptimeRobot / cron-job.org).
- **Free-tier AI cap:** the agent self-throttles to `LLM_DAILY_REQUESTS` (default 20,
  the Gemini free tier). Fresh news still shows immediately via the instant read;
  raise this once billing is enabled. Watch usage at `…/api/stats` → `ai_budget`.
- **First load** seeds the DB (collect → classify → analyse) on startup, then every
  30 min. Click **Refresh now** in the UI (or POST `…/api/refresh`) to pull on demand.
- To change keys later, edit them in the **Render dashboard** (backend) or **Vercel
  dashboard** (frontend) — not in git.
