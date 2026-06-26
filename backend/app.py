"""Live Event Intelligence Engine — JSON API backend.

This is the API only; the UI is the separate Next.js app in ../frontend.

Run:    uvicorn app:app --port 8000   (or: python app.py)
Docs:   http://localhost:8000/docs
"""
import logging
import os
import threading

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")

from fastapi import FastAPI                      # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import JSONResponse       # noqa: E402

import analysis                                   # noqa: E402
import intel                                      # noqa: E402
import pipeline                                   # noqa: E402
import storage                                    # noqa: E402

app = FastAPI(title="Live Event Intelligence Engine API")

# Allow the Next.js frontend (default http://localhost:3000) to call the API.
# Set CORS_ORIGINS to a comma-separated list to add deployed origins.
_origins = [o.strip() for o in os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Freshness window (hours) for the live feed / overview / to-dos — keep the
# dashboard to recent news, not days-old items. Override with DATA_MAX_AGE_HOURS.
DATA_MAX_AGE_HOURS = float(os.environ.get("DATA_MAX_AGE_HOURS", "24"))

_scheduler = None


@app.on_event("startup")
def startup():
    global _scheduler
    storage.init()
    mode = os.environ.get("DATA_MODE", "live").lower()
    # first run: make sure the dashboard isn't empty
    if storage.stats()["total"] == 0:
        pipeline.run()
    if mode == "live":
        # Make the feed LIVE immediately: give any collected-but-unanalysed backlog
        # a quick deterministic read so fresh news shows now, not whenever the agent
        # (rate-limited) catches up. Runs even with no LLM key.
        classified = analysis.instant_analyze(storage.unclassified())
        if classified:
            log.info("instant-classified %d backlog items so the feed is live now", classified)
        # flag older analyses (no agent urgency yet) for re-analysis — they stay
        # visible meanwhile — then let the agent work through them in the background
        if analysis.llm_status()["has_key"]:
            stale = storage.requeue_for_reanalysis()
            if stale:
                log.info("flagged %d events for agent re-analysis", stale)
            threading.Thread(target=analysis.analyze_pending, daemon=True).start()
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.add_job(pipeline.run, "interval", minutes=30,
                           id="pipeline", max_instances=1)
        _scheduler.start()
        log.info("live mode: pipeline scheduled every 30 minutes")
    log.info("API ready -> http://localhost:8000  (mode=%s)", mode)


@app.get("/")
def root():
    """Tiny index so hitting the API root isn't a 404."""
    return {"service": "Live Event Intelligence API",
            "docs": "/docs",
            "endpoints": ["/api/stats", "/api/gauges", "/api/events", "/api/todos",
                          "/api/overview", "/api/event", "/api/action", "/api/refresh"]}


@app.get("/api/events")
def events(domain: str | None = None, limit: int = 60):
    if domain in (None, "", "all"):
        domain = None
    evs = storage.recent_events(domain=domain, limit=limit, max_age_hours=DATA_MAX_AGE_HOURS)
    for e in evs:
        e["action"] = analysis.derive_action(e)
    return evs


_URGENCY_RANK = {"act": 0, "review": 1, "watch": 2}


def _build_todos(evs: list[dict]) -> list[dict]:
    """Aggregate analyzed events into a prioritized to-do list: one entry per
    action type, ranked by urgency then by strongest supporting event."""
    groups: dict[str, dict] = {}
    for e in evs:
        a = analysis.derive_action(e)
        if a["urgency"] == "none":
            continue
        g = groups.setdefault(a["key"], {
            "key": a["key"], "label": a["label"], "detail": a["detail"],
            "urgency": a["urgency"], "count": 0, "score": 0.0, "events": []})
        g["count"] += 1
        if _URGENCY_RANK[a["urgency"]] < _URGENCY_RANK[g["urgency"]]:
            g["urgency"], g["detail"] = a["urgency"], a["detail"]
        g["score"] = max(g["score"],
                         (e.get("severity") or 1) * (e.get("confidence") or 0.3))
        g["events"].append({"title": e.get("title", ""), "url": e.get("url"),
                            "severity": e.get("severity") or 1,
                            "key": e.get("dedupe_key")})
    for g in groups.values():
        g["events"] = sorted(g["events"],
                             key=lambda x: -x["severity"])[:3]
    return sorted(groups.values(),
                  key=lambda g: (_URGENCY_RANK[g["urgency"]], -g["score"], -g["count"]))


@app.get("/api/todos")
def todos(limit: int = 200, per_tier: int = 8):
    """The top individual events that need attention — each a real headline with
    its own next step. Returns the strongest few from EACH urgency tier so Act
    now, Worth a look and Keep watch are all represented (not just Act now)."""
    counts = {"act": 0, "review": 0, "watch": 0}
    tiers: dict[str, list] = {"act": [], "review": [], "watch": []}
    for e in storage.recent_events(limit=limit, max_age_hours=DATA_MAX_AGE_HOURS):
        a = analysis.derive_action(e)
        u = a["urgency"]
        if u not in counts:
            continue
        counts[u] += 1
        tiers[u].append({
            "key": e.get("dedupe_key"),
            "title": e.get("title", ""),
            "domain": e.get("domain", "other"),
            "urgency": u,
            "step": a["detail"] or a["label"],
            "severity": e.get("severity") or 1,
            "score": (e.get("severity") or 1) * (e.get("confidence") or 0.3),
        })
    items = []
    for u in ("act", "review", "watch"):
        items.extend(sorted(tiers[u], key=lambda x: -x["score"])[:per_tier])
    return {"counts": counts, "items": items}


@app.get("/api/event")
def event_detail(key: str):
    """One event's full analysis plus related events in the same domain."""
    e = storage.event_by_key(key)
    if not e or e.get("analyzed_at") is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    # NOTE: auto re-analysing stale-prompt events on view is intentionally disabled.
    # On the Gemini free tier (20 requests/day) it would burn the whole daily budget
    # restyling old events the user happens to open, starving fresh-news analysis.
    # The background pipeline re-analyses stale events newest-first instead.
    e["action"] = analysis.derive_action(e)
    # Every event gets an action plan (steps to reduce the impact) AND an
    # economic-impact assessment — generated on the first view (agent-written,
    # cached) if this event doesn't have them yet. One agent call fills both.
    warrants = e["action"]["urgency"] != "none" or (e.get("severity") or 1) >= 2
    need_plan = not e.get("action_plan") and e["action"]["urgency"] != "none"
    need_econ = not e.get("economic_impact") and warrants
    need_after = not e.get("economic_impact_after") and warrants
    need_summary = not e.get("ai_summary") and warrants
    need_why = not e.get("why_it_matters") and warrants
    need_brief = not e.get("official_brief") and warrants
    if need_plan or need_econ or need_after or need_summary or need_why or need_brief:
        enr = analysis.ensure_enrichment(e)
        fields = {}
        if need_plan:
            e["action_plan"] = enr["action_plan"]
            fields["action_plan"] = enr["action_plan"]
        # before and after are a single reconciled pair (after is clamped against
        # THIS before) — always set/cache them together so the displayed before
        # and after can never come from different reads (after.score <= before.score).
        if need_econ or need_after:
            e["economic_impact"] = enr["economic_impact"]
            e["economic_impact_after"] = enr["economic_impact_after"]
            fields["economic_impact"] = enr["economic_impact"]
            fields["economic_impact_after"] = enr["economic_impact_after"]
        if need_summary and enr.get("ai_summary"):
            e["ai_summary"] = enr["ai_summary"]
            fields["ai_summary"] = enr["ai_summary"]
        if need_why and enr.get("why_it_matters"):
            e["why_it_matters"] = enr["why_it_matters"]
            fields["why_it_matters"] = enr["why_it_matters"]
        if need_brief and enr.get("official_brief"):
            e["official_brief"] = enr["official_brief"]
            fields["official_brief"] = enr["official_brief"]
        # Cache whatever we filled — even the deterministic fallback — so an event
        # that's been opened once is afterwards served straight from MongoDB and
        # never re-hits the model. The background pipeline still upgrades any
        # fallback-filled event to the full agent read later (its prompt_version
        # stays stale, so requeue_for_reanalysis picks it up).
        if fields:
            storage.set_fields(key, fields)
    # every article gets a summary — free extractive fallback for anything still
    # missing (low-severity events that skip enrichment, or an empty agent summary)
    if not e.get("ai_summary"):
        e["ai_summary"] = analysis.fallback_summary(e)
    if not e.get("why_it_matters"):
        e["why_it_matters"] = analysis.fallback_why(e)
    related = storage.related_events(e.get("domain") or "other", key, limit=6)
    for r in related:
        r["action"] = analysis.derive_action(r)
    return {"event": e, "related": related, "basis": analysis.explain(e)}


@app.get("/api/action")
def action_detail(key: str):
    """Every recent event whose suggested action is this one — the full
    breakdown behind an Action Center item."""
    matched, label, detail, urgency = [], "", "", None
    for e in storage.recent_events(limit=200):
        a = analysis.derive_action(e)
        if a["key"] == key and a["urgency"] != "none":
            e["action"] = a
            matched.append(e)
            label = a["label"]
            if urgency is None or _URGENCY_RANK[a["urgency"]] < _URGENCY_RANK[urgency]:
                urgency, detail = a["urgency"], a["detail"]
    if not matched:
        return JSONResponse({"error": "not found"}, status_code=404)
    matched.sort(key=lambda e: -((e.get("severity") or 1) * (e.get("confidence") or 0.3)))
    return {"key": key, "label": label, "detail": detail,
            "urgency": urgency, "events": matched}


_DOMAIN_WORDS = {"market": "markets", "policy": "policy", "disaster": "disasters",
                 "health": "health", "supply_chain": "supply chains", "other": "general news"}


@app.get("/api/overview")
def overview():
    """Plain-language situation brief assembled from the live data — what is
    happening, what dominates, and whether anything needs the user's attention."""
    evs = storage.recent_events(limit=150, max_age_hours=DATA_MAX_AGE_HOURS)
    todo_groups = _build_todos(evs)   # same snapshot as the counts below
    gauges = storage.get_gauges()

    total = len(evs)
    high = [e for e in evs if (e.get("severity") or 1) >= 4]
    dcount: dict[str, int] = {}
    for e in high:
        d = _DOMAIN_WORDS.get(e.get("domain") or "other", "general news")
        dcount[d] = dcount.get(d, 0) + 1
    top_d = [d for d, _ in sorted(dcount.items(), key=lambda x: -x[1])[:2]]

    acts = [t for t in todo_groups if t["urgency"] == "act"]
    lines = []
    if total:
        s = (f"Tracking {total} recent event{'s' if total != 1 else ''}; "
             f"{len(high)} look{'s' if len(high) == 1 else ''} serious")
        s += f" — mostly {' and '.join(top_d)}." if top_d else "."
        lines.append(s)
    if acts:
        t0 = acts[0]
        n = t0["count"]
        lines.append(f"Biggest theme right now: {t0['label'].lower()} — "
                     f"{n} event{'s point' if n != 1 else ' points'} the same way.")
    movers = [g for g in gauges if abs(g.get("change_pct") or 0) >= 1.5]
    if movers:
        bits = ", ".join(f"{g['name']} {'up' if g['change_pct'] >= 0 else 'down'} "
                         f"{abs(g['change_pct']):.1f}%" for g in movers[:3])
        lines.append(f"Market gauges on the move: {bits}.")
    elif gauges:
        lines.append("Market gauges are calm.")

    if acts:
        headline = f"Worth acting on: {acts[0]['label'].lower()}"
    elif high:
        headline = "Some serious events on the radar — review when you can"
    elif total:
        headline = "All quiet — nothing needs your attention right now"
    else:
        headline = "No events yet — click Refresh to fetch live data"
    return {"headline": headline, "lines": lines,
            "counts": {"total": total, "serious": len(high),
                       "actions": len(todo_groups), "urgent": len(acts)}}


@app.get("/api/gauges")
def gauges():
    return storage.get_gauges()


@app.get("/api/stats")
def stats():
    s = storage.stats()
    mode = os.environ.get("DATA_MODE", "live").lower()
    st = analysis.llm_status()
    s["mode"] = mode
    if mode == "demo":
        s["analysis"] = "demo ledger"
    elif st["has_key"]:
        s["analysis"] = st["label"]
    else:                                   # the agent can't run without a key
        s["analysis"] = f"add {st['missing']} for AI"
    # today's agent request usage vs the configured daily cap (free-tier control)
    s["ai_budget"] = analysis.llm_budget()
    return s


@app.get("/api/search")
def search(q: str = ""):
    """Answer a natural-language question over the recent events (AI Search)."""
    q = (q or "").strip()
    if not q:
        return {"answer": "", "events": []}
    evs = storage.recent_events(limit=120)
    for e in evs:
        e["action"] = analysis.derive_action(e)
    return analysis.search_events(q, evs)


@app.get("/api/trends")
def trends():
    """Emerging topics, momentum, and trend intelligence over the recent events."""
    return intel.trends()


@app.get("/api/analytics")
def analytics():
    """Research-activity analytics: totals, activity-over-time, distribution, gaps."""
    return intel.analytics()


@app.get("/api/reports")
def reports(limit: int = 120):
    """Every analysed event as a one-line report, with type/area/confidence."""
    return intel.reports(limit=limit)


@app.get("/api/dashboard")
def dashboard():
    """One payload for the standalone analytics dashboard — severity mix, events
    ingested, market gauges, briefing, top events, domain mix and impact channels."""
    return intel.dashboard()


@app.get("/api/recommend")
def recommend(q: str = ""):
    """A grounded decision read for a question (or the top event if none)."""
    return intel.recommend(q)


@app.post("/api/reanalyze")
def reanalyze(key: str):
    """Force a fresh AI analysis of one event with the CURRENT prompt (overwrites
    the cached analysis). Lets you refresh an old event to the latest prompt wording."""
    return {"ok": analysis.reanalyze_one(key)}


@app.post("/api/refresh")
def refresh():
    """Run the pipeline now (in a thread so the request returns quickly)."""
    threading.Thread(target=pipeline.run, daemon=True).start()
    return JSONResponse({"status": "started",
                         "mode": os.environ.get("DATA_MODE", "live").lower()})


@app.get("/api/health")
def health():
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
