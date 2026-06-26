# Backend — Live Event Intelligence API

Python + FastAPI. Collects live events, has the AI agent analyse each one, stores
them (MongoDB for events, PostgreSQL for the market gauges), and serves a JSON API
for the Next.js frontend.

## Files

| File | Role |
|------|------|
| `app.py` | FastAPI app — CORS, the `/api/*` endpoints, startup, the 30-min scheduler |
| `pipeline.py` | Collect → store → analyse orchestration (live + demo) |
| `collectors.py` | Live collectors (GDELT, Hacker News, Reddit, GNews, Finnhub, NewsAPI, yfinance gauges) |
| `analysis.py` | The AI agent: reads each full article and decides domain, impact, winners/losers, knock-on, urgency, and the next step |
| `article.py` | Fetches the full article text so the agent reads the whole story |
| `storage.py` | MongoDB (events) + PostgreSQL (gauges) |

## Prerequisites

- **MongoDB** running on `localhost:27017`
- **PostgreSQL** with a database named `media_risk`
- A **Gemini API key** (`GEMINI_API_KEY`) — the agent does all analysis. Get one at
  https://aistudio.google.com/apikey. (Or set `LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.)

## Run

```bash
pip install -r requirements.txt
copy .env.example .env     # add your GEMINI_API_KEY, adjust DB creds if needed
uvicorn app:app --port 8000
```

`http://localhost:8000/docs` lists every endpoint.

## API

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/stats` | totals + which analysis engine is active |
| GET | `/api/gauges` | VIX / Oil / Gold / Dollar |
| GET | `/api/events?domain=&limit=` | analysed events (each with its suggested `action`) |
| GET | `/api/todos` | the prioritised "things to look at" (top events per urgency tier) |
| GET | `/api/overview` | the plain-language situation brief |
| GET | `/api/event?key=` | one event's full breakdown + related events |
| GET | `/api/action?key=` | every event behind one action |
| POST | `/api/refresh` | run the pipeline now |

## Config (`.env`)

`CORS_ORIGINS` controls which frontend origins may call the API (default
`http://localhost:3000`). `LLM_PROVIDER` picks `gemini` or `anthropic`. See
`.env.example` for the rest.
