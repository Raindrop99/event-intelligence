# Live Event Intelligence Engine

Two separate apps:

```
event-intelligence/
├── backend/    Python + FastAPI — the JSON API and the AI analysis pipeline
└── frontend/   Next.js (App Router, TypeScript) — the dashboard UI
```

The backend collects live events, has the AI agent analyse each one (Collect →
Verify → Understand → Trace impact), and exposes everything as a JSON API. The
frontend is a separate Next.js app that calls that API.

## Run it (two terminals)

**1. Backend** (needs MongoDB on `localhost:27017` and PostgreSQL db `media_risk`):

```bash
cd backend
conda activate media                 # or any Python 3.10+ env
pip install -r requirements.txt
copy .env.example .env                # then add your GEMINI_API_KEY
uvicorn app:app --port 8000
```

API at http://localhost:8000 · interactive docs at http://localhost:8000/docs

**2. Frontend:**

```bash
cd frontend
npm install
copy .env.local.example .env.local    # NEXT_PUBLIC_API_BASE=http://localhost:8000
npm run dev
```

Dashboard at http://localhost:3000

## How they talk

- The frontend reads `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`) and
  calls `/api/*` on it.
- The backend allows the frontend origin via CORS (`CORS_ORIGINS` in `backend/.env`,
  default `http://localhost:3000`).

See `backend/README.md` and `frontend/README.md` for details.
